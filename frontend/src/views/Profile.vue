<template>
  <div
    class="profile"
    id="content"
  >
    <div class="title row">{{ $t('page.profile') }}</div>
    <div class="block">
      <div class="session">
        <div class="session-title">{{ $t('user.user_information') }}</div>
        <div class="information">
          <div
            class="info-row"
            v-for="key in Object.keys(info)"
            :key="key"
          >
            <div class="name">{{ $t(`user.info_${key}`) }}</div>
            <div class="value">{{ info[key] }}</div>
          </div>
          <div
            class="info-row"
            v-if="userType === 0"
          >
            <div class="name">{{ $t('user.info_password')}}</div>
            <text-button @click="changePassword"> {{ $t('user.chagne_password') }} </text-button>
          </div>
        </div>
      </div>
      <div class="session">
        <label-switch
          class="switch"
          :options="pageOption"
          v-model="currentPage"
        />
        <div
          class="session-page"
          v-if='currentPage === "keys"'
        >
          <text-button @click="$router.push({ name: 'ProfileNewkey', params: {id: ''} })">
            {{ $t('user.add_security_key') }}</text-button>
          <div class="list-container">
            <div class="header l-row">
              <div class="name">{{ $t('general.security_key_name') }}</div>
              <div class="time">{{ $t('general.add_time') }}</div>
              <div class="actions">{{ $t('general.actions') }}</div>
            </div>
            <div
              class="list l-row"
              v-for="key in keys"
              :key="key.id"
            >
              <div class="name">
                {{ key.name }}
              </div>
              <div class="time">
                {{ key.create_time }}
              </div>
              <div class="actions">
                <div
                  class="text-link"
                  @click="popEditKey(key)"
                >{{ $t('general.edit') }}</div>
                <div
                  class="text-link"
                  @click="popDeleteKey(key)"
                >{{ $t('general.delete') }}</div>
              </div>
            </div>
          </div>
        </div>

        <div
          class="session-page"
          v-else-if='currentPage === "records"'
        >
          <text-button @click="downloadRecords">{{ $t('general.export_record') }}</text-button>
          <div
            class="desc"
            v-if="recordNum > recordLimit"
          >
            {{ $t('user.too_many_record', {num: recordNum, limit: recordLimit}) }}
          </div>
          <div class="list-container">
            <div class="header l-row">
              <div class="time">{{ $t('general.time') }}</div>
              <div
                class="class"
                v-if="userType === 2"
              >{{ $t('general.class') }}</div>
              <div
                class="used-key"
                v-if="userType !== 1"
              >{{ $t('general.key_used') }}</div>
              <div class="ip">{{ $t('general.ip') }}</div>
            </div>
            <div
              class="list l-row"
              v-for="data in records"
              :key="data.time"
            >
              <div class="time">
                {{ data.timeStr }}
              </div>
              <div
                class="class"
                v-if="userType === 2"
              >
                {{ data.class }}
              </div>
              <div
                class="used-key"
                v-if="userType !== 1"
              >
                {{ data.key_use_boolean }}
              </div>
              <div class="ip">
                {{ data.ip }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import {
  getUser, getUserKeys, getUserRecords, updateUser, deleteUserKey, updateKeyName,
} from '@/utils/api';
import { datetimeToString } from '@/utils/format';
import PasswordChangeForm from '@/components/forms/PasswordChangeForm.vue';
import Check from '@/components/forms/Check.vue';
import InputForm from '@/components/forms/InputForm.vue';
import misc from '@/utils/misc';
import { userRecordColumnList } from '@/utils/constant';

const typeNameKey = {
  0: 'general.admin',
  1: 'general.teacher',
  2: 'general.student',
};

export default {
  data() {
    return {
      info: {
        name: '',
        type: '',
      },
      userType: 0,
      currentPage: 'keys',
      pageOption: [],
      keys: [],
      user: {},
      records: [],
      recordLimit: 30,
      recordNum: 0,
      uiSet: false,
    };
  },
  computed: {
    ...mapState(['currentUser']),
  },
  watch: {
    currentUser() {
      this.loadUserInfo();
    },
  },
  methods: {
    downloadRecords() {
      const that = this;
      that.$startLoading();
      getUserRecords(that.currentUser)
        .then((rsp) => {
          const records = rsp.result;
          records.forEach((r) => {
            r.timeStr = datetimeToString(r.time);
            r.key_use_boolean = r.key_use === 'FIDO Key' ? 'Yes' : 'No';
          });
          let output = '\ufeff';
          const columns = userRecordColumnList[that.userType] || [];
          output += columns.map((col) => that.$t(col.labelKey)).join(',');
          output += '\n';

          records.forEach((r) => {
            output += columns.map((col) => r[col.valueKey] || '').join(',');
            output += '\n';
          });
          const data = new Blob([output], { type: 'text/csv' });
          misc.downloadRawFile(data, `${that.currentUser}_record.csv`);
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    saveKey(userID, keyID, name) {
      const that = this;
      return updateKeyName(userID, keyID, name)
        .then(() => {
          that.$notify({
            group: 'attendance',
            title: that.$t('user.update_key'),
            type: 'success',
            text: that.$t('fido.update_key_name', { name }),
          });
        });
    },
    popEditKey(c) {
      const that = this;
      that.$root.$emit('pop-window', {
        component: InputForm,
        ok_msg: that.$t('general.save'),
        cancel_msg: that.$t('general.cancel'),
        extData: {
          title: that.$t('general.name'),
          data: c.name,
        },
        callback: {
          ok: (value) => {
            console.log(value);
            this.saveKey(this.currentUser, c.id, value)
              .then(() => {
                c.name = value;
              })
              .catch(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('user.update_key'),
                  type: 'warning',
                  text: that.$t('fido.update_key_name_fail', { value }),
                });
              });
          },
        },
        title: that.$t('user.update_key'),
        validate: true,
        clickOutsideClose: false,
      });
    },
    popDeleteKey(c) {
      console.log(c);
      const that = this;
      const msg = that.$t('user.delete_key_msg', { name: c.name });
      that.$root.$emit('pop-window', {
        component: Check,
        ok_msg: that.$t('general.delete'),
        cancel_msg: that.$t('general.cancel'),
        extData: {
          msg,
        },
        callback: {
          ok: () => {
            console.log('ok');
            deleteUserKey(this.currentUser, c.id)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.delete_success'),
                  type: 'success',
                });
                that.loadUserInfo();
              })
              .catch((e) => {
                this.$notify({
                  group: 'attendance',
                  title: this.$t('general.update_fail'),
                  type: 'warn',
                  text: e.response.data.message,
                });
              });
          },
        },
        title: that.$t('user.delete_key'),
        validate: false,
        clickOutsideClose: false,
      });
    },
    changePassword() {
      const that = this;
      that.$root.$emit('pop-window', {
        component: PasswordChangeForm,
        ok_msg: that.$t('general.save'),
        cancel_msg: that.$t('general.cancel'),
        callback: {
          ok: (c) => {
            const updatedUser = JSON.parse(JSON.stringify(that.user));
            updatedUser.password = c.password;
            that.$startLoading();
            console.log(updatedUser);
            updateUser(updatedUser)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('user.update_password_success'),
                  type: 'success',
                });
              })
              .catch((e) => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('user.update_password_fail'),
                  type: 'error',
                  text: e.toString(),
                });
                that.changePassword();
              })
              .finally(() => {
                that.$endLoading();
                that.loadUserInfo();
              });
          },
        },
        title: that.$t('user.chagne_password'),
        validate: true,
        clickOutsideClose: false,
      });
    },
    expandRow(row) {
      this.sessions.forEach((s) => {
        s.expand = false;
      });
      row.expand = true;
    },
    loadUserInfo() {
      const that = this;
      if (!that.currentUser) {
        return;
      }
      that.$startLoading();
      getUser(this.currentUser)
        .then((data) => {
          that.user = data.result;
          that.userType = data.result.type;
          that.info = {
            name: data.result.name,
            id: data.result.id,
            type: that.$t(typeNameKey[data.result.type]),
          };
          if (that.userType === 2) {
            that.currentPage = 'records';
          } else if (!that.uiSet) {
            that.pageOption.push({
              val: 'keys',
              text: this.$t('general.security_key'),
            });
          }
          if (!that.uiSet) {
            that.pageOption.push({
              val: 'records',
              text: this.$t('general.login_record'),
            });
            that.uiSet = true;
          }
        })
        .then(() => getUserRecords(that.currentUser))
        .then((rsp) => {
          that.recordNum = rsp.result.length;
          that.records = rsp.result.slice(0, that.recordLimit);
          that.records.forEach((r) => {
            r.timeStr = datetimeToString(r.time);
            r.key_use_boolean = r.key_use === 'FIDO Key' ? 'Yes' : 'No';
          });
        })
        .then(() => getUserKeys(this.currentUser))
        .then((data) => {
          that.keys = data.result.map((r) => ({
            id: r.id,
            name: r.name,
            create_time: datetimeToString(parseInt(r.create_time, 10)),
          }));
        })
        .finally(() => {
          that.$endLoading();
        });
    },
  },
  mounted() {
    this.loadUserInfo();
  },
};
</script>

