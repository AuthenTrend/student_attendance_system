const bcrypt = require("bcrypt");
const fs = require("fs");

const classes = require("./classes");
const constants = require("./constants");
const fido = require("./fido");
const storage = require("./storage");
const tokens = require("./tokens");
const utils = require("./utils");

const users = {};
const loginFailRecord = {};

users.verifyPassword = async (ipAddress, agent, loginData) => {
    // we are blocking to only admin can use this API.
    if (loginData.username != "admin") {
        throw new Error("not_valid_user");
    }

    let datas = await storage.Users.find({name: loginData.username});
    if (datas.length != 1 || datas[0].type != constants.USER_TYPES.ADMIN_TYPE) {
        throw new Error("not_valid_user");
    }

    let salt = await storage.Encrypts.find({userId: datas[0].id})
    if (salt.length != 1) {
        throw new Error("not_valid_user");
    }

    let value = utils.hashHexString(loginData.password);
    let result = bcrypt.compareSync(value, salt[0].random + datas[0].password);
    if (!result) {
        // TODO: record failed login and if necessary, lock it
        //return errors.password_not_match;
        throw new Error("not_valid_user");
    }

    //gen token by userId, IP, browser-agent
    let token = await tokens.genSessionToken(ipAddress, agent, datas[0].id);
    token["id"] = datas[0].id;
    token["isFirstLogin"] = (
        datas[0].keys.length == 0 &&
        (loginData.password == (process.env.ROOT_DEFAULT_PWD || "password")));

    let cDate = new Date();
    let auth = {
        event: constants.LOGIN_TYPES.ADMIN_LOGIN,
        sessionId: cDate.valueOf().toString(),
        credentialId: "0",
        classId: "login:" + cDate.toUTCString(),
        userId: datas[0].id,
        userName: datas[0].name,
        time: cDate.valueOf().toString(),
        ip: ipAddress,
        status: constants.ROLLCALL_STATES.ROLLCALL_STATE_NORMAL
    };
    await storage.AuthRecords.create(auth);

    return token;
};

users.fidoLogin = async (ipAddress, agent, ct, assertion) => {
    let ids = await fido.verifyAssertion(ipAddress, agent, ct, assertion, constants.FIDO_LOGIN_ALLOWED_USER_TYPE);
    let token = await tokens.genSessionToken(ipAddress, agent, ids.uid);
    token["id"] = ids.uid;
    let user = await storage.Users.findOne({id: ids.uid});
    let cDate = new Date();
    let auth = {
        event: constants.LOGIN_TYPES.FIDO_LOGIN,
        sessionId: cDate.valueOf().toString(),
        credentialId: ids.cid,
        classId: "login:" + cDate.toUTCString(),
        userId: user.id,
        userName: user.name,
        time: cDate.valueOf().toString(),
        ip: ipAddress,
        status: constants.ROLLCALL_STATES.ROLLCALL_STATE_NORMAL
    };

    await storage.AuthRecords.create(auth);

    return token;
};

users.logoutUser = async (ipAddress, agent, token, secret) => {
    if (!token || !secret) throw new Error("invalid_access");

    let tokenInfo = await tokens.verifySessionToken(ipAddress, agent, token, secret);
    await tokens.deleteToken(token);
    return tokenInfo.uid;
};

users.fidoSignIn = async (ipAddress, agent, ct, assertion, classId, sessionId) => {
    let classData = await storage.Classes.findOne({id: classId});
    if (!classData)
        throw new Error("not_find_class");
    let campus = await storage.Campus.findOne({id: classData.campusId});
    if (!campus)
        throw new Error("not_find_campus");
    let period = campus.periods[classData.schoolTime.period - 1];

    let session = await storage.Sessions.findOne({id: sessionId});
    if (!session)
        throw new Error("not_find_session");

    let ids = await fido.verifyAssertion(ipAddress, agent, ct, assertion, constants.CLASS_SIGN_IN_USER_TYPE);
    let user = await storage.Users.findOne({id: ids.uid});
    let cDate = new Date();

    // check if student is late
    let status = constants.ROLLCALL_STATES.ROLLCALL_STATE_ABSENCE;
    if (cDate.getDay() != classData.schoolTime.date) {
        // TODO: may skip this check
        //throw new Error("wrong_day");
    }

    // this only work between 00:00:00 to 23:59:59
    let classStartTime = (period.startTime.h * 60) + period.startTime.m;
    let classLateTime = classStartTime + parseInt(classData.schoolTime.lateTime);
    let classAbsenceTime = classStartTime + parseInt(classData.schoolTime.absenceTime);
    //let classEndTime = (period.endTime.h * 60) + period.endTime.m;
    let currentTime = (cDate.getHours() * 60) + cDate.getMinutes();
    if (currentTime >= (classStartTime - constants.STUDENT_LOGIN_EARLY_BUFFER) && currentTime < classLateTime)
        status = constants.ROLLCALL_STATES.ROLLCALL_STATE_NORMAL;
    else if (currentTime >= classLateTime && currentTime < classAbsenceTime)
        status = constants.ROLLCALL_STATES.ROLLCALL_STATE_LATE;

    let auth = {
        event: constants.LOGIN_TYPES.STUDENT_LOGIN,
        sessionId,
        credentialId: ids.cid,
        classId,
        userId: user.id,
        userName: user.name,
        time: cDate.valueOf().toString(),
        ip: ipAddress,
        status
    };

    await storage.AuthRecords.create(auth);

    return {student: user.id, time: cDate.valueOf()};
};

