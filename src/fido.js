const asn1 = require("asn1.js");
const base64url = require("base64-url");
const bn = require("bn.js");
const cbor = require("cbor");
const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const secureRandom = require("secure-random");
const url = require("url");
const uuid = require("uuid-parse");

const fidoAttestation = require("./fidoAttestation");
const constants = require("./constants");
const storage = require("./storage");
const {sha256, jwkToPem, coseToJwk, coseToHex, defaultTo} = require('./utils');

const hostname = process.env.SERVER_HOSTNAME || "localhost";
const jwt_secret = process.env.FIDO_SECRET || "defaultsecret";

const fido = {};

/**
 * to handle signature der format to ASN1 format,
 * so NodeJS crypto API can verify ECDSA signature
 * do following handle before send signature to crypto.Verify object
 */
const EcdsaDerSig = asn1.define("ECPrivateKey", function() {
    return this.seq().obj(
        this.key("r").int(),
        this.key("s").int()
    );
});

function asn1SigSigToConcatSig(asn1SigBuffer) {
    const rsSig = EcdsaDerSig.decode(asn1SigBuffer, "der");
    return Buffer.concat([
        rsSig.r.toArrayLike(Buffer, "be", 32),
        rsSig.s.toArrayLike(Buffer, "be", 32)
    ]);
}

function concatSigToAsn1Sig(concatSigBuffer) {
    const r = new bn(concatSigBuffer.slice(0, 32).toString("hex"), 16, "be");
    const s = new bn(concatSigBuffer.slice(32).toString("hex"), 16, "be");
    return EcdsaDerSig.encode({r, s}, "der");
}


/**
 * @typedef {import("./public/types").AuthenticatorData} AuthenticatorData
 * @typedef {import("./public/types").AttestedCredentialData} AttestedCredentialData
 * @typedef {import("./public/types").Credential} Credential 
 * @typedef {import("./public//types").EncodedAttestationResponse} EncodedAttestationResponse
 * @typedef {import("./public//types").EncodedAssertionResponse} EncodedAssertionResponse
 */

const RANDOM_RANGE = 100000;
function getRandInt() {
    return Math.floor(Math.random() * RANDOM_RANGE + 1);
}

/**
 * Gets an opaque challenge for the client.
 * Internally, this challenge is a JWT with a timeout.
 * @returns {string} challenge
 */
fido.getChallenge = async (ipAddress, userAgent) => {
    let cnt = await storage.FIDOChallenge.countDocuments();
    let rnd = getRandInt() + cnt;
    let keyName = `${ipAddress}:${userAgent}:${rnd}`;
    let randomN = secureRandom(20, {type: "Buffer"}).toString("hex").toUpperCase();

    let token = jwt.sign({}, jwt_secret, {
        subject: keyName + ":" + randomN,
        expiresIn: constants.DEFAULT_CHALLENGE_TIMEOUT
    });
    await storage.FIDOChallenge.create({
        id: keyName,
        random: randomN,
        token,
        expire: Date.now() + constants.DEFAULT_CHALLENGE_TIMEOUT * 1000
    });
    return {token, ct: rnd};
};

/**
 * Gets an opaque challenge for the client.
 * Internally, this challenge is a JWT with a timeout.
 * @returns {string} challenge
 * @returns [{string}] excludeCredentials
 */
fido.getMakeChallenge = async (ipAddress, userAgent, uid) => {
    let keys = await storage.Credentials.find({uid});
    let excludeCredentials = keys.map(cred => {
        return {
            type: "public-key",
            id: base64url.unescape(cred.id)
        };
    });

    let cnt = await storage.FIDOChallenge.countDocuments();
    let rnd = getRandInt() + cnt;
    let keyName = `${ipAddress}:${userAgent}:${rnd}`;
    let randomN = secureRandom(20, {type: "Buffer"}).toString("hex").toUpperCase();

    let token = jwt.sign({}, jwt_secret, {
        subject: keyName + ":" + randomN,
        expiresIn: constants.DEFAULT_CHALLENGE_TIMEOUT
    });
    await storage.FIDOChallenge.create({
        id: keyName,
        random: randomN,
        token,
        expire: Date.now() + constants.DEFAULT_CHALLENGE_TIMEOUT * 1000
    });

    return {excludeCredentials, challenge: token, ct: rnd};
};

/**
 * Creates a FIDO credential and stores it
 * @param {String} uid user id
 * @param {EncodedAttestationResponse} attestation AuthenticatorAttestationResponse received from client
 */
