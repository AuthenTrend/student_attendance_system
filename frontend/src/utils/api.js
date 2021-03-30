import axios from 'axios';
// import misc from './misc';
// import { datetimeToString } from './format';

const baseURL = process.env.VUE_APP_API_URL;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log(error.response.data.error);
    if (error.response
      && error.response.data
      && (
        error.response.data.error === 'invalid_access'
        || error.response.data.error === 'token_expire'
        || error.response.data.message === 'invalid_access'
        || error.response.data.message === 'token_expire'
      )) {
      document.cookie = '';
      window.location.href = '/#/login';
    }
    return Promise.reject(error);
  },
);

// const classes = [
//   {
//     category: 'Basic',
//     no: 'SEM100J',
//     campus: 0,
//     period: 1,
//     name: 'ﾌﾚｯｼｭﾏﾝｾﾐﾅｰ',
//     teacher: 'Teacher A',
//     late_after: 10,
//     absent_after: 15,
//   },
//   {
//     category: 'Basic',
//     no: 'SEM101J',
//     campus: 0,
//     period: 2,
//     name: 'English',
//     teacher: 'Teacher E',
//     late_after: 10,
//     absent_after: 15,
//   },
//   {
//     category: 'Basic',
//     no: 'SEM103S',
//     campus: 0,
//     period: 3,
//     name: 'Sport',
//     teacher: 'Teacher C',
//     late_after: 10,
//     absent_after: 15,
//   }];

export function getClasses() {
  return axios.get(`${baseURL}/classes`).then((rsp) => rsp.data);
  // return new Promise((r) => r(JSON.parse(JSON.stringify(classes))));
}

function CustomError(msg, status) {
  this.msg = msg;
  this.status = status;
}
CustomError.prototype = Error.prototype;

export function getClass(no) {
  return axios.get(`${baseURL}/class/${no}`).then((rsp) => rsp.data);
}

export function addClass(classInfo) {
  return axios.post(`${baseURL}/class`, classInfo);
}

export function updateClass(no, classInfo) {
  return axios.put(`${baseURL}/class/${no}`, classInfo);
}

export function deleteClass(no) {
  return axios.delete(`${baseURL}/class/${no}`).then((rsp) => rsp.data);
}

export function getCampuses() {
  // return new Promise((r) => r(campuses));
  return axios.get(`${baseURL}/campuses`).then((rsp) => rsp.data);
}

export function addCampus(name) {
  return axios.post(`${baseURL}/campus`, {
    name,
    university: 'university',
    periods: [
      {
        start_time: {
          hour: 9,
          minute: 10,
        },
        end_time: {
          hour: 10,
          minute: 0,
        },
      },
    ],
  });
}

export function updateCampus(id, campus) {
  return axios.put(`${baseURL}/campus/${id}`, campus);
}

export function deleteCampus(id) {
  return axios.delete(`${baseURL}/campus/${id}`);
}

export function FIDOLogin(auth) {
  return axios.post(`${baseURL}/fido_login`, auth).then((rsp) => rsp.data);
}

export function login(account, password) {
  return axios.post(`${baseURL}/login`, {
    username: account,
    password,
  }).then((rsp) => rsp.data);
}

// const users = [
//   {
//     id: misc.randomID(),
//     studentID: 'rx12345',
//     name: 'testUser',
//     type: 1,
//   },
// ];

export function getUsers() {
  return axios.get(`${baseURL}/users`).then((rsp) => rsp.data);
}

export function getUser(id) {
  return axios.get(`${baseURL}/user/${id}`).then((rsp) => rsp.data);
}

export function addUser(user) {
  return axios.post(`${baseURL}/user`, user).then((rsp) => rsp.data);
}

export function updateUser(user) {
  const newUser = {
    username: user.username || user.name,
    id: user.id,
    type: user.type,
    classes: [],
  };
  if (user.password) {
    newUser.password = user.password;
  }
  return axios.put(`${baseURL}/user/${user.id}`, newUser).then((rsp) => rsp.data);
}

export function addUserKey(id, key) {
  return axios.post(`${baseURL}/user/${id}/key`, key).then((rsp) => rsp.data);
}

export function deleteUserKey(id, keyID) {
  return axios.delete(`${baseURL}/user/${id}/key/${keyID}`).then((rsp) => rsp.data);
}

export function updateKeyName(userID, keyID, name) {
  return axios.put(`${baseURL}/user/${userID}/key`, { name, keyID }).then((rsp) => rsp.data);
}

export function getUserKeys(id) {
  return axios.get(`${baseURL}/user/${id}/keys`).then((rsp) => rsp.data);
}

export function getUserRecords(id) {
  return axios.get(`${baseURL}/user/${id}/records`).then((rsp) => rsp.data);
}

export function getChallenge() {
  return axios.get(`${baseURL}/challenge`).then((rsp) => rsp.data);
}

export function getMakeChallenge(id) {
  return axios.get(`${baseURL}/user/${id}/challenge`).then((rsp) => rsp.data);
}

export function checkIsTokenError(response) {
  if (response.data.error === 'token_expire' || response.data.error === 'invalid_access') {
    window.location.href = '/#/login';
  }
}

export function logout() {
  return axios.post(`${baseURL}/logout`).then((rsp) => rsp.data);
}

export function updateClassStudents(id, students) {
  return axios.put(`${baseURL}/class/${id}/students`, students).then((rsp) => rsp.data);
}

export function updateSigninRecord(id, records) {
  return axios.put(`${baseURL}/class/${id}/sign_in`, records).then((rsp) => rsp.data);
}

export function createSigninSession(id) {
  return axios.post(`${baseURL}/class/${id}/sign_in`).then((rsp) => rsp.data);
}

export function signinClass(id, session, data) {
  return axios.put(`${baseURL}/class/${id}/sign_in/${session}`, data).then((rsp) => rsp.data);
}

export function endSigninSession(id, session) {
  return axios.post(`${baseURL}/class/${id}/sign_in/${session}/finish`).then((rsp) => rsp.data);
}

export function getSigninSessions(id, limit, offset, before) {
  if (before) {
    return axios.get(`${baseURL}/class/${id}/sign_ins?index=${offset || 0}&limit=${limit || 10}&before=${before}`).then((rsp) => rsp.data);
  }
  return axios.get(`${baseURL}/class/${id}/sign_ins?index=${offset || 0}&limit=${limit || 10}`).then((rsp) => rsp.data);
}

export function importUser(file) {
  const formData = new FormData();
  formData.append('file', file, { type: 'text/csv' });
  return axios.post(`${baseURL}/users`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((rsp) => rsp.data);
}

export function deleteUser(id) {
  return axios.delete(`${baseURL}/user/${id}`).then((rsp) => rsp.data);
}

export function importClass(file) {
  const formData = new FormData();
  formData.append('file', file, { type: 'text/csv' });
  return axios.post(`${baseURL}/classes`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((rsp) => rsp.data);
}
