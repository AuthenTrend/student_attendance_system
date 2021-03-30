import Vue from 'vue';
import Vuex from 'vuex';

import pageConfig from '../config/page';
import { getUser } from '../utils/api';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    token: '',
    secret: '',
    currentPage: pageConfig[0],
    firstLogin: false,
    currentUser: undefined,
    userInfo: undefined,
  },
  mutations: {
    setPage(s, page) {
      const keys = pageConfig.map((config) => config.key);
      if (keys.indexOf(page.key) >= 0) {
        s.currentPage = page;
      }
    },
    setToken(s, { token, secret }) {
      s.token = token;
      s.secret = secret;
    },
    setFirstLogin(s, v) {
      s.firstLogin = v;
    },
    setCurrentUser(s, user) {
      s.currentUser = user;
    },
  },
  actions: {
    setCurrentUserID({ state }, userID) {
      return getUser(userID).then((data) => {
        state.currentUser = userID;
        state.userInfo = data.result;
        return data;
      });
    },
  },
  getters: {
    isLogin(state) {
      return state.token !== '';
    },
    username: (s) => (s.userInfo ? s.userInfo.name : ''),
    currentUserType: (s) => {
      if (s.userInfo) {
        return s.userInfo.type;
      }
      return undefined;
    },
  },
  modules: {},
});