fido.makeCredential = async (ipAddress, userAgent, ct, uid, keyName, attestation) => {
    //https://w3c.github.io/webauthn/#registering-a-new-credential

    if (!attestation.id)
        throw new Error("attestation_id_missing");

    if (!attestation.attestationObject)
        throw new Error("attestation_attestationObject_missing")

    if (!attestation.clientDataJSON)
        throw new Error("attestation_clientDataJSON_missing");

    //Step 1-2: Let C be the parsed the client data claimed as collected during
    //the credential creation
    let C;
    try {
        C = JSON.parse(attestation.clientDataJSON);
    } catch (e) {
        throw new Error("clientDataJSON_format_error");
    }

    //Step 3-6: Verify client data
    let challenges = await storage.FIDOChallenge.find({id: `${ipAddress}:${userAgent}:${ct}`});
    if (challenges.length < 1) {
        throw new Error("no_valid_challenge");
    }
    validateClientData(C, "webauthn.create", `${ipAddress}:${userAgent}:${ct}:${challenges[challenges.length - 1]["random"]}`);
    //Step 7: Compute the hash of response.clientDataJSON using SHA-256.
    const clientDataHash = sha256(attestation.clientDataJSON);

    //Step 8: Perform CBOR decoding on the attestationObject
    let attestationObject;
    try {
        attestationObject = cbor.decodeFirstSync(Buffer.from(attestation.attestationObject, "base64"));
    } catch (e) {
        throw new Error("attestationObject_content_not_valid");
    }
    //Step 8.1: Parse authData data inside the attestationObject
    const authenticatorData = parseAuthenticatorData(attestationObject.authData);
    //Step 8.2: authenticatorData should contain attestedCredentialData
    if (!authenticatorData.attestedCredentialData)
        throw new Error("authenticatorData_missing");

    //Step 9: Verify that the RP ID hash in authData is indeed the SHA-256 hash
    //of the RP ID expected by the RP.
    const expectedRpId = defaultTo(attestation.metadata.rpId, hostname)
    if (!authenticatorData.rpIdHash.equals(sha256(expectedRpId))) {
        throw new Error("invalid_rp_id");
    }

    //Step 10: Verify that the User Present bit of the flags in authData is set
    if ((authenticatorData.flags & 0b00000001) == 0) {
        throw new Error("User Present bit was not set.");
    }

    //Ignore step 11-12 since this is a test site

    //Step 13-17: Attestation
    const attestationStatement = fidoAttestation.parse(attestationObject, authenticatorData, clientDataHash);

    /** @type {Credential} */
    const credential = {
        uid: uid,
        id: base64url.encode(authenticatorData.attestedCredentialData.credentialId),
        name: keyName,
        createTime: (new Date()).getTime(),
        metadata: {
            rpId: defaultTo(attestation.metadata.rpId, hostname),
            userName: attestation.metadata.userName,
            residentKey: !!attestation.metadata.residentKey,
            rpName: attestation.metadata.rpName,
            userId: attestation.metadata.userId
        },
        creationData: {
            publicKeySummary: authenticatorData.attestedCredentialData.publicKey.kty,
            publicKeyHex: authenticatorData.attestedCredentialData.publicKeyHex,
            publicKey: JSON.stringify(authenticatorData.attestedCredentialData.publicKey),
            aaguid: authenticatorData.attestedCredentialData.aaguid,
            authenticatorDataSummary: summarizeAuthenticatorData(authenticatorData),
            authenticatorDataHex: attestationObject.authData.toString("hex").toUpperCase(),
            extensionDataHex: defaultTo(authenticatorData.extensionDataHex, "No extension data"),
            attestationStatementSummary: attestationStatement.summary,
            attestationStatementChainJSON: attestationStatement.chainJSON,
            attestationStatementHex: attestationStatement.hex
        },
        authenticationData: {
            signCount: authenticatorData.signCount,
            authenticatorDataSummary: "No authentications",
            authenticatorDataHex: "none",
            clientDataJSONHex: "none",
            signatureHex: "none",
            userHandleHex: "none",
            authenticatorDataAndTime: "none"
        }
    };

    await storage.Credentials.create(credential);

    let del = await storage.FIDOChallenge.deleteMany({id: `${ipAddress}:${userAgent}:${ct}`});

    return credential.id;
};

/**
 * Verifies a FIDO assertion
 * @param {String} uid user id
 * @param {EncodedAssertionResponse} assertion AuthenticatorAssertionResponse received from client
 * @return {Promise<Credential>} credential object that the assertion verified
 */