users.getUserByToken = async (ipAddress, agent, token, secret) => {
    if (!token || !secret) throw new Error("invalid_access");

    return await tokens.verifySessionToken(ipAddress, agent, token, secret);
};

users.getAllUsers = async (userId, forceAll) => {
    let result = [];
    let rules = {};
    if (userId !== "root")
        rules["type"] = 2;
    if (!forceAll)
        rules["status"] = 0;

    if (userId === "root") {
        let adminInfo = await storage.Users.findOne({id:"root"});
        result.push({
            id: adminInfo.id,
            username: adminInfo.name,
            allowAccountLogin: true
        });
    }

    let userList = await storage.Users.find(rules);
    for (let index = 0; index < userList.length; index++) {
        if (userList[index].id === "root" && userList[index].name === "admin")
            continue;

        result.push({
            id: userList[index].id,
            username: userList[index].name,
            type: userList[index].type
        });
    }

    return result;
};

users.addUsersByFile = async (loginUID, filePath) => {
    if (loginUID != constants.ADMIN_ID)
        throw new Error("authority_not_allowed");

    let total = 0;
    let overwrite = 0;
    let fail = 0;
    let end = 0;
    let data = fs.readFileSync(filePath, {encoding: "utf-8"});

    // language replace
    data = data.replace("生徒", "student").replace("教師", "teacher");

    let rows = data.split("\n");
    let dataList = rows.map(row => {
        return row.split(",");
    });

    if (data.endsWith('\r\n') || data.endsWith('\n') || data.endsWith('\r')) {
        total = dataList.length - 2;
        end = dataList.length - 1;
    }
    else {
        total = dataList.length - 1;
        end = dataList.length;
    }

    for (let index = 1; index < end; index++) {
        if (dataList[index].length != dataList[0].length) {
            fail += 1;
            continue;
        }
        let [uid, uname, utype] = dataList[index];
        if (utype.trim() !== "teacher" && utype.trim() !== "student") {
            fail += 1;
            continue;
        }
        let iut = ((utype.trim() == "teacher") ? constants.USER_TYPES.TEACHER_TYPE :
            constants.USER_TYPES.STUDENT_TYPE);

        let searchResult = await storage.Users.findOne({id: uid.trim(), status: 0});
        if (searchResult) {
            overwrite += 1;

            searchResult.name = uname.trim();
            searchResult.type = iut;
            await searchResult.save();
        }
        else {
            await storage.Users.create({
                id: uid.trim(),
                name: uname.trim(),
                password: "",
                type: iut,
                status: 0,
                classes: [],
                keys: []
            })
        }
    }

    return {
        total,
        overwrite,
        fail
    };
};

users.addUser = async (userInfo, uTypeLimit) => {
    if (!userInfo.id) throw new Error("user_id_is_empty");
    let findUser = await storage.Users.findOne({id: userInfo.id.trim()});

    if (findUser) throw new Error("user_id_exist");

    if (!userInfo.username) throw new Error("name_is_empty");

    if (isNaN(userInfo.type)) throw new Error("invalid_type_value");
    if (uTypeLimit.indexOf(userInfo.type) < 0) throw new Error("wrong_type");

    await storage.Users.create({
        id: userInfo.id.trim(),
        name: userInfo.username.trim(),
        password: "",
        type: userInfo.type,
        status:0,
        class:[],
        keys:[]
    });

    return;
};

