const fs = require("fs");

const campus = require("./campus");
const constants = require("./constants");
const storage = require("./storage");
const tokens = require("./tokens");

const classes = {};

async function updateClassTeacher(classId, oldTeacherId, newTeacherObject) {
    if (!classId)
        throw new Error("parameters_error");

    if (oldTeacherId && oldTeacherId !== newTeacherObject.id) {
        let origTeacher = await storage.Users.findOne({id: oldTeacherId, status: 0});
        if (origTeacher) {
            let index = origTeacher.classes.indexOf(classId);
            if (index > -1) {
                origTeacher.classes.splice(index, 1);
                await origTeacher.save()
            }
        }
        else {
            // throw new Error();
        }
    }

    if (newTeacherObject && newTeacherObject.classes.indexOf(classId) < 0) {
        newTeacherObject.classes.push(classId);
        await newTeacherObject.save();
    }
}

async function saveClass(loginId, classModelObject, classInfo) {
    if (classInfo) {
        let late = parseInt(classInfo.lateAfter.trim());
        let absent = parseInt(classInfo.absenceAfter.trim());
        if (late < 0 || late > 59 || absent < 0 || absent > 59 || absent < late)
            throw new Error("parameters_error");

        let campusResult = await storage.Campus.findOne({campus: classInfo.campusName.trim()});
        if (!campusResult)
            throw new Error("campus_not_found");
        if (!campusResult.periods.length)
            throw new Error("campus_has_no_periods");
        if (classInfo.period < 1 ||
            classInfo.period > campusResult.periods.length)
            throw new Error("class_period_invalid");

        let findTeacher = await storage.Users.findOne({
            id: classInfo.teacherId.trim(),
            type: constants.USER_TYPES.TEACHER_TYPE,
            status: 0});
        if (findTeacher == null ||
            findTeacher.name != classInfo.teacherName.trim())
            throw new Error("not_find_user");
        if (loginId !== constants.ADMIN_ID &&
            (classInfo.teacherId.trim() &&
             loginId !== classInfo.teacherId.trim()))
            throw new Error("authority_not_allowed");

        let otid = "";
        if (classModelObject.teacherId)
            otid = classModelObject.teacherId
        await updateClassTeacher(classInfo.class_no.trim(), otid, findTeacher);

        classModelObject.id = classInfo.class_no.trim();
        classModelObject.name = classInfo.name.trim();
        classModelObject.category = classInfo.category.trim();
        classModelObject.teacherId = classInfo.teacherId.trim();
        classModelObject.campusId = campusResult.id;
        classModelObject.schoolTime.date = classInfo.date;
        classModelObject.schoolTime.period = classInfo.period;
        classModelObject.schoolTime.lateTime = classInfo.lateAfter.trim();
        classModelObject.schoolTime.absenceTime = classInfo.absenceAfter.trim();

        await classModelObject.save();
    }
}

async function saveStudentToClass(classObject, studentList) {
    // remove old student
    let tempStudentArray = classObject.users.map(user => {return user.id;});
    let tempNewStudentArray = studentList.map(user => {return user.id;});
    for (let index = 0; index < tempNewStudentArray.length; index++) {
        let checkIndex = tempStudentArray.indexOf(tempNewStudentArray);
        if (checkIndex > -1) {
            tempStudentArray.splice(checkIndex, 1);
        }
    }
    for (let index = 0; index < tempStudentArray.length; index++) {
        let userData = await storage.Users.findOne({id: tempStudentArray[index], status: 0});
        if (!userData) continue;

        let checkIndex = userData.classes.indexOf(classObject.classId);
        if (checkIndex > -1) {
            userData.classes.splice(checkIndex, 1);
            await userData.save();
        }
    }

    let newArray = []
    for (let index = 0; index < studentList.length; index++) {
        let userData = await storage.Users.findOne({id: studentList[index].id, status: 0});
        if (!userData || userData.name != studentList[index].username)
            continue;

        if (userData.classes.indexOf(classObject.classId) < 0) {
            userData.classes.push(classObject.classId);
            await userData.save();
        }

        newArray.push(
            {id: studentList[index].id, name: studentList[index].username});
    }

    classObject.users = newArray;
    await classObject.save();
}