fido.verifyAssertion = async (ipAddress, userAgent, ct, assertion, uTypeLimit) => {
    // https://w3c.github.io/webauthn/#verifying-assertion

    // Step 1 and 2 are skipped because this is a sample app

    // Step 3: Using credential’s id attribute look up the corresponding
    // credential public key.
    /** @typeof {Credential} */
    let keyId = base64url.escape(assertion.id);
    const credentials = await storage.Credentials.find({id: keyId});
    if (!credentials.length) throw new Error("credentail_id_not_exist");
    let credential = null;
    let user = null;
    for (let index = 0; index < credentials.length; index++) {
        if (user) break;
        credential = credentials[index];
        let tmpUser = await storage.Users.findOne({id: credential.uid});
        if (tmpUser && tmpUser.keys.indexOf(keyId) > -1)
            user = tmpUser;
    }

    if (!user) {
        throw new Error("user_key_not_match");
    }
    if (uTypeLimit.indexOf(user.type) < 0)
        throw new Error("user_not_allowed_auth");

    // Step 4: Let cData, authData and sig denote the value of credential’s
    // response`s clientDataJSON, authenticatorData, and signature respectively
    const cData = assertion.clientDataJSON;
    const authData = Buffer.from(assertion.authenticatorData, "base64");
    const sig = Buffer.from(assertion.signature, "base64");

    // Step 5 and 6: Let C be the decoded client data claimed by the signature.
    let C;
    try {
        C = JSON.parse(cData);
    } catch (e) {
        throw new Error("clientDataJSON_format_error");
    }
    //Step 7-10: Verify client data
    let challenges = await storage.FIDOChallenge.find({id: `${ipAddress}:${userAgent}:${ct}`});
    if (challenges.length < 1) {
        throw new Error("no_valid_challenge");
    }
    validateClientData(C, "webauthn.get", `${ipAddress}:${userAgent}:${ct}:${challenges[challenges.length - 1]["random"]}`);

    //Parse authenticator data used for the next few steps
    const authenticatorData = parseAuthenticatorData(authData);

    //Step 11: Verify that the rpIdHash in authData is the SHA-256 hash of the
    //RP ID expected by the Relying Party.
    const expectedRpId = defaultTo(assertion.metadata.rpId, hostname)
    if (!authenticatorData.rpIdHash.equals(sha256(expectedRpId))) {
        throw new Error("invalid_rp_id");
    }

    //Step 12: Verify that the User Present bit of the flags in authData is set
    if ((authenticatorData.flags & 0b00000001) == 0) {
        throw new Error("authenticatorData_flag_not_match");
    }

    //Step 13-14 are skipped because this is a test site

    //Step 15: Let hash be the result of computing a hash over the cData using
    //SHA-256.
    const hash = sha256(cData);

    //Step 16: Using the credential public key looked up in step 3, verify
    //that sig is a valid signature over the binary concatenation of authData
    //and hash.
    const publicKey = JSON.parse(credential.creationData.publicKey);
    
    const verify = (publicKey.kty === "RSA") ? crypto.createVerify("RSA-SHA256") : crypto.createVerify("sha256");
    verify.update(authData);
    verify.update(hash);
    let asn1sig = Buffer.from(concatSigToAsn1Sig(asn1SigSigToConcatSig(sig)), "hex");
    if (!verify.verify(jwkToPem(publicKey), asn1sig))
        throw new Error("invalid_signature");

    //Step 17: verify signCount
    if (authenticatorData.signCount != 0 &&
        authenticatorData.signCount < credential.signCount) {
        throw new Error("invalid_signature_count");
    }
    //Update signCount
    const updatedCredential = await storage.Credentials.findOneAndUpdate({
        uid: credential.uid,
        id: credential.id
    }, {
            authenticationData: {
                authenticatorDataSummary: summarizeAuthenticatorData(authenticatorData),
                signCount: authenticatorData.signCount,
                authenticatorDataHex: Buffer.from(assertion.authenticatorData, "base64").toString("hex").toUpperCase(),
                clientDataJSONHex: Buffer.from(assertion.clientDataJSON, "utf8").toString("hex").toUpperCase(),
                signatureHex: Buffer.from(assertion.signature, "base64").toString("hex").toUpperCase(),
                userHandleHex: assertion.userHandle ?
                    Buffer.from(assertion.userHandle, "base64").toString("hex").toUpperCase() : "none",
            }
        }, { new: true, useFindAndModify: false});

    let del = await storage.FIDOChallenge.deleteMany({id: `${ipAddress}:${userAgent}:${ct}`});

    return {cid: credential.id, uid: user.id};
};