<style lang="scss" scoped>
@import "../assets/styles/variable.scss";
.block {
  @include auto-overflow();
  @include customScrollbar();
  display: flex;
  flex-direction: column;
  .session {
    flex: 0 0 auto;
  }
}
.session {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  .session-title {
    font-weight: bold;
    padding: 8px 20px;
  }
  .information {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0px 20px;

    .info-row {
      display: flex;
      align-items: center;
      flex: 0 0 40px;
      padding: 8px 20px;
      .name {
        flex: 0 0 120px;
        text-align: right;
        padding-right: 20px;
      }
      .value {
        flex: 1;
      }
    }
  }

  .switch {
    margin: 0 20px;
  }
  .session-page {
    flex: 1;
    padding: 20px;
    margin: 0px 20px;
    margin-top: -1px;
    border: 1px solid #e9e9e9;
    & > .text-button {
      margin-bottom: 8px;
    }
    .desc {
      font-size: 12px;
      margin-bottom: 8px;
    }
    .list-container {
      font-size: 12px;
      .header {
        border-bottom: 1px solid #e9e9e9;
      }
      .l-row {
        display: flex;
        align-items: center;
        padding: 8px 0px;
      }
      .name {
        flex: 0 0 140px;
      }
      .time {
        flex: 0 0 150px;
      }
      .class {
        flex: 0 0 120px;
      }
      .ip {
        flex: 1;
      }
      .used-key {
        flex: 0 0 200px;
      }
      .actions {
        flex: 1;
      }
      .actions {
        flex: 1;
        .text-link {
          margin-right: 8px;
          color: $color-primary;
          display: inline-block;
          text-decoration: underline;
          user-select: none;
          cursor: pointer;
        }
      }
    }
  }
}
</style>