classes.getAllClasses = async (/*language,*/ loginId, forceAll) => {
    let rules = {};
    let classData = [];
    if (loginId === constants.ADMIN_ID) {
        if (!forceAll)
            rules["status"] = 0;
        classData = await storage.Classes.find(rules);
    }
    else {
        let userData = await storage.Users.findOne({id: loginId, status: 0});
        if (!userData) {
            throw new Error("authority_not_allowed");
        }

        if (userData.type === constants.USER_TYPES.TEACHER_TYPE) {
            rules["teacherId"] = loginId;
            rules["status"] = 0;
            classData = await storage.Classes.find(rules);
        }
        else if (userData.type === constants.USER_TYPES.STUDENT_TYPE) {
            for (let cnt = 0; cnt < userData.classes.length; cnt++) {
                let theClass = await storage.Classes.findOne({id: userData.classes[cnt], status: 0});
                if (theClass) {
                    classData.push(theClass);
                }
            }
        }
        else {
            throw new Error("authority_not_allowed");
        }
    }

    let result = [];
    for (let cnt = 0; cnt < classData.length; cnt++) {
        let selectClassData = await storage.SelectedClasses.findOne({classId: classData[cnt].id});
        if (!selectClassData)
            continue;

        let students = selectClassData.users.map(u => {
            return {id: u.id, username: u.name};
        });

        let userData = await storage.Users.findOne({id: classData[cnt].teacherId, status: 0});
        if (!userData)
            continue;

        let campus = await storage.Campus.findOne({id: classData[cnt].campusId});
        if (!campus)
            continue;

        result.push({
            id: classData[cnt].id,
            category: classData[cnt].category,
            class_no: classData[cnt].id,
            name: classData[cnt].name,
            teacherId: userData.id,
            teacherName: userData.name,
            campusName: campus.campus,
            date: classData[cnt].schoolTime.date,
            period: classData[cnt].schoolTime.period,
            lateAfter: classData[cnt].schoolTime.lateTime,
            absenceAfter: classData[cnt].schoolTime.absenceTime,
            students
        });
    }

    return result;
};

classes.addClassesByFile = async(loginId, filePath) => {
    if (loginId != constants.ADMIN_ID)
        throw new Error("authority_not_allowed");

    let total = 0;
    let overwrite = 0;
    let fail = 0;
    let end = 0;
    let data = fs.readFileSync(filePath, {encoding: "utf-8"});

    data = data.replace("日曜日", "Sunday")
        .replace("月曜日", "Monday")
        .replace("火曜日", "Tuesday")
        .replace("水曜日", "Wednesday")
        .replace("木曜日", "Thursday")
        .replace("金曜日", "Friday")
        .replace("土曜日", "Satureday");

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

        let [class_no, category, name, teacherId, teacherName, campusName, weekDay, period, lateAfter, absenceAfter] = dataList[index];

        let date = -1;
        switch(weekDay.trim()) {
            case "Sunday": {
                date = 0;
                break;
            }
            case "Monday": {
                date = 1;
                break;
            }
            case "Tuesday": {
                date = 2;
                break;
            }
            case "Wednesday": {
                date = 3;
                break;
            }
            case "Thursday": {
                date = 4;
                break;
            }
            case "Friday": {
                date = 5;
                break;
            }
            case "Satureday": {
                date = 6;
                break;
            }
        }
        if (date < 0) {
            fail += 1;
            continue;
        }

        period = parseInt(period.trim());

        try {
            let classObj = await storage.Classes.findOne({id: class_no.trim()});
            let waitOverwrite = false;
            if (classObj) {
                waitOverwrite = true;
            }
            else {
                classObj = new storage.Classes({status: 0});
            }

            await saveClass(loginId, classObj, {
                class_no,
                category,
                name,
                teacherId,
                teacherName,
                campusName,
                date,
                period,
                lateAfter,
                absenceAfter
            });

            let selectObj = await storage.SelectedClasses.findOne({classId: class_no.trim()});
            if (selectObj) {
                waitOverwrite = true;
            }
            else {
                selectObj = new storage.SelectedClasses({classId: class_no});
            }
            await saveStudentToClass(selectObj, []);

            if (waitOverwrite)
                overwrite += 1;
        } catch(err) {
            fail += 1;
        }
    }

    return {
        total,
        overwrite,
        fail
    };
};

