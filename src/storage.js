const mongoose = require("mongoose");

const syslog = require("./systemlog")
const utils = require("./utils");

const tokenInterval = ((process.env.TIMER_INTERVAL) ?
    parseInt(process.env.TIMER_INTERVAL) : (5 * 60 * 1000));
const challengeInterval = (3 * 60 * 1000); // 3 minutes
var tokenTimer = null;
var challengeTimer = null;

mongoose.set('useCreateIndex', true)
mongoose.connect(process.env.MONGODB_URL || "mongodb://localhost/attendancesystem", {
    useUnifiedTopology: true,
    useNewUrlParser: true
}).then(() => syslog.info('DB Connected!')).catch(err => {
    syslog.error(err.message);
});

var storage = {};

storage.Credentials = mongoose.model("Credential", new mongoose.Schema({
    uid: {type: String, index: true},
    id: {type: String, index: true},
    name: String,
    createTime: Number,
    metadata: {
        rpId: String,
        userName: String,
        residentKey: String,
        rpName: String,
        userId: String
    },
    creationData: {
        publicKey: String,
        publicKeySummary: String,
        publicKeyHex: String,
        aaguid: String,
        attestationStatementHex: String,
        attestationStatementSummary: String,
        attestationStatementChainJSON : String,
        authenticatorDataSummary: String,
        authenticatorDataHex: String,
        extensionDataHex: String,
    },
    authenticationData: {
        authenticatorDataSummary: String,
        signCount: Number,
        userHandleHex: String,
        authenticatorDataHex: String,
        clientDataJSONHex: String,
        signatureHex: String,
    }
}));

storage.Sessions = mongoose.model("Sessions", new mongoose.Schema({
    id: {type: String, required: true, index: true},
    title: String,
    classId: {type: String, required: true, index: true},
    startTime: String,
    endTime: String
}));

storage.AuthRecords = mongoose.model("AuthRecord", new mongoose.Schema({
    event: {type: Number, required: true}, // 0: admin-login, 1: FIDO-login, 2: student-signin, 3: manual-signin
    sessionId: {type: String, index: true},
    credentialId: String,
    classId: {type: String, index: true},
    userId: {type: String, required: true, index: true},
    userName: String,
    time: String,
    ip: String,
    status: {type: Number, required: true} // 0: normal, 1: late, 2: absence
}));

storage.Users = mongoose.model("User", new mongoose.Schema({
    id : {type: String, required: true, index: true},
    name: {type: String, required: true},
    password: String,
    type: {type: Number, required: true}, // 0: admin, 1: teacher, 2: student
    status: {type: Number, required: true},
    classes:[String],
    keys:[String]
}));

storage.Encrypts = mongoose.model("Encrypt", new mongoose.Schema({
    random: {type: String, required: true},
    userId: {type: String, required: true, index: true}
}))

const dayPeriod = new mongoose.Schema({
    startTime: {h: Number, m: Number},
    endTime: {h: Number, m: Number}
});

storage.Campus = mongoose.model("Campus", new mongoose.Schema({
    id: {type: String, required: true, index: true},
    university: {type: String, required: true},
    campus: {type: String, required: true},
    periods: [dayPeriod]
}));

storage.Classes = mongoose.model("Class", new mongoose.Schema({
    id: {type: String, required: true, index: true},
    name: {type: String, required: true},
    category: String,
    teacherId: {type: String, required: true, index: true},
    status: {type: Number, required: true, default: 0},
    campusId: {type: String, required: true, index: true},
    schoolTime: {
        date: {type: Number, required: true},
        period: {type: Number, required: true},
        lateTime: {type: String, required: true},
        absenceTime: {type: String, required: true}
    }
}));

storage.SelectedClasses = mongoose.model("SelectedClasses", new mongoose.Schema({
    classId: {type: String, required: true, index: true},
    users: [{id: String, name: String}]
}));

storage.DeleteObjects = mongoose.model("DeleteObjects", new mongoose.Schema({
    originalId: {type: String, required: true, index: true},
    count: {type: Number, required: true},
    deletedIds: [String]
}));

// for FIDO
storage.FIDOChallenge = mongoose.model("FIDOChallenge", new mongoose.Schema({
    id: {type: String, required: true, index: true},
    random: {type: String, required: true},
    token: {type: String, required: true},
    expire: {type: Number, required: true}
}));

// for Login
storage.LoginTokens = mongoose.model("LoginTokens", new mongoose.Schema({
    id: {type: String, required: true, index: true},
    payload: {
        ip: String,
        "user-agent": String,
        uid: String,
        secret: String,
        jwtInfo: String
    },
    expire: {type: Number, required: true}
}));

async function checkTokenExpire() {
    let tokens = await storage.LoginTokens.find();
    for (let idx = 0; idx < tokens.length; idx++) {
        if (tokens[idx].expire < Date.now()) {
            await storage.LoginTokens.deleteOne({id: tokens[idx].id});
        }
    }
}

async function checkChallengeExpire() {
    let challenges = await storage.FIDOChallenge.find();
    for (let idx = 0; idx < challenges.length; idx++) {
        if (challenges[idx].expire < Date.now()) {
            await storage.FIDOChallenge.deleteOne({id: challenges[idx].id});
        }
    }
}

storage.checkDataBase = async () => {
    let del = await storage.FIDOChallenge.deleteMany();

    tokenTimer = setInterval(checkTokenExpire, tokenInterval, "Interval");
    challengeTimer = setInterval(checkChallengeExpire, challengeInterval, "Interval");

    const data = await storage.Users.findOne({id: "root"});
    if (data) {
        // found data, do nothing
        return;
    }

    let result = await utils.encryptPassword(process.env.ROOT_DEFAULT_PWD || "password");

    await storage.Encrypts.create({
        random: result.salt,
        userId: "root"
    });

    let root = {
        id: "root",
        name: "admin",
        password: result.password,
        type: 0,
        status: 0,
        class: [],
        keys:[]
    };
    await storage.Users.create(root);

    return;
};

storage.stopTimer = async () => {
    clearTimeout(tokenTimer);
    clearTimeout(challengeTimer);
}

module.exports = storage;