users.getUser = async (loginUID, targetUID) => {
    if (!loginUID && !targetUID) throw new Error("parameters_error");

    if (loginUID !== constants.ADMIN_ID &&
        targetUID.startsWith(constants.DELETE_PREFIX)) {
        throw new Error("authority_not_allowed");
    }

    let rule = {id: targetUID};
    if (!(targetUID.startsWith(constants.DELETE_PREFIX)))
        rule.status = 0;

    let user = await storage.Users.findOne(rule);
    if (!user)
        throw new Error("not_find_user");

    if (loginUID !== constants.ADMIN_ID &&
        loginUID !== targetUID &&
        user.type != constants.USER_TYPES.STUDENT_TYPE) {
        throw new Error("authority_not_allowed");
    }

    let classes = [];
    for (let index = 0; index < user.classes.length; index++) {
        let classData = await storage.Classes.findOne({id: user.classes[index]});
        classes.push({id: classData.id, class_no: classData.id, name: classData.name});
    }

    return {
        id: targetUID,
        name: user.name,
        type: user.type,
        classes};
};

users.updateUser = async (loginUID, targetUID, userInfo, uTypeLimit) => {
    if (targetUID.startsWith(constants.DELETE_PREFIX))
        throw new Error("invalid_update");

    let findUser = await storage.Users.findOne({id: targetUID});
    if (!findUser) throw new Error("not_find_user");

    if (targetUID === constants.ADMIN_ID) {
        if (loginUID !== constants.ADMIN_ID) {
            throw new Error("authority_not_allowed");
        }

        if (userInfo.classes.length) {
            throw new Error("invalid_parameter_class");
        }

        if (userInfo.password) {
            let encryptPwd = await utils.encryptPassword(userInfo.password);
            let findEncrypt = await storage.Encrypts.findOne({userId: loginUID});

            findEncrypt.random = encryptPwd.salt;
            findUser.password = encryptPwd.password;
            await findEncrypt.save();
            await findUser.save();
        }
        return;
    }

    if (uTypeLimit.indexOf(findUser.type) < 0)
        throw new Error("authority_not_allowed");

    if (userInfo.password) {
        throw new Error("no_password_allowed");
    }

    findUser.name = userInfo.username.trim();
    if (userInfo.classes.length) {
        let newClasses = [];
        for (let index = 0; index < userInfo.classes.length; index++) {
            newClasses.push(userInfo.classes[index].id);
        }
        findUser.classes = newClasses;
    }
    await findUser.save();

    return;
};

users.deleteUser = async (loginUID, targetUID) => {
    if (!loginUID && !targetUser) throw new Error("parameters_error");

    let userData = await storage.Users.findOne({id: targetUID, status: 0});
    if (!userData)
        throw new Error("not_find_user");

    if (userData.type == constants.USER_TYPES.TEACHER_TYPE) {
        if (loginUID != constants.ADMIN_ID)
            throw new Error("authority_not_allowed");

        /*
        for (let index = 0; index < userData.classes.length; index++) {
            await classes.deleteClass(loginUID, userData.classes[index]);
        }
        //*/

        userData.classes.splice(0, userData.classes.length);
    }
    else if (userData.type == constants.USER_TYPES.STUDENT_TYPE) {
        for (let index = 0; index < userData.classes.length; index++) {
            let selectClass = await storage.SelectedClasses.findOne({classId: userData.classes[index]});
            let idList = selectClass.users.map(user => {return user.id});
            let idIndex = idList.indexOf(targetUID);
            if (idIndex > -1) {
                selectClass.users.splice(idIndex, 1);
                await selectClass.save();
            }
        }
        userData.classes.splice(0, userData.classes.length);
    }
    else
        throw new Error("invalid_data");

    let newId = "";
    let queryId = `u_${targetUID}`;
    let deleteOne = await storage.DeleteObjects.findOne({originalId: queryId});
    if (deleteOne) {
        deleteOne.count += 1;
        newId = `${constants.DELETE_PREFIX}${targetUID}_${deleteOne.count}`;
        let index = 0;
        for (index = 0; index < deleteOne.deletedIds.length; index++) {
            if (!deleteOne.deletedIds[index]) {
                newId = `${constants.DELETE_PREFIX}${targetUID}_${index + 1}`;
                let tempArray = deleteOne.deletedIds.concat();
                tempArray[index] = newId;
                deleteOne.deletedIds = tempArray;
                break;
            }
        }
        if (index == deleteOne.deletedIds.length) {
            deleteOne.deletedIds.push(newId);
        }
    }
    else {
        newId = `${constants.DELETE_PREFIX}${targetUID}_1`;
        deleteOne = new storage.DeleteObjects({
            originalId: queryId,
            count: 1,
            deletedIds: [newId]
        });
    }
    await deleteOne.save();

    // delete authenticate records
    let authRecords = await storage.AuthRecords.find({userId: targetUID});
    for (let index = 0; index < authRecords.length; index++) {
        authRecords[index].userId = newId;
        await authRecords[index].save();
    }

    // delete user security keys
    let result = await storage.Credentials.deleteMany({uid: targetUID});
    if (result.deletedCount != userData.keys.length) {
        // TODO: error?
    }

    // mark user as delete
    userData.keys.splice(0, userData.keys.length);
    userData.id = newId;
    userData.status = 1;
    await userData.save();

    return;
};

