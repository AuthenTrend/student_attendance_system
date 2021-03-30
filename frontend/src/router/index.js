import Vue from 'vue';
import VueRouter from 'vue-router';

import Login from '../views/Login.vue';
import Classes from '../views/Classes.vue';
import Class from '../views/Class.vue';
import SignIn from '../views/SignIn.vue';
import NewClass from '../views/NewClass.vue';
import Users from '../views/Users.vue';
import User from '../views/User.vue';
import Profile from '../views/Profile.vue';
import NewKey from '../views/NewKey.vue';
import Periods from '../views/Periods.vue';
import ChangePassword from '../views/ChangePassword.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/periods',
    name: 'Periods',
    component: Periods,
  },
  {
    path: '/classes',
    name: 'Classes',
    component: Classes,
  },
  {
    path: '/new-class',
    name: 'NewClass',
    component: NewClass,
    props: true,
  },
  {
    path: '/class/:id',
    name: 'Class',
    component: Class,
    props: true,
  },
  {
    path: '/class/:id/edit',
    name: 'EditClass',
    component: NewClass,
    props: true,
  },
  {
    path: '/class/:id/signin/:session',
    name: 'SignIn',
    component: SignIn,
    props: true,
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
  },
  {
    path: '/user/:id',
    name: 'User',
    component: User,
    props: true,
  },
  {
    path: '/user/:id/newkey',
    name: 'UserNewKey',
    component: NewKey,
    props: true,
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
  },
  {
    path: '/profile/newkey',
    name: 'ProfileNewkey',
    component: NewKey,
    props: true,
  },
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: ChangePassword,
  },
];

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
});

export default router;