classes.addClass = async (loginId, classInfo) => {
    if (!classInfo.class_no ||
        !classInfo.name ||
        !classInfo.category ||
        (classInfo.date < 0 || classInfo.date > 6) ||
        !classInfo.campusName ||
        !classInfo.lateAfter ||
        !classInfo.absenceAfter
    ) {
        throw new Error("class_info_not_valid");
    }

    if (loginId === constants.ADMIN_ID &&
        !classInfo.teacherId &&
        !classInfo.teacherName) {
        throw new Error("class_info_not_valid");
    }

    let search = await storage.Classes.findOne({id: classInfo.class_no.trim()});
    if (search != null)
        throw new Error("class_id_duplicate");

    let findTeacher = await storage.Users.findOne({id: classInfo.teacherId.trim(), type: constants.USER_TYPES.TEACHER_TYPE, status: 0});
    if (!findTeacher)
        throw new Error("not_find_user");

    classInfo.lateAfter = classInfo.lateAfter.toString();
    classInfo.absenceAfter = classInfo.absenceAfter.toString();

    let newClass = new storage.Classes({status: 0});
    await saveClass(loginId, newClass, classInfo);

    let newSelectClass = new storage.SelectedClasses({classId: classInfo.class_no});
    await saveStudentToClass(newSelectClass, classInfo.students)

    classInfo["id"] = classInfo.class_no;

    return classInfo;
};

classes.getClass = async (loginId, classId) => {
    if (!loginId && !classId) throw new Error("parameters_error");

    if (loginId !== constants.ADMIN_ID &&
        classId.startsWith(constants.DELETE_PREFIX)) {
        throw new Error("authority_not_allowed");
    }

    let rule = {id: classId};
    if (!(classId.startsWith(constants.DELETE_PREFIX)))
        rule.status = 0;

    let classData = await storage.Classes.findOne(rule);
    if (!classData)
        throw new Error("not_find_class");

    let findTeacher = await storage.Users.findOne({id: classData.teacherId, status: 0});
    if (!findTeacher)
        throw new Error("class_parameters_error");
    if (findTeacher.classes.indexOf(classId) < 0)
        throw new Error("authority_not_allowed");

    let selectClassData = await storage.SelectedClasses.findOne({classId: classId});
    if (!selectClassData)
        throw new Error("class_parameters_error");
    if (loginId !== constants.ADMIN_ID &&
        loginId !== classData.teacherId) {
        let ids = selectClassData.users.map(u => {return u.id});
        if (ids.indexOf(loginId) < 0)
            throw new Error("authority_not_allowed");
    }

    let students = selectClassData.users.map(u => {
        return {id: u.id, username: u.name};
    });

    let campus = await storage.Campus.findOne({id: classData.campusId});
    if (!campus)
        throw new Error("class_parameters_error");

    let result = {
        id: classId,
        class_no: classId,
        category: classData.category,
        name: classData.name,
        teacherId: classData.teacherId,
        teacherName: findTeacher.name,
        campusName: campus.campus,
        date: classData.schoolTime.date,
        period: classData.schoolTime.period,
        lateAfter: classData.schoolTime.lateTime,
        absenceAfter: classData.schoolTime.absenceTime,
        students
    };

    return result;
};

classes.updateClass = async (loginId, classId, classInfo) => {
    if (classId.startsWith(constants.DELETE_PREFIX)) {
        throw new Error("invalid_update");
    }

    if (!classInfo.class_no ||
        !classInfo.name ||
        !classInfo.category ||
        (classInfo.date < 0 || classInfo.date > 6) ||
        !classInfo.campusName ||
        !classInfo.lateAfter ||
        !classInfo.absenceAfter
    ) {
        throw new Error("class_info_not_valid");
    }

    if (loginId === constants.ADMIN_ID &&
        !classInfo.teacherId &&
        !classInfo.teacherName) {
        throw new Error("class_info_not_valid");
    }

    let classResult = await storage.Classes.findOne({id: classId});
    let selectClass = await storage.SelectedClasses.findOne({classId});
    if (!classResult || !selectClass) {
        throw new Error("not_find_class");
    }

    await saveClass(loginId, classResult, classInfo);

    /* marked: student list will only to through updateStudents
    if (classInfo.students) {
        await saveStudentToClass(selectClass, classInfo.students);
    }*/

    classInfo.id = classInfo.class_no;
    return classInfo;
};

