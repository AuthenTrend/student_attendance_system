<template lang="pug">
#content.new-key
  .title.row(v-if="inProfile")
    template
      span.click-button.link(@click="goProfile()") {{ $t('page.profile') }}
      .seperator
      span {{ $t('user.add_security_key') }}
  .title.row(v-else)
    template(v-if="!firstLogin")
      span.click-button.link(@click="goUsers()") {{ $t('page.users') }}
      .seperator
      span.click-button.link(@click="goUser()") {{ username }}
      .seperator
      span {{ $t('user.add_security_key') }}
    template(v-else)
      span {{ $t('fido.security_key_setting') }}
  .block
    .block-row(v-if="firstLogin")
      span {{ $t('user.first_add_key_desc') }}
    .block-row(v-if="keyID !== ''")
      .label {{ $t('general.security_key_name') }}
      .value
        //- span {{ name }}
        input(v-model="name")
    .block-row(v-if="firstLogin")
      text-button(v-if="fido === undefined", @click="newKey") {{ $t('user.add_security_key') }}
    .block-row(v-else)
      text-button(v-if="needRecheck", @click="newKey") {{ $t('user.get_security_key_again') }}
    .block-row
      text-button(@click="saveKey", v-if="fido !== undefined && !needRecheck")
        span {{ $t('general.save') }}
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import {
  getUser, addUserKey, getMakeChallenge, updateKeyName,
} from '@/utils/api';
import { create as FIDOCreate, get as FIDOGet } from '@/utils/fido';

export default {
  props: {
    id: {
      required: true,
    },
  },
  data() {
    return {
      name: '',
      fido: undefined,
      needRecheck: false,
      keyID: '',
      userID: '',
      inProfile: false,
      username: '',
    };
  },
  computed: {
    ...mapState(['firstLogin', 'currentUser']),
  },
  methods: {
    ...mapMutations(['setFirstLogin']),
    goUsers() {
      this.$router.push({ name: 'Users' });
    },
    goUser() {
      this.$router.push({ name: 'User', params: { id: this.userID } });
    },
    goProfile() {
      this.$router.push({ name: 'Profile' });
    },
    saveKey() {
      const that = this;
      updateKeyName(that.userID, that.keyID, that.name)
        .then(() => {
          that.$notify({
            group: 'attendance',
            title: that.$t('fido.create_key_success'),
            type: 'success',
            text: that.$t('fido.update_key_name', { name: that.name }),
          });
          if (!that.firstLogin) {
            that.$router.go(-1);
          } else {
            that.setFirstLogin(false);
            that.$router.push('/classes');
          }
        })
        .catch(() => {
          that.$notify({
            group: 'attendance',
            title: that.$t('fido.create_key_success'),
            type: 'warning',
            text: that.$t('fido.update_key_name_fail', { name: that.name }),
          });
        });
    },
    newKey() {
      const that = this;
      let challenge = '';
      let excludeCredentials = [];
      let user = {};
      that.$startLoading();
      getUser(that.userID)
        .then((r) => {
          user = r.result;
          that.username = user.name;
        })
        .then(() => getMakeChallenge(that.userID))
        .then((d) => {
          challenge = d.result.challenge;
          excludeCredentials = d.result.excludeCredentials;
        })
        .then(() => FIDOCreate(that.userID, that.userID, user.name, challenge, excludeCredentials)
          .catch((e) => {
            console.log(e.code);
            const errMsg = e.code === 11 ? that.$t('fido.already_existed_err') : e.toString();
            if (e.code !== 0) {
              that.$notify({
                group: 'attendance',
                title: that.$t('fido.create_key_error'),
                type: 'error',
                text: errMsg,
              });
            }
            throw e;
          }))
        .then((d) => {
          console.log(d);
          that.fido = d;
          that.$startLoading();
        })
        .then(() => addUserKey(that.userID, that.fido)
          .catch((e) => {
            console.log(e.response);
            that.$notify({
              group: 'attendance',
              title: that.$t('fido.create_key_error'),
              type: 'error',
              text: e.response.data.error,
            });
            throw e;
          }))
        .then((d) => {
          that.keyID = d.result.id;
          that.name = d.result.name;
          that.needRecheck = false;
        })
        .catch((e) => {
          console.log(e);
          if (e.response && e.response.data && e.response.data.error === 'not_find_user') {
            that.$router.push({ name: 'Profile' });
          }
          that.needRecheck = true;
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    useExistedKey() {
      const that = this;
      getUser(this.userID)
        .then(() => FIDOGet())
        .then((d) => {
          console.log(d);
          that.fido = d;
        })
        .catch((e) => {
          console.log(e);
        });
    },
  },
  mounted() {
    this.userID = this.id;
    if (this.userID === '') {
      this.userID = this.currentUser;
      this.inProfile = true;
    }
    if (!this.firstLogin) {
      this.newKey();
    }
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.title {
  &.row {
    display: flex;
    .link {
      text-decoration: underline;
      color: $active-color;
    }
    .seperator {
      &::before {
        content: ">";
        padding: 0 8px;
      }
    }
  }
}

.block {
  padding: 20px;
  display: flex;
  flex-direction: column;

  .block-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    .label {
      margin-right: 8px;
    }
    .text-button {
      margin-right: 8px;
    }
  }
}
</style>
