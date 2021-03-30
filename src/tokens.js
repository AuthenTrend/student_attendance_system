
const jwt = require("jsonwebtoken");
const secureRandom = require("secure-random");

const constants = require("./constants");
const storage = require("./storage");

//sha256("appatfido2jwt")
const sessionSecret = process.env.SESSION_TOKEN_SECRET || "session_default";
const tokens = {};

function createToken(payload, subject, expiresIn) {
    return jwt.sign(payload, sessionSecret, { subject, expiresIn });
}

tokens.genSessionToken = async (ipAddress, agent, uid) => {
    let currentTokens = await storage.LoginTokens.find();
    for (let idx = 0; idx < currentTokens.length; idx++) {
        if (currentTokens[idx].payload.uid === uid) {
            if (uid === "root") {
                // check token
                if (Date.now() >= currentTokens[idx].expire) {
                    await storage.LoginTokens.deleteOne({id: currentTokens[idx].id});
                }
                else {
                    throw new Error("duplicate_login");
                }
            }
        }
    }

    let randomN = secureRandom(16, {type: "Buffer"}).toString("hex").toUpperCase();
    let payload = {
        ip: ipAddress,
        "user-agent": agent,
        uid,
        secret: randomN,
    };
    let subject = uid + ":" + randomN;

    let token = createToken(payload, subject, constants.DEFAULT_LOGIN_TIMEOUT);
    let signature = token.split(".")[2];

    payload["jwtInfo"] = token.substring(0, token.length - signature.length - 1);

    await storage.LoginTokens.create({
        id: signature,
        payload,
        expire: Date.now() + constants.DEFAULT_LOGIN_TIMEOUT * 1000
    });

    return {token: signature, secret: randomN};
};

tokens.verifySessionToken = async (ipAddress, agent, token, secret) => {
    let sessionToken = await storage.LoginTokens.findOne({id: token});
    if (sessionToken == null) {
        throw new Error("invalid_access");
    }

    if (sessionToken.payload.ip !== ipAddress) {
        throw new Error("invalid_access");
    }

    if (sessionToken.payload["user-agent"] !== agent) {
        throw new Error("invalid_access");
    }

    if (sessionToken.payload.secret !== secret) {
        throw new Error("invalid_access");
    }

    let uid = sessionToken.payload.uid;
    let newToken = "";
    let newSecret = "";
    let jwtToken = `${sessionToken.payload.jwtInfo}.${token}`;
    try {
        let result = jwt.verify(
            jwtToken,
            sessionSecret,
            {subject: `${uid}:${secret}`});
        sessionToken.expire = Date.now() + constants.DEFAULT_LOGIN_TIMEOUT * 1000;
        await sessionToken.save();
    } catch(err) {
        if (err instanceof jwt.TokenExpiredError) {
            // delete token
            let expire = sessionToken.expire;
            await storage.LoginTokens.deleteOne({id: token});

            if (expire <= Date.now()) {
                throw new Error("token_expire");
            }
            else {
                let newGenToken = await tokens.genSessionToken(ipAddress, agent, uid);
                newToken = newGenToken.token;
                newSecret = newGenToken.secret;
            }
        }
        else {
            // TODO: is there anything not done here?
            throw new Error("invalid_access");
        }
    }

    return {uid, token: newToken, secret: newSecret};
};

tokens.deleteToken = async (token) => {
    await storage.LoginTokens.deleteOne({id: token});

    return;
};

module.exports = tokens;
