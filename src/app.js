require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const enforce = require("express-sslify");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const requestIp = require("request-ip");
const os = require("os");
const cluster = require("cluster");

const campus = require("./campus");
const classes = require("./classes");
const constants = require("./constants");
const fido = require("./fido");
const storage = require("./storage");
const syslog = require("./systemlog");
const users = require("./users");


function getIPAddress(request) {
    let addr = requestIp.getClientIp(request);
    let strIP = addr;
    if (addr.indexOf(":") > -1 && addr.indexOf(".") > -1) {
        // IPv6 format contains IPv4 format, use IPv4 format
        let ipv6Addr = addr.split(":");
        strIP = ipv6Addr[(ipv6Addr.length - 1)];
    }

    return strIP;
}

function updateCookie(res, name, value, options=null) {
    if (options != null) {
        res.cookie(name, value, options);
    }
    else {
        res.cookie(name, value);
    }
}

function genAccessRecord(req, res, uid) {
    let tString = syslog.getTimeString(new Date());
    let ip = getIPAddress(req);

    return `${tString}-${ip} ${uid} ${req.method} ${req.url} ${res.statusCode}`;
}

function registerExpress(app) {
    if (process.env.ENFORCE_SSL_AZURE === "true") {
        app.use(enforce.HTTPS({ trustAzureHeader: true }));
    }
    app.use(fileUpload({
        useTempFiles : true,
        tempFileDir : '/tmp/'
    }));
    app.use(express.static("public"));
    app.use(cookieParser());
    app.use(bodyParser.json());


    app.get("/challenge", async(req, res) => {
        try {
            let ip = getIPAddress(req);
            let result = await fido.getChallenge(ip, req.headers["user-agent"]);
            updateCookie(res, "ct", result.ct, {maxAge: 120000, expires: Date.now() + 120000});
            res.json({status: 0, message: "", result: result.token});
        } catch(err) {
            res.status(500).json({status: 80});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, "UNKNOWN"));
    });

    app.get("/user/:userID/challenge", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let ip = getIPAddress(req);
            let tokenInfo = await users.getUserByToken(
                ip, 
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await fido.getMakeChallenge(ip, req.headers["user-agent"], req.params.userID);
            updateCookie(res, "ct", result.ct, {maxAge: 120000, expires: Date.now() + 120000});
            res.json({
                status: 0, message: "",
                result: {
                    excludeCredentials: result.excludeCredentials,
                    challenge: result.challenge
            }});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(500).json({status: 1, error: err.message})
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/login", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let result = await users.verifyPassword(getIPAddress(req), req.headers["user-agent"], req.body);
            user = result.id;
            updateCookie(res, "ut", result.token);
            updateCookie(res, "sd", result.secret);
            res.json({status: 0, message: "", result: {uid: result.id, isFirstLogin: result.isFirstLogin}});
        } catch(err) {
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/fido_login", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let result = await users.fidoLogin(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ct,
                req.body);
            user = result.id;
            updateCookie(res, "ut", result.token);
            updateCookie(res, "sd", result.secret);
            updateCookie(res, "ct", "", {maxAge: 0, expires: Date.now()});
            res.json({status: 0, message: "", result: {uid: result.id}});
        } catch(err) {
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/logout", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let result = await users.logoutUser(getIPAddress(req), req.headers["user-agent"], req.cookies.ut, req.cookies.sd);
            user = result;
            updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
            updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/classes", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let forceGet = false;
            if (req.query.fa && req.query.fa.toLowerCase() === "true")
                forceGet = true;

            let result = await classes.getAllClasses(tokenInfo.uid, forceGet);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/classes", async (req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            if (req.files) {
                let fileObject = Object.values(req.files)[0];

                if (fileObject.mimetype != "text/csv")
                    throw new Error("file_type_error");

                let result = await classes.addClassesByFile(
                    tokenInfo.uid, fileObject.tempFilePath);
                if (tokenInfo.token && tokenInfo.secret) {
                    updateCookie(res, "ut", tokenInfo.token);
                    updateCookie(res, "sd", tokenInfo.secret);
                }

                res.json({status: 0, message: "", result});
            }
            else {
                res.status(400).json({status:1, error: "not_find_file"});
            }
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/class", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid

            let result = await classes.addClass(tokenInfo.uid, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/class/:classID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await classes.getClass(tokenInfo.uid, req.params.classID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message == "not_find_class")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/class/:classID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await classes.updateClass(tokenInfo.uid, req.params.classID, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result})
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.delete("/class/:classID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid

            if (req.params.classID.startsWith(constants.DELETE_PREFIX)) {
                await classes.removeClass(tokenInfo.uid, req.params.classID);
            }
            else {
                await classes.deleteClass(tokenInfo.uid, req.params.classID);
            }
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "delete class succeeded"});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message == "not_find_class")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/class/:classID/students", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            await classes.updateStudents(tokenInfo.uid, req.params.classID, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "update students succeeded"});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/class/:classID/sign_ins", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let idx = 0;
            if (req.query.index != undefined)
                idx = parseInt(req.query.index);
            let limit = 10;
            if (req.query.limit != undefined)
                limit = parseInt(req.query.limit);
            let before = 0;
            if (req.query.before != undefined)
                before = parseInt(req.query.before);

            let result = await classes.getClassSignRecords(tokenInfo.uid, req.params.classID, idx, limit, before);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_class")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/class/:classID/sign_in", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await classes.createNewSession(tokenInfo.uid, req.params.classID, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_class")
                res.status(404).json({status: 1, message: err.message});
            else
                res.status(400).json({status: 1, message: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/class/:classID/sign_in", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let ipAddress = getIPAddress(req);
            let tokenInfo = await users.getUserByToken(
                ipAddress,
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await users.updateSignInRecords(
                ipAddress, tokenInfo.uid, req.params.classID, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, message: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/class/:classID/sign_in/:sessionID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let ipAddress = getIPAddress(req);
            let tokenInfo = await users.getUserByToken(
                ipAddress,
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            let result = await users.fidoSignIn(
                ipAddress,
                req.headers["user-agent"],
                req.cookies.ct,
                req.body,
                req.params.classID,
                req.params.sessionID);
            user = `teacher:${tokenInfo.uid}-student:${result.student}`
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }
            updateCookie(res, "ct", "", {maxAge: 0, expires: Date.now()});
            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_class" ||
                err.message === "not_find_session")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/class/:classID/sign_in/:signID/finish", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            await classes.stopSession(tokenInfo.uid, req.params.classID, req.params.signID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message == "not_find_class")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/users", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let forceGet = false;
            if (req.query.fa && req.query.fa.toLowerCase() === "true") {
                forceGet = true;
            }
            let result = await users.getAllUsers(tokenInfo.uid, forceGet);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message:"" ,result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error:err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/users", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            if (req.files) {
                let fileObject = Object.values(req.files)[0];

                if (fileObject.mimetype != "text/csv")
                    throw new Error("file_type_error");

                let result = await users.addUsersByFile(
                    tokenInfo.uid, fileObject.tempFilePath);
                if (tokenInfo.token && tokenInfo.secret) {
                    updateCookie(res, "ut", tokenInfo.token);
                    updateCookie(res, "sd", tokenInfo.secret);
                }

                res.json({status: 0, message: "", result});
            }
            else {
                res.status(400).json({status:1, error: "not_find_file"});
            }
        }
        catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/user", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let limit = constants.TEACHER_ALLOWED_USER_TYPE;
            if (tokenInfo.uid === constants.ADMIN_ID)
                limit = constants.ADMIN_ALLOWED_USER_TYPE;
            await users.addUser(req.body, limit);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/user/:userID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await users.getUser(tokenInfo.uid, req.params.userID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/user/:userID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid

            let limit = constants.TEACHER_ALLOWED_USER_TYPE;
            if (tokenInfo.uid === constants.ADMIN_ID)
                limit = constants.ADMIN_ALLOWED_USER_TYPE;

            await users.updateUser(tokenInfo.uid, req.params.userID, req.body, limit);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "update user succeeded"});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.delete("/user/:userID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            if (req.params.userID.startsWith(constants.DELETE_PREFIX)) {
                await users.removeUser(tokenInfo.uid, req.params.userID);
            }
            else {
                await users.deleteUser(tokenInfo.uid, req.params.userID);
            }
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/user/:userID/keys", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await users.getUserKeys(tokenInfo.uid, req.params.userID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/user/:userID/key", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let ipAddress = getIPAddress(req);
            let tokenInfo = await users.getUserByToken(
                ipAddress,
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await users.addNewKey(
                ipAddress,
                req.headers["user-agent"],
                req.cookies.ct,
                tokenInfo.uid,
                req.params.userID,
                req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }
            updateCookie(res, "ct", "", {maxAge: 0, expires: Date.now()});
            res.json({status: 0, message: "", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/user/:userID/key", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            tokenInfo.uid;

            let result = await users.updateKey(
                tokenInfo.uid,
                req.params.userID,
                req.body.keyID,
                req.body.name);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user" ||
                err.message === "not_find_key")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.delete("/user/:userID/key/:keyID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            await users.deleteKey(
                tokenInfo.uid,
                req.params.userID,
                req.params.keyID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: ""});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user" ||
                err.message === "not_find_key")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/user/:userID/records", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await users.getLoginRecords(tokenInfo.uid, req.params.userID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "", result})
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message === "not_find_user")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.get("/campuses", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await campus.getAllCampus(tokenInfo.uid);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({
                status: 0,
                message: "get campuses records:"+result.length,
                result
            });
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.post("/campus", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await campus.addCampus(tokenInfo.uid, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "add campus succeeded", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.put("/campus/:campusID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            let result = await campus.updateCampus(tokenInfo.uid, req.params.campusID, req.body);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "update campus succeeded", result});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message == "campus_not_found")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    app.delete("/campus/:campusID", async(req, res) => {
        let user = "UNKNOWN";
        try {
            let tokenInfo = await users.getUserByToken(
                getIPAddress(req),
                req.headers["user-agent"],
                req.cookies.ut,
                req.cookies.sd);
            user = tokenInfo.uid;

            await campus.deleteCampus(tokenInfo.uid, req.params.campusID);
            if (tokenInfo.token && tokenInfo.secret) {
                updateCookie(res, "ut", tokenInfo.token);
                updateCookie(res, "sd", tokenInfo.secret);
            }

            res.json({status: 0, message: "update campus succeeded"});
        } catch(err) {
            if (err.message === "token_expire") {
                updateCookie(res, "ut", "", {maxAge: 0, expires: Date.now()});
                updateCookie(res, "sd", "", {maxAge: 0, expires: Date.now()});
            }
            if (err.message == "not_find_campus")
                res.status(404).json({status: 1, error: err.message});
            else
                res.status(400).json({status: 1, error: err.message});
        }
        syslog.logSystemRequest(genAccessRecord(req, res, user));
    });

    if (process.env.RUNNING_STATE === "stage") {
        app.get("/version", async(req, res) => {
            let message = `${process.env.VERSIONS} (${process.env.BRANCH_NUMBER})`;
            res.json({status: 0, message});
            syslog.logSystemRequest(genAccessRecord(req, res, "Testing"));
        });
    }

    app.use(async function(req, res, next) {
        let data = await fs.readFileSync("./404.html", {encoding: "utf8"});
        res.status(404).send(data);
        syslog.logSystemRequest(genAccessRecord(req, res, "USER"));
    });
}

async function startServer() {
    // start server application
    var clusterWorkerSize = os.cpus().length;
    if (clusterWorkerSize > 3) {
        clusterWorkerSize -= 2;
    }
    else
        clusterWorkerSize = 1;

    if (clusterWorkerSize > 1) {
        if (cluster.isMaster) {
            await storage.checkDataBase();
            setTimeout(function() {
                for (let idx = 0; idx < clusterWorkerSize; idx++) {
                    cluster.fork();
                }

            }, 500);

            cluster.on("exit", function(worker) {
                syslog.info(`worker ${process.pid} stoped`);
            });
        }
        else {
            const app = express();

            registerExpress(app);
            app.listen(process.env.PORT || 8080, () => syslog.info(`App launched with worker ${process.pid}`));
        }
    }
    else {
        const app = express();

        registerExpress(app);
        app.listen(process.env.PORT || 8080, () => syslog.info("App launched with single worker."));
    }
}

startServer();