fido.getCredentials = async (uid) => {
    const credentials = await storage.Credentials.find({ uid: uid }).lean();
    return credentials;
};

fido.deleteCredential = async (uid, id) => {
    await storage.Credentials.remove({ uid: uid, id: id });
};

/**
 * Validates CollectedClientData
 * @param {any} clientData JSON parsed client data object received from client
 * @param {string} uid user id (used to validate challenge)
 * @param {string} type Operation type: webauthn.create or webauthn.get
 */
const validateClientData = (clientData, type, subject) => {
    if (clientData.type !== type)
        throw new Error("invalid_clientData_type");

    let origin;
    try {
        origin = url.parse(clientData.origin);
    } catch (e) {
        throw new Error("invalid_clientData_origin");
    }

    if (origin.hostname !== hostname)
        throw new Error("invalid_origin_host");

    if (hostname !== "localhost" && origin.protocol !== "https:")
        throw new Error("invalid_origin_host");

    try {
        jwt.verify(base64url.decode(clientData.challenge), jwt_secret, {subject});
    } catch (err) {
        throw new Error("invalid_challenge");
    }
};


/**
 * Parses authData buffer and returns an authenticator data object
 * @param {Buffer} authData
 * @returns {AuthenticatorData} Parsed AuthenticatorData object
 */
function parseAuthenticatorData(authData) {
    const rpIdHash = authData.slice(0, 32);
    const flags = authData[32];
    const signCount = authData.readUInt32BE(33);

    var notHandleDataSize = authData.length - 37;

    if ((!(flags & 64)) && (!(flags & 128)) && (authData.length > 37)) {
        throw new Error("invalid_authenticator_data");
    }

    /** @type {AuthenticatorData} */
    const authenticatorData = {
        rpIdHash,
        flags,
        signCount,
        attestedCredentialData: undefined,
        extensionDataHex: undefined
    };

    if (flags & 64) {
        try {
            //has attestation data
            const aaguid = uuid.unparse(authData.slice(37, 53)).toUpperCase();
            const credentialIdLength = (authData[53] << 8) | authData[54];
            const credentialId = authData.slice(55, 55 + credentialIdLength);
            const publicKeyBuffer = authData.slice(55 + credentialIdLength, authData.length);
            const publicKeyHex = coseToHex(publicKeyBuffer);
            //convert public key to JWK for storage
            const publicKey = coseToJwk(publicKeyBuffer);

            authenticatorData.attestedCredentialData = {
                aaguid,
                credentialId,
                credentialIdLength,
                publicKeyHex,
                publicKey
            };

            notHandleDataSize -= (16 + 2 + credentialIdLength + (publicKeyHex.length / 2));
        }
        catch(e) {
            throw new Error("invalid_authenticator_data_credential");
        }
    }

    if (flags & 128) {
        try {
            //has extension data
            let extensionDataCbor;

            if (authenticatorData.attestedCredentialData) {
                extensionDataCbor = cbor.decodeAllSync(authData.slice(55 + authenticatorData.attestedCredentialData.credentialIdLength, authData.length));
                extensionDataCbor = extensionDataCbor[1]; //second element
            } else {
                extensionDataCbor = cbor.decodeFirstSync(authData.slice(37, authData.length));
            }

            authenticatorData.extensionDataHex = cbor.encode(extensionDataCbor).toString("hex").toUpperCase();

            notHandleDataSize -= (authenticatorData.extensionDataHex.length / 2);
        } catch(e) {
            throw new Error("invalid_authenticator_data_extensions");
        }
    }

    if (notHandleDataSize)
        throw new Error("invalid_authenticator_data"); // should use all

    return authenticatorData;
}


/**
 * Generates a human readable representation of authenticator data
 * @param {AuthenticatorData} authenticatorData 
 * @returns {String}
 */
const summarizeAuthenticatorData = authenticatorData => {
    try {
        let str = "";

        str += "UP=" + ((authenticatorData.flags & 1) ? "1" : "0");
        str += ", ";
        str += "UV=" + ((authenticatorData.flags & 4) ? "1" : "0");
        str += ", ";
        str += "SignCount=" + authenticatorData.signCount;

        return str;
    } catch (e) {
        throw new Error("authenticator_data_interpret_fail");
    }
}

module.exports = fido;