classes.deleteClass = async(loginId, classId) => {
    let classResult = await storage.Classes.findOne({id: classId, status: 0});
    let selectClassResult = await storage.SelectedClasses.findOne({classId});

    if (classResult == null || selectClassResult == null) {
        throw new Error("not_find_class");
    }

    if (loginId !== constants.ADMIN_ID &&
        loginId !== classResult.teacherId) {
        throw new Error("authority_not_allowed");
    }

    // handle students
    for (let index = 0; index < selectClassResult.users.length; index++) {
        let student = await storage.Users.findOne({id: selectClassResult.users[index].id, status: 0});
        if (student) {
            let classIndex = student.classes.indexOf(classId);
            if (classIndex > -1) {
                student.classes.splice(classIndex, 1);
                await student.save();
            }
        }
    }

    // handle teacher
    let teacher = await storage.Users.findOne({id: classResult.teacherId, status: 0});
    if (teacher) {
        let classIndex = teacher.classes.indexOf(classId);
        if (classIndex > -1) {
            teacher.classes.splice(classIndex, 1);
            await teacher.save();
        }
    }

    let newId = "";
    let queryId = `c_${classId}`;
    let deleteOne = await storage.DeleteObjects.findOne({originalId: queryId});
    if (deleteOne) {
        deleteOne.count += 1;
        newId = `${constants.DELETE_PREFIX}${classId}_${deleteOne.count}`;
        let index = 0;
        for (index = 0; index < deleteOne.deletedIds.length; index++) {
            if (!deleteOne.deletedIds[index]) {
                newId = `${constants.DELETE_PREFIX}${classId}_${index + 1}`;
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
        newId = `${constants.DELETE_PREFIX}${classId}_1`;
        deleteOne = new storage.DeleteObjects({
            originalId: queryId,
            count: 1,
            deletedIds: [newId]
        });
    }
    await deleteOne.save();

    // handle login records
    let sessions = await storage.Sessions.find({classId});
    for (let index = 0; index < sessions.length; index++) {
        sessions[index].classId = newId;
        await sessions[index].save();
    }
    let authRecords = await storage.AuthRecords.find({classId});
    for (let index = 0; index < authRecords.length; index++) {
        authRecords[index].classId = newId;
        await authRecords[index].save();
    }

    selectClassResult.classId = newId;
    await selectClassResult.save();

    classResult.id = newId;
    classResult.status = 1;
    await classResult.save();

    return;
};

classes.removeClass = async(loginId, classId) => {
    if (!loginId || !classId || !(classId.startsWith(constants.DELETE_PREFIX)))
        throw new Error("parameters_error");
    if (loginId !== constants.ADMIN_ID)
        throw new Error("authority_not_allowed");

    let result = await storage.Classes.deleteOne({id: classId});
    if (result.deletedCount == 0) {
        throw new Error("not_find_class");
    }

    result = await storage.SelectedClasses.deleteOne({classId});
    if (result.deletedCount == 0) {
        throw new Error("not_find_class");
    }

    result = await storage.Sessions.deleteMany({classId});
    if (result.deletedCount == 0) {
        // TODO: error
    }

    //result = await storage.AuthRecords.deleteMany({classId});
    //if (result.deletedCount == 0) {
        // TODO: error?
    //}

    let deleteId = `c_${(classId.split("_")[0]).substring(constants.DELETE_PREFIX.length)}`;
    let deleteOne = await storage.DeleteObjects.findOne({originalId: deleteId});
    if (deleteOne) {
        if (deleteOne.count == 1) {
            await storage.DeleteObjects.deleteOne({originalId: deleteId});
        }
        else {
            deleteOne.count -= 1;
            let index = parseInt(classId.split("_")[1]) - 1;
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
}

classes.updateStudents = async(loginId, classId, studentList) => {
    let classData = await storage.Classes.findOne({id: classId});
    if (!classData)
        throw new Error("not_find_class");

    if (loginId !== constants.ADMIN_ID &&
        loginId !== classData.teacherId)
        throw new Error("authority_not_allowed");

    let selectClassData = await storage.SelectedClasses.findOne({classId});
    if (!selectClassData)
        throw new Error("not_find_class");

    await saveStudentToClass(selectClassData, studentList);

    return;
}

classes.getClassSignRecords = async(loginId, classId, idx, limit, before) => {
    let classData = await storage.Classes.findOne({id: classId});
    let selectClassData = await storage.SelectedClasses.findOne({classId});
    if (!classData || !selectClassData)
        throw new Error("not_find_class");

    let bOnlyUserRecord = false;
    if (loginId !== constants.ADMIN_ID &&
        loginId !== classData.teacherId) {
        let ids = selectClassData.users.map(u => {return u.id});
        if (ids.indexOf(loginId) < 0)
            throw new Error("authority_not_allowed");
        bOnlyUserRecord = true;
    }

    let sessionRecords = [];
    let sessions = await storage.Sessions.find({classId});
    for (let index = 0; index < sessions.length; index++) {
        let checkingList = selectClassData.users.map(user => {return user.id;})
        if (bOnlyUserRecord)
            checkingList = [loginId];
        let signRecords = await storage.AuthRecords.find({
            classId, sessionId: sessions[index].id});

        // make priority
        let authObject = {};
        for (let recordIndex = 0; recordIndex < signRecords.length; recordIndex++) {
            if (authObject[signRecords[recordIndex].userId] === undefined) {
                authObject[signRecords[recordIndex].userId] = {
                    time: parseInt(signRecords[recordIndex].time),
                    status: signRecords[recordIndex].status
                };
            }
            else if (authObject[signRecords[recordIndex].userId].status > signRecords[recordIndex].status) {
                authObject[signRecords[recordIndex].userId].time = parseInt(signRecords[recordIndex].time);
                authObject[signRecords[recordIndex].userId].status = signRecords[recordIndex].status;
            }
        }

        let records = [];
        // by class sort way
        for (let checkingIndex = 0; checkingIndex < checkingList.length; checkingIndex++) {
            if (authObject[checkingList[checkingIndex]] === undefined) {
                records.push({
                    student: checkingList[checkingIndex],
                    time: 0,
                    status: constants.ROLLCALL_STATES.ROLLCALL_STATE_ABSENCE
                });
            }
            else {
                records.push({
                    student: checkingList[checkingIndex],
                    time: authObject[checkingList[checkingIndex]].time,
                    status: authObject[checkingList[checkingIndex]].status
                });
            }
        }

        sessionRecords.push({
            title: sessions[index].id,
            start: sessions[index].startTime,
            end: sessions[index].endTime,
            records
        });
    }

    sessionRecords.sort(function (a, b) {
        return parseInt(b.start) - parseInt(a.start);
    })
    if (before) {
        for (let index = 0; index < sessionRecords.length; index++) {
            if (sessionRecords[index].start < before) {
                idx = idx + index;
                break;
            }
        }
    }

    let end = idx + limit;
    if (end > sessionRecords.length)
        end = sessionRecords.length;


    outputArray = sessionRecords.slice(idx, end);

    result = {
        total: sessionRecords.length,
        limit,
        records: outputArray
    };

    return result;
}

classes.createNewSession = async (loginId, classId, sessionInfo) => {
    let classData = await storage.Classes.findOne({id: classId, teacherId: loginId, status: 0});
    if (!classData)
        throw new Error("not_find_class");
    let teacher = await storage.Users.findOne({id: loginId, status: 0, type: constants.USER_TYPES.TEACHER_TYPE});
    if (!teacher || teacher.classes.indexOf(classId) < 0)
        throw new Error("authority_not_allowed");

    let ct = Date.now();
    let sId = `${classId}_${ct.toString()}`;
    await storage.Sessions.create({
        id: sId,
        title: sessionInfo.title,
        classId,
        startTime: ct.toString(),
        endTime: ""
    });

    return {
        title: sId,
        start: ct,
        end: 0,
        records: []
    };
}

classes.stopSession = async (loginId, classId, sessionId) => {
    let classData = await storage.Classes.findOne({id: classId, teacherId: loginId, status: 0});
    if (!classData)
        throw new Error("not_find_class");
    let teacher = await storage.Users.findOne({id: loginId, status: 0, type: constants.USER_TYPES.TEACHER_TYPE});
    if (!teacher || teacher.classes.indexOf(classId) < 0)
        throw new Error("authority_not_allowed");

    let session = await storage.Sessions.findOne({id: sessionId, classId});
    if (!session || session.endTime.length !== 0)
        throw new Error("authority_not_allowed");
    let ct = Date.now();
    session.endTime = ct.toString();
    await session.save();

    return;
}

module.exports = classes;
