<template lang="pug">
.classes
  .title.row {{ $t('page.classes') }}
  .row
    text-button(
      button-type="primary",
      @click="addClass"
      v-if="userInfo && userInfo.type !== 2"
    ) {{ $t('class.add_class') }}
    text-button(
      button-type="primary",
      @click="importClass",
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
        .t-cell.late_time {{ $t('class.lateAfter') }}
        .t-cell.absent_time {{ $t('class.absenceAfter') }}
        .t-cell.actions {{ $t('general.actions') }}
      .t-row(v-for="c in classes", :key="c.no")
        .t-cell.category {{ c.category }}
        .t-cell.campus {{ c.campusName }}
        .t-cell.day {{ c.day }}
        .t-cell.period {{ c.showPeriod }}
        .t-cell.no
          span {{ c.id }}
        .t-cell.name {{ c.name }}
        .t-cell.teacher {{ c.teacherName }}
        .t-cell.late_time {{ c.lateAfter }}
        .t-cell.absent_time {{ c.absenceAfter }}
        .t-cell.actions
          .text-link(@click="$router.push(`/class/${c.id}`)") {{ $t('general.view') }}
          .text-link.danger(
            @click="popDeleteClass(c)"
            v-if="userInfo && userInfo.type !== 2"
          ) {{ $t('general.delete') }}
</template>

<script>
import { mapState } from 'vuex';
import {
  getClasses, getCampuses, deleteClass, importClass,
} from '@/utils/api';
import { paddingNumToTwo, getDateTextKey } from '@/utils/format';
import FileForm from '@/components/forms/FileForm.vue';
import Check from '@/components/forms/Check.vue';

export default {
  data() {
    return {
      classes: [],
      headers: [
        {
          labelKey: 'class.category', class: 'category', key: 'category', sorting: undefined,
        },
        {
          labelKey: 'class.campusName', class: 'campus', key: 'campusName', sorting: undefined,
        },
        {
          labelKey: 'class.day', class: 'day', key: 'day', sorting: undefined,
        },
        {
          labelKey: 'class.period', class: 'period', key: 'showPeriod', sorting: undefined,
        },
        {
          labelKey: 'class.class_no', class: 'no', key: 'id', sorting: undefined,
        },
        {
          labelKey: 'class.name', class: 'name', key: 'name', sorting: undefined,
        },
        {
          labelKey: 'class.teacherName', class: 'teacher', key: 'teacherName', sorting: undefined,
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
      const temp = JSON.parse(JSON.stringify(that.classes));

      temp.sort((a, b) => {
        const bigger = header.sorting ? 1 : -1;
        return a[header.key] > b[header.key] ? bigger : bigger * -1;
      });
      that.classes = temp;

      that.$forceUpdate();
    },
    importClass() {
      const that = this;
      that.$root.$emit('pop-window', {
        component: FileForm,
        ok_msg: that.$t('general.upload'),
        cancel_msg: that.$t('general.cancel'),
        callback: {
          ok: (file) => {
            that.$startLoading();
            importClass(file)
              .then((rsp) => {
                console.log(rsp);
                const { total } = rsp.result;
                const { fail } = rsp.result;
                const msgKey = fail === 0 ? 'class.import_success_msg' : 'class.import_fail_msg';
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
                that.loadClasses();
              });
          },
        },
        title: that.$t('class.import_class'),
        validate: true,
        clickOutsideClose: false,
      });
    },
    popDeleteClass(c) {
      console.log(c);
      const that = this;
      const msg = that.$t('class.delete_class_msg', { name: c.name });
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
            deleteClass(c.id)
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.delete_success'),
                  type: 'success',
                });
              })
              .finally(() => {
                that.loadClasses();
              });
          },
        },
        title: that.$t('class.delete_class'),
        validate: false,
        clickOutsideClose: false,
      });
    },
    addClass() {
      const that = this;
      that.$router.push({ name: 'NewClass', params: { id: '' } });
    },
    loadClasses() {
      const that = this;
      let datas = [];

      that.$startLoading();
      getClasses()
        .then((data) => {
          datas = data.result.map((d) => ({
            ...d,
            day: that.$t(getDateTextKey(d.date)),
          }));
          datas.forEach((d) => {
            d.actions = [
              'view',
              'delete',
            ];
          });
        })
        .then(() => getCampuses()
          .then((data) => {
            const compuses = data.result;
            const campusMap = {};
            compuses.forEach((c) => {
              campusMap[c.name] = c;
            });
            datas.forEach((c) => {
              const campus = campusMap[c.campusName];
              const period = campus.periods[c.period - 1];
              c.showCampus = campus.name;
              c.showPeriod = `${c.period} - ${paddingNumToTwo(period.start_time.hour)}:${paddingNumToTwo(period.start_time.minute)}`;
            });
          })
          .catch(() => {
            console.log('Get campus info fail');
            datas.forEach((c) => {
              c.showCampus = c.campusName;
              c.showPeriod = c.period;
            });
          }))
        .then(() => {
          that.classes = datas;
        })
        .finally(() => {
          that.$endLoading();
        });
    },
  },
  mounted() {
    this.loadClasses();
  },
};
</script>

<style lang="scss" scoped>
@import "../assets/styles/variable.scss";
.block {
  @include auto-overflow();
  @include customScrollbar();
  .table {
    font-size: 12px;
    display: flex;
    flex-direction: column;
    .t-row {
      flex: 0 0 36px;
      line-height: 36px;
      &.header {
        .t-cell {
          background: #fcfcfc;
        }
      }
      .t-cell {
        border-bottom: 1px solid #e9e9e9;
        overflow: hidden;
        span {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
        }
      }

      display: flex;
      flex-direction: row;
      .category {
        flex: 0 0 120px;
      }
      .campus {
        flex: 0 0 120px;
      }
      .day {
        flex: 0 0 88px;
      }
      .period {
        flex: 0 0 80px;
      }
      .no {
        flex: 0 0 120px;
      }
      .name {
        flex: 0 0 120px;
      }
      .teacher {
        flex: 0 0 120px;
      }
      .late_time {
        flex: 0 0 80px;
      }
      .absent_time {
        flex: 0 0 100px;
      }
      .actions {
        flex: 1 0 100px;
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
