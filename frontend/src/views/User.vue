<template>
  <div class="user">
    <div class="title row">
      <span
        class="link click-button"
        @click="goUsers"
      >{{ $t('page.users') }}</span>
      <div class="seperator"></div>
      <span>{{ info.name }}</span>
    </div>
    <div class="row">
      <text-button @click="$router.push({ name: 'Users' })">
        <span>{{ $t('general.back_list') }}</span>
      </text-button>
    </div>
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
          v-if="currentPage === 'keys'"
        >
          <text-button @click="$router.push({ name: 'UserNewKey' })">
            <span>{{ $t('user.add_security_key') }}</span>
          </text-button>
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
                v-if="rawInfo.type === 2"
              >{{ $t('general.class') }}</div>
              <div
                class="used-key"
                v-if="rawInfo.type !== 1"
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
                v-if="rawInfo.type === 2"
              >
                {{ data.class }}
              </div>
              <div
                class="used-key"
                v-if="rawInfo.type !== 1"
              >
                {{ data.key_use_boolean }}
              </div>
              <div class="ip">
                {{ data.ip }}
              </div>
            </div>
          </div>
        </div>
        <div
          class="session-page"
          v-else-if='currentPage === "classes"'
        >
          <div class="list-container">
            <div class="header l-row">
              <div class="no">{{ $t('class.class_no') }}</div>
              <div class="name">{{ $t('class.name') }}</div>
            </div>
            <div
              class="list l-row"
              v-for="data in classInfos"
              :key="data.class_no"
            >
              <div class="no">
                {{ data.class_no }}
              </div>
              <div class="name">
                {{ data.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  getUser, getUserKeys, getUserRecords, deleteUserKey,
} from '@/utils/api';
import LabelSwitch from '@/components/LabelSwitch.vue';
import { datetimeToString } from '@/utils/format';
import misc from '@/utils/misc';
import Check from '@/components/forms/Check.vue';
import { userRecordColumnList } from '@/utils/constant';

export default {
  props: {
    id: {
      type: String,
    },
  },
  components: {
    'label-switch': LabelSwitch,
  },
  data() {
    return {
      info: {
        name: '',
        type: '',
      },
      rawInfo: {},
      userType: 0,
      currentPage: 'keys',
      pageOption: [
        {
          val: 'keys',
          text: this.$t('general.security_key'),
        }],
      keys: [
        // {
        //   id: 1,
        //   name: 'Fingerprint',
        //   create_time: '2020/10/30 10:01:10',
        // },
        // {
        //   id: 2,
        //   name: 'NFC Check',
        //   create_time: '2020/10/28 10:01:10',
        // },
      ],
      records: [],
      recordLimit: 30,
      recordNum: 0,
      classInfos: [
        // {
        //   name: 'ﾌﾚｯｼｭﾏﾝｾﾐﾅｰ',
        //   class_no: 'SEM100J',
        // },
        // {
        //   name: 'English',
        //   class_no: 'SEM101J',
        // },
      ],
    };
  },
  methods: {
    goUsers() {
      this.$router.push({ name: 'Users' });
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
            deleteUserKey(this.id, c.id)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.delete_success'),
                  type: 'success',
                });
                that.loadUser();
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
    downloadRecords() {
      const that = this;
      that.$startLoading();
      getUserRecords(that.id)
        .then((rsp) => {
          const records = rsp.result;
          records.forEach((r) => {
            r.timeStr = datetimeToString(r.time);
            r.key_use_boolean = r.key_use === 'FIDO Key' ? 'Yes' : 'No';
          });
          let output = '\ufeff';
          const columns = userRecordColumnList[that.rawInfo.type] || [];
          output += columns.map((col) => that.$t(col.labelKey)).join(',');
          output += '\n';

          records.forEach((r) => {
            output += columns.map((col) => r[col.valueKey] || '').join(',');
            output += '\n';
          });
          const data = new Blob([output], { type: 'text/csv' });
          misc.downloadRawFile(data, `${that.id}_record.csv`);
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    expandRow(row) {
      this.sessions.forEach((s) => {
        s.expand = false;
      });
      row.expand = true;
    },
    loadUser() {
      const that = this;
      that.$startLoading();
      return getUser(that.id)
        .then((rsp) => {
          const d = rsp.result;
          that.info = {
            name: d.name || 'Name',
            id: d.id,
          };
          that.rawInfo = d;
          that.classInfos = rsp.result.classes;
          switch (d.type) {
            case 0:
              that.info.type = that.$t('general.admin');
              break;
            case 1:
              that.info.type = that.$t('general.teacher');
              break;
            case 2:
              that.info.type = that.$t('general.student');
              break;
            default:
          }
        })
        .then(() => getUserRecords(that.id))
        .then((rsp) => {
          that.recordNum = rsp.result.length;
          that.records = rsp.result.slice(0, that.recordLimit);
          that.records.forEach((r) => {
            r.timeStr = datetimeToString(r.time);
            r.key_use_boolean = r.key_use === 'FIDO Key' ? 'Yes' : 'No';
          });
        })
        .then(() => getUserKeys(that.id))
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
    setupPage() {
      const that = this;
      const d = that.rawInfo;
      console.log(d);
      that.pageOption.push(
        {
          val: 'records',
          text: this.$t('general.login_record'),
        },
      );
      if (d.type !== 0) {
        that.pageOption.push(
          {
            val: 'classes',
            text: this.$t('signin.classes'),
          },
        );
      }
    },
  },
  mounted() {
    const that = this;
    that.loadUser()
      .then(() => that.setupPage());
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
        flex: 0 0 100px;
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
      .no {
        flex: 0 0 120px;
      }
      .name {
        flex: 0 0 140px;
      }
      .time {
        flex: 0 0 160px;
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
