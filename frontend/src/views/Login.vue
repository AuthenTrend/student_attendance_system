<template lang="pug">
.login
  .login-form
    .logo {{ $t('system.name') }}
    .input-area
      template(v-if="accountMode")
        .login-row
          input(v-model="account", :placeholder="$t('general.account')")
        .login-row
          input(
            v-if="!showPassword",
            v-model="password",
            type="password",
            name="password",
            :placeholder="$t('general.password')"
          )
          input(
            v-else,
            v-model="password",
            name="password",
            :placeholder="$t('general.password')"
          )
          .toggle-password
            icon(
              v-if="!showPassword",
              icon-type="show_password",
              :size="16",
              @click="showPassword = true"
            )
            icon(
              v-else,
              icon-type="hide_password",
              :size="16",
              @click="showPassword = false"
            )
        .login-row(v-if="errMsg !== ''")
          .error-msg {{ errMsg }}
        .login-row
          dropdown-select(
            :options="languageOptions",
            v-model="language",
            @input="changeLocale"
          )
        .login-row.operation
          text-button.login-btn(button-type="primary", @click="doLogin") {{ $t('general.login') }}
          text-button(@click="cancel") {{ $t('general.cancel') }}
      template(v-else)
        .login-row
          img.fido-login(:src="imgSrc", @click="loginWithFIDO")
        .login-row
          dropdown-select.lang-selector(
            :options="languageOptions",
            v-model="language",
            @input="changeLocale"
          )
        .login-row
          .text-link(@click="accountMode = true") {{ $t('user.login_with_account') }}
</template>

<script>
import { mapMutations, mapActions } from 'vuex';
import { login, FIDOLogin, getUser } from '@/utils/api';
import { get as getFIDO } from '@/utils/fido';
import FIDOLoginImg from '@/assets/images/loginwithfido.png';

export default {
  data() {
    return {
      imgSrc: FIDOLoginImg,
      accountMode: false,
      errMsg: '',

      account: '',
      password: '',
      languageOptions: [
        {
          text: 'English',
          value: 'en',
        },
        {
          text: 'Japanese',
          value: 'jp',
        },
      ],
      showPassword: false,
      language: ['en'],
    };
  },
  methods: {
    ...mapActions(['setCurrentUserID']),
    ...mapMutations(['setToken', 'setPage', 'setFirstLogin']),
    changeLocale(value) {
      if (value.length) {
        [this.$i18n.locale] = value;
        localStorage.setItem('locale', this.$i18n.locale);
      }
    },
    cancel() {
      this.accountMode = false;
      this.account = '';
      this.password = '';
    },
    loginWithFIDO() {
      const that = this;
      getFIDO()
        .then((d) => {
          that.$startLoading();
          return FIDOLogin(d);
        })
        .then((data) => that.setCurrentUserID(data.result.uid))
        .then((data) => {
          that.setTokenFromCookie();
          that.$cookies.set('user', data.result.id);
          that.$router.push('/classes');
          return getUser(data.result.id);
        })
        .catch((e) => {
          // show all error information in loginWithFIDO
          that.$notify({
            group: 'attendance',
            title: that.$t('error.login_fail'),
            type: 'error',
            text: that.$t(`error.${e.response.data.error}`),
          });
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    doLogin() {
      const that = this;
      that.$startLoading();
      let isFirstLogin = false;
      login(that.account, that.password)
        .then((data) => {
          isFirstLogin = data.result.isFirstLogin;
          return that.setCurrentUserID(data.result.uid);
        })
        .then((data) => {
          that.$endLoading();
          that.setTokenFromCookie();
          that.$cookies.set('user', data.result.id);
          if (isFirstLogin) {
            that.setFirstLogin(true);
            that.$router.push({ name: 'ChangePassword' });
          } else {
            that.$router.push('/classes');
          }
        })
        .catch((e) => {
          if (e.response.data.error === 'user_not_allowed_auth') {
            that.$notify({
              group: 'attendance',
              title: that.$t('general.login_fail'),
              type: 'error',
              text: that.$t(`error.${e.response.data.error}`),
            });
          } else {
            that.$notify({
              group: 'attendance',
              title: that.$t('error.login_fail'),
              type: 'error',
            });
          }
          that.$endLoading();
        });
    },
    setTokenFromCookie() {
      const secret = this.$cookies.get('sd');
      const token = this.$cookies.get('ut');
      this.setToken({ secret, token });
    },
  },
  mounted() {
    this.setToken({ secret: '', token: '' });
    this.language = [this.$i18n.locale];
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.login {
  display: flex;
  align-items: center;
  justify-content: center;

  background-image: url("/img/login_bg.png") !important;
  background-position: center !important;
  background-size: cover !important;
  .login-form {
    padding: 20px 40px;
    background-color: rgba(51, 51, 51, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;

    .logo {
      color: white;
      text-align: center;
      font-size: 20px;
      height: 80px;
      line-height: 80px;
    }
    .fido-login {
      cursor: pointer;
      user-select: none;
      display: block;
      margin: auto;
      &:hover {
        transform: scale(1.05);
        transition: transform 0.25s ease-in-out;
      }
    }
    .text-link {
      cursor: pointer;
      user-select: none;
      // color: $color-primary;
      text-decoration: underline;
      font-size: 12px;
    }
    .login-btn {
      margin-right: 8px;
      border: none;
    }
    .login-row {
      position: relative;
      margin-bottom: 8px;
      .dropdown-container {
        width: 200px;
        margin: auto;
        margin-bottom: 20px;
      }
      &.operation {
        margin-top: 20px;
      }
      .error-msg {
        color: $color-error;
        font-size: 12px;
      }
      input {
        width: 200px;
        box-sizing: border-box;
        display: block;
        margin-left: auto;
        margin-right: auto;
      }
      input[name="password"] {
        padding-right: 24px;
      }
      .toggle-password {
        position: absolute;
        top: 2px;
        right: 16px;
      }
    }
  }
}
</style>
