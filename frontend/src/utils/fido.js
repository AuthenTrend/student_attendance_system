import { getChallenge } from './api';

const domain = window.location.hostname || 'localhost';

function stringToArrayBuffer(str) {
  return Uint8Array.from(str, (c) => c.charCodeAt(0)).buffer;
}
function arrayBufferToString(arrayBuffer) {
  return String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
}
function base64decode(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
function base64encode(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) { return undefined; }

  return btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)));
}
export function create(userID, name, displayName, challenge, excludeCredentials) {
  const id = Uint8Array.from(userID, (c) => c.charCodeAt(0));
  for (let idx = 0; idx < excludeCredentials.length; idx += 1) {
    excludeCredentials[idx].id = base64decode(excludeCredentials[idx].id);
  }
  const publicKeyCredentialCreationOptions = {
    challenge: stringToArrayBuffer(challenge),
    rp: {
      name: 'Students Attendance System',
      id: domain,
    },
    user: {
      id,
      name,
      displayName,
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      authenticatorAttachment: 'cross-platform',
      userVerification: 'preferred',
      requireResidentKey: true,
    },
    timeout: 60000,
    excludeCredentials,
    attestation: 'direct',
  };
  return navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
    userVerification: 'preferred',
  }).then((data) => ({
    id: data.id,
    clientDataJSON: arrayBufferToString(data.response.clientDataJSON),
    attestationObject: base64encode(data.response.attestationObject),
    metadata: {
      rpId: publicKeyCredentialCreationOptions.rp.id,
      userName: publicKeyCredentialCreationOptions.user.name,
      residentKey: publicKeyCredentialCreationOptions.authenticatorSelection.requireResidentKey,
    },
  }));
}

// export function get(challenge) {
export function get() {
  return getChallenge().then((d) => {
    const challenge = d.result;
    const publicKeyCredentialRequestOptions = {
      challenge: stringToArrayBuffer(challenge),
      timeout: 180000,
      allowCredentials: [],
      userVerification: 'discouraged',
    };

    return navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }).then((assertion) => ({
      id: base64encode(assertion.rawId),
      clientDataJSON: arrayBufferToString(assertion.response.clientDataJSON),
      userHandle: base64encode(assertion.response.userHandle),
      signature: base64encode(assertion.response.signature),
      authenticatorData: base64encode(assertion.response.authenticatorData),
      metadata: {
        rpId: publicKeyCredentialRequestOptions.rpId,
      },
    }));
  });
}