users.removeUser = async (loginUID, targetUID) => {
    if (!loginUID && !targetUser &&
        !(targetUser.startsWith(constants.DELETE_PREFIX)))
        throw new Error("parameters_error");
    if (loginUID !== constants.ADMIN_ID) throw new Error("authority_not_allowed");

    let result = await storage.Users.deleteOne({id: targetUID});
    if (result.deletedCount == 0) {
        throw new Error("not_find_user");
    }

    await storage.AuthRecords.deleteMany({userId: targetUID});

    let deleteId = `u_${(targetUID.split("_")[0]).substring(constants.DELETE_PREFIX.length)}`;
    let deleteOne = await storage.DeleteObjects.findOne({originalId: deleteId});
    if (deleteOne) {
        if (deleteOne.count == 1) {
            await storage.DeleteObjects.deleteOne({originalId: deleteId});
        }
        else {
            deleteOne.count -= 1;
            let index = parseInt(targetUID.split("_")[1]) - 1;
            let tempArray = deleteOne.deletedIds.concat();
            delete tempArray[index];
            deleteOne.deletedIds = tempArray;
            await deleteOne.save();
        }
    }
    else {
        // TODO: error?
    }

    return;
};

users.getUserKeys = async (loginUID, targetUID) => {
    let userData = await storage.Users.findOne({id: targetUID, status: 0});
    if (!userData)
        throw new Error("not_find_user");

    if (loginUID !== constants.ADMIN_ID &&
        loginUID !== targetUID &&
        userData.type != constants.USER_TYPES.STUDENT_TYPE)
        throw new Error("authority_not_allowed");

    let result = [];
    for (let index = 0; index < userData.keys.length; index++) {
        let key = await storage.Credentials.findOne({uid: targetUID, id: userData.keys[index]});
        result.push({
            id: userData.keys[index],
            name: key.name,
            create_time: key.createTime
        });
    }

    return result;
};

users.addNewKey = async (ipAddress, agent, ct, loginUID, targetUID, attestation) => {
    let user = await storage.Users.findOne({id: targetUID, status: 0});
    if (!user)
        throw new Error("not_find_user");

    if (loginUID !== constants.ADMIN_ID &&
        loginUID !== targetUID &&
        user.type != constants.USER_TYPES.STUDENT_TYPE) {
            throw new Error("authority_not_allowed");
        }

    let defaultKeyName = 'key' + (user.keys.length + 1);

    let keyId = await fido.makeCredential(ipAddress, agent, ct, targetUID, defaultKeyName, attestation);

    user.keys.push(keyId);
    await user.save();
    return {id: keyId, name: defaultKeyName};
};

users.updateKey = async (loginUID, targetUID, keyId, keyName) => {
    if (!keyName)
        throw new Error("invalid_parameter");

    let userData = await storage.Users.findOne({id: targetUID, status: 0});
    if (!userData)
        throw new Error("not_find_user");

    if (loginUID !== constants.ADMIN_ID &&
        loginUID !== targetUID &&
        userData.type != constants.USER_TYPES.STUDENT_TYPE)
        throw new Error("authority_not_allowed");

    if (userData.keys.indexOf(keyId) < 0)
        throw new Error("invalid_parameter");

    let key = await storage.Credentials.findOne({id: keyId, uid: targetUID});
    if (!key)
        throw new Error("not_find_key");

    key.name = keyName.trim();
    await key.save();

    return;
}

users.deleteKey = async (loginUID, targetUID, keyId) => {
    let userData = await storage.Users.findOne({id: targetUID, status: 0});
    if (!userData)
        throw new Error("not_find_user");

    if (loginUID !== constants.ADMIN_ID &&
        loginUID !== targetUID &&
        userData.type != constants.USER_TYPES.STUDENT_TYPE)
        throw new Error("authority_not_allowed");

    let result = await storage.Credentials.deleteOne({id: keyId, uid: targetUID});
    if (result.deletedCount == 0) {
        throw new Error("not_find_key");
    }

    let index = userData.keys.indexOf(keyId);
    if (index > -1) {
        userData.keys.splice(index, 1);
        await userData.save();
    }
    else {
        throw new Error("invalid_parameter");
    }

    return;
};

