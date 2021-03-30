<template lang="pug">
.users
  .title.row {{ $t('page.users') }}
  .row
    text-button(button-type="primary", @click="addUser") {{ $t('user.add_user_btn') }}
    text-button(
      button-type="primary",
      @click="importUsers",
      v-if="userInfo && userInfo.type === 0"
    ) {{ $t('general.import') }}
  .block
    .table
      .t-row.header
        .t-cell.sortable(
          v-for="header in headers",
          :class="header.class",
          @click="sort(header)"
        )
          .tr-title {{ $t(header.labelKey) }}
          .tr-sort
            template(v-if="header.sorting === undefined") ⇅
            template(v-else-if="header.sorting") ↓
            template(v-else) ↑
        .t-cell.actions {{ $t('general.actions') }}
      .t-row(v-for="user in users", :key="user.studentID")
        .t-cell.name {{ user.username }}
        .t-cell.name {{ user.id }}
        .t-cell.type
          span(v-if="user.allowAccountLogin !== undefined") {{ $t('general.admin') }}
          span(v-else-if="user.type === 1") {{ $t('general.teacher') }}
          span(v-else-if="user.type === 2") {{ $t('general.student') }}
        .t-cell.actions
          .text-link(@click="$router.push(`/user/${user.id}`)") {{ $t('general.view') }}
          .text-link.danger(
            v-if="user.type !== 'admin' && user.type !== 0",
            @click="popDeleteUser(user)"
          )
            span {{ $t('general.delete') }}
</template>

<script>
import { mapState } from 'vuex';
import {
  getUsers, addUser, importUser, deleteUser,
} from '@/utils/api';
import UserForm from '@/components/forms/UserForm.vue';
import FileForm from '@/components/forms/FileForm.vue';
import Check from '@/components/forms/Check.vue';

export default {
  data() {
    return {
      users: [],
      headers: [
        {
          labelKey: 'general.name', class: 'name', key: 'username', sorting: undefined,
        },
        {
          labelKey: 'general.id', class: 'name', key: 'id', sorting: undefined,
        },
        {
          labelKey: 'user.info_type', class: 'type', key: 'type', sorting: undefined,
        },
      ],
    };
  },
  computed: {
    ...mapState(['userInfo']),
  },
  methods: {
    sort(header) {
      const that = this;
      if (header.sorting !== undefined) {
        header.sorting = !header.sorting;
      } else {
        header.sorting = true;
      }
      that.headers.forEach((h) => {
        if (h !== header) {
          h.sorting = undefined;
        }
      });
      const temp = JSON.parse(JSON.stringify(that.users));

      temp.sort((a, b) => {
        const bigger = header.sorting ? 1 : -1;
        return a[header.key] > b[header.key] ? bigger : bigger * -1;
      });
      that.users = temp;

      that.$forceUpdate();
    },
    addUser() {
      const that = this;
      that.$root.$emit('pop-window', {
        component: UserForm,
        ok_msg: that.$t('general.add'),
        cancel_msg: that.$t('general.cancel'),
        data: {

        },
        callback: {
          ok: (c) => {
            addUser(c)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.update_success'),
                  type: 'success',
                });
              })
              .catch((e) => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('user.add_user_fail'),
                  type: 'error',
                  text: that.$t(`error.${e.response.data.error}`),
                });
              })
              .then(() => that.loadUsers());
          },
        },
        title: that.$t('user.add_user'),
        validate: true,
        clickOutsideClose: true,
      });
    },
    loadUsers() {
      const that = this;
      that.$startLoading();
      return getUsers()
        .then((data) => {
          that.users = data.result.map((d) => {
            const ret = {
              ...d,
            };
            if (d.allowAccountLogin !== undefined) {
              ret.type = 0;
            }
            return ret;
          });
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    importUsers() {
      const that = this;
      that.$root.$emit('pop-window', {
        component: FileForm,
        ok_msg: that.$t('general.upload'),
        cancel_msg: that.$t('general.cancel'),
        callback: {
          ok: (file) => {
            that.$startLoading();
            importUser(file)
              .then((rsp) => {
                console.log(rsp);
                const { total } = rsp.result;
                const { fail } = rsp.result;
                const msgKey = fail === 0 ? 'user.import_success_msg' : 'user.import_fail_msg';
                that.$notify({
                  group: 'attendance',
                  title: fail === 0 ? that.$t('general.success') : that.$t('general.result'),
                  type: fail === 0 ? 'success' : 'warn',
                  text: that.$t(msgKey, { total, fail }),
                });
              })
              .catch((e) => {
                const errMsgValid = that.$te(`error.${e.response.data.error}`);
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.update_fail'),
                  type: 'error',
                  text: errMsgValid ? that.$t(`error.${e.response.data.error}`) : e.response.data.error,
                });
              })
              .finally(() => {
                that.$endLoading();
                that.loadUsers();
              });
          },
        },
        title: that.$t('user.import_user'),
        validate: true,
        clickOutsideClose: false,
      });
    },
    popDeleteUser(c) {
      console.log(c);
      const that = this;
      const msg = that.$t('user.delete_user_msg', { name: c.username });
      that.$root.$emit('pop-window', {
        component: Check,
        ok_msg: that.$t('general.delete'),
        cancel_msg: that.$t('general.cancel'),
        extData: {
          msg,
        },
        callback: {
          ok: () => {
            deleteUser(c.id)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.delete_success'),
                  type: 'success',
                });
              })
              .finally(() => {
                that.loadUsers();
              });
          },
        },
        title: that.$t('user.delete_user'),
        validate: false,
        clickOutsideClose: false,
      });
    },
  },
  mounted() {
    this.loadUsers();
  },
};
</script>

<style lang="scss" scoped>
@import "../assets/styles/variable.scss";
.block {
  .table {
    font-size: 12px;
    display: flex;
    flex-direction: column;
    .t-row {
      flex: 0 0 36px;
      line-height: 36px;
      &.header {
        background: #fcfcfc;
      }
      border-bottom: 1px solid #e9e9e9;

      display: flex;
      flex-direction: row;
      .name {
        flex: 0 0 120px;
      }
      .type {
        flex: 0 0 120px;
      }
      .actions {
        flex: 1;
        .text-link {
          margin-right: 8px;
          color: $color-primary;
          display: inline-block;
          text-decoration: underline;
          &.danger {
            color: $color-error;
          }
          user-select: none;
          cursor: pointer;
        }
      }
      .t-cell {
        padding-left: 20px;
        display: flex;
        align-items: baseline;
        .tr-sort {
          margin-left: 8px;
        }
        &.sortable {
          user-select: none;
          cursor: pointer;
        }
      }
    }
  }
}
</style>
