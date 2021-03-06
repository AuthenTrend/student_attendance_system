const jwkToPem = require("jwk-to-pem")
const crypto = require("crypto");
const cbor = require("cbor");
const bcrypt = require("bcrypt");

const saltRound = 14;
const utils = {};

utils.hashHexString = (msg, hashAlg="sha256") => {
    const hash = crypto.createHash(hashAlg);
    return hash.update(msg).digest().toString("hex");
}

utils.encryptPassword = async (password) => {
    let value = utils.hashHexString(password);

    let st = bcrypt.genSaltSync(saltRound);
    let pwd = bcrypt.hashSync(value, st);
    return {salt: st, password: pwd.substring(st.length)};
}

/**
 * Evaluates the sha256 hash of a string
 * @param {string} data
 * @returns {Buffer} sha256 of the input data
 */
utils.sha256 = data => {
    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest();
}

/**
 * Converts a JWK to a PEM, which is compatible with
 * node`s crypto verify methods.
 * @param {any} jwk json web token
 */
utils.jwkToPem = jwk => {
    return jwkToPem(jwk);
}

/**
 * Utility function to convert a DER  to a PEM
 * @param {String} der base64 encoded DER
 * @returns {String} PEM
 */
utils.derToPEM = der => {
    return "-----BEGIN CERTIFICATE-----\n" +
        der +
        "\n-----END CERTIFICATE-----";
}

/**
 * Turns a cert subject string into a map of its fields
 * @param {string} subjectStr cert subject
 * @returns {*} map of subject fields
 */
utils.parseCertSubject = (subjectStr) => {
    return subjectStr
        .slice(1)
        .split("/")
        .map(i=>i.split("="))
        .reduce((a,c)=>{
            a[c[0]] = c[1];
            return a;
        }, {});
}

/**
 * Converts a COSE key to a JWK
 * @param {Buffer} buffer Buffer containing cbor data with COSE key
 * @returns {any} JWK object
 */
utils.coseToJwk = buffer => {
    try {
        let publicKeyJwk = {};
        const publicKeyCbor = cbor.decodeFirstSync(buffer);

        if (publicKeyCbor.get(3) == -7) {
            publicKeyJwk = {
                kty: "EC",
                crv: "P-256",
                x: publicKeyCbor.get(-2).toString('base64'),
                y: publicKeyCbor.get(-3).toString('base64')
            }
        } else if (publicKeyCbor.get(3) == -257) {
            publicKeyJwk = {
                kty: "RSA",
                n: publicKeyCbor.get(-1).toString('base64'),
                e: publicKeyCbor.get(-2).toString('base64')
            }
        } else {
            throw new Error("Unknown public key algorithm");
        }

        return publicKeyJwk;
    } catch (e) {
        throw new Error("Could not decode COSE Key");
    }
}

/**
 * Converts a COSE key to hex
 * @param {Buffer} buffer Buffer containing cbor data with COSE key
 * @returns {String} hex encoded
 */
utils.coseToHex = buffer => {
    try {
        const publicKeyCbor = cbor.decodeFirstSync(buffer);

        return cbor.encode(publicKeyCbor).toString("hex").toUpperCase();
    } catch (e) {
        throw new Error("Could not decode COSE Key");
    }
}

/**
 * Returns a default value if the provided string is undefined
 * @param {string} str
 * @param {string} defaultStr
 * @returns {string}
 */
utils.defaultTo = (str, defaultStr) => {
    if (typeof(str) === "undefined") {
        return defaultStr;
    } else {
        return str;
    }
}
module.exports = utils;