users.getLoginRecords = async (loginUID, targetUID) => {
    let userData = await storage.Users.findOne({id: targetUID, status: 0});
    let authRecords = await storage.AuthRecords.find({userId: targetUID})
    if (!userData)
        throw new Error("not_find_user");

    let result = null;
    if (userData.type === constants.USER_TYPES.ADMIN_TYPE) {
        if (loginUID !== constants.ADMIN_ID)
            throw new Error("authority_not_allowed");

        result = authRecords.map(record => {
            let key_use = ((record.event == constants.LOGIN_TYPES.ADMIN_LOGIN) ?
                constants.LOGIN_KEY_TYPES.ACCOUNT_LOGIN : constants.LOGIN_KEY_TYPES.FIDO_KEY_LOGIN);
            return {
                ip: record.ip,
                time: parseInt(record.time),
                key_use
            }
        })
    }
    else if (userData.type === constants.USER_TYPES.TEACHER_TYPE) {
        if (loginUID !== constants.ADMIN_ID && loginUID !== targetUID)
            throw new Error("authority_not_allowed");

        result = authRecords.map(record => {
            if (record.event !== constants.LOGIN_TYPES.FIDO_LOGIN)
                throw new Error("parameters_error");
            return {
                ip: record.ip,
                time: parseInt(record.time),
                key_use: constants.LOGIN_KEY_TYPES.FIDO_KEY_LOGIN
            }
        });
    }
    else {
        result = [];
        for (index = 0; index < authRecords.length; index++) {
            if (authRecords[index].classId.startsWith(constants.DELETE_PREFIX))
                continue;
            let key_use = constants.LOGIN_KEY_TYPES.FIDO_KEY_LOGIN;
            let classId = authRecords[index].classId;
            switch (authRecords[index].event) {
                case constants.LOGIN_TYPES.FIDO_LOGIN: {
                    classId = "";
                    break;
                }
                case constants.LOGIN_TYPES.STUDENT_LOGIN: {
                    break;
                }
                case constants.LOGIN_TYPES.MANUAL_LOGIN: {
                    key_use = constants.LOGIN_KEY_TYPES.TEACHER_CALL_NAME_LOGIN;
                    break;
                }
                case constants.LOGIN_TYPES.ADMIN_LOGIN:
                default: {
                    throw new Error("parameters_error");
                }
            }
            result.push({
                ip: authRecords[index].ip,
                time: parseInt(authRecords[index].time),
                class: classId,
                key_use
            });
        }
    }

    result.sort(function (a, b) {
        return b.time - a.time;
    })

    return result;
}

users.updateSignInRecords = async (ipAddress, loginUID, classId, signinList) => {
    let user = await storage.Users.findOne({id: loginUID, status: 0});
    if (!user || user.type !== constants.USER_TYPES.TEACHER_TYPE || user.classes.indexOf(classId) < 0) {
        throw new Error("authority_not_allowed");
    }

    let queryClass = await storage.Classes.findOne({id: classId, status: 0});
    let querySelected = await storage.SelectedClasses.findOne({classId});

    if (!queryClass || !querySelected) {
        throw new Error("not_found_class");
    }

    let success = 0;
    let fail = 0;

    for(let index = 0; index < signinList.length; index++) {
        if (signinList[index].status < constants.ROLLCALL_STATES.ROLLCALL_STATE_NORMAL ||
            signinList[index].status > constants.ROLLCALL_STATES.ROLLCALL_STATE_ABSENCE) {
            fail += 1;
            continue;
        }

        let sessionId = signinList[index].session;
        let records = await storage.AuthRecords.find({
            sessionId: signinList[index].session,
            classId,
            userId: signinList[index].student,
        });
        if (records.length) {
            for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
                records[recordIndex].status = signinList[index].status;
                await records[recordIndex].save();
            }
        }
        else {
            let student = await storage.Users.findOne({id: signinList[index].student, status: 0});
            if (!student) {
                fail += 1;
                continue;
            }

            await storage.AuthRecords.create({
                event: constants.LOGIN_TYPES.MANUAL_LOGIN,
                sessionId: signinList[index].session,
                credentialId: "0",
                classId,
                userId: signinList[index].student,
                userName: student.name,
                time: Date.now().toString(),
                ip: ipAddress,
                status: signinList[index].status
            });
        }

        success += 1;
    }

    return {total: signinList.length, success, fail};
};

module.exports = users;
