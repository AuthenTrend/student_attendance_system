<template>
  <div class="classes">
    <div class="title row">{{ $t('campus.periods') }}</div>
    <div class="row">
      <text-button
        button-type="primary"
        @click="addCampus"
      >{{ $t('campus.add_campus') }}</text-button>
    </div>
    <div class="block">
      <div
        class="campus-block"
        v-for="campus in campuses"
        :key="campus.id"
      >
        <div class="campus-name click-button">
          <span> {{ campus.name }} </span>
          <icon
            icon-type="delete"
            :size="20"
            @click="deleteCampus(campus)"
          />
        </div>
        <div
          class="table"
          :class="{editing: editing}"
        >
          <div class="fix-column">
            <div class="t-cell header title">{{ $t('campus.period') }}</div>
            <div class="t-cell title">{{ $t('campus.start_time') }}</div>
            <div class="t-cell title">{{ $t('campus.end_time') }}</div>
          </div>
          <div class="scroll-column">
            <div
              class="scroll-column-inner"
              v-for="(period, idx) in campus.periods"
              :key="idx"
            >
              <div class="t-cell header period">
                <span>{{ idx + 1 }}</span>
                <icon
                  class="delete-icon"
                  v-if="idx === campus.periods.length - 1 && idx !== 0"
                  icon-type="delete"
                  :size="20"
                  @click="deletePeriod(campus, idx)"
                />
              </div>
              <div
                class="t-cell period"
                v-if="!period.editStartTime"
              >
                {{ paddingNumToTwo(period.start_time.hour) }}
                :
                {{ paddingNumToTwo(period.start_time.minute) }}
                <icon
                  class="edit-icon"
                  icon-type="edit"
                  :size="12"
                  button
                  @click="startEdit(period, 'start')"
                />
              </div>
              <div
                class="t-cell period"
                v-else
              >
                <select v-model="editHour">
                  <option
                    v-for="v in allowHours"
                    :key="v"
                    :value="v"
                  >{{v}}</option>
                </select>
                :
                <select v-model="editMinute">
                  <option
                    v-for="v in allowMinutes"
                    :key="v"
                    :value="v"
                  >{{v}}</option>
                </select>
                <icon
                  class="period-icon save"
                  icon-type="check_green"
                  :size="12"
                  button
                  v-if="!invalidTime"
                  @click="saveEdit(campus, period, 'start')"
                />
                <icon
                  class="period-icon cancel"
                  icon-type="delete"
                  :size="16"
                  button
                  @click="cancelEdit(period, 'start')"
                />
              </div>
              <div
                class="t-cell period"
                v-if="!period.editEndTime"
              >
                {{ paddingNumToTwo(period.end_time.hour) }}
                :
                {{ paddingNumToTwo(period.end_time.minute) }}
                <icon
                  class="edit-icon"
                  icon-type="edit"
                  :size="12"
                  button
                  @click="startEdit(period, 'end')"
                />
              </div>
              <div
                class="t-cell period"
                v-else
              >
                <select v-model="editHour">
                  <option
                    v-for="v in allowHours"
                    :key="v"
                    :value="v"
                  >{{v}}</option>
                </select>
                :
                <select v-model="editMinute">
                  <option
                    v-for="v in allowMinutes"
                    :key="v"
                    :value="v"
                  >{{v}}</option>
                </select>
                <icon
                  class="period-icon save"
                  icon-type="check_green"
                  :size="12"
                  button
                  v-if="!invalidTime"
                  @click="saveEdit(campus, period, 'end')"
                />
                <icon
                  class="period-icon cancel"
                  icon-type="delete"
                  :size="16"
                  button
                  @click="cancelEdit(period, 'end')"
                />
              </div>
            </div>
            <div
              class="scroll-column-inner"
              v-if="!editing"
            >
              <div class="t-cell header period">{{ $t('campus.operation') }}</div>
              <div class="t-cell t-cell-2-column actions">
                <div
                  class="text-link"
                  @click="addPeriod(campus)"
                >{{ $t('general.add') }} {{ $t('class.period') }}</div>
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
  getCampuses, addCampus, updateCampus, deleteCampus,
  checkIsTokenError,
} from '@/utils/api';
import CampusForm from '@/components/forms/CampusForm.vue';
import { paddingNumToTwo } from '@/utils/format';

const hours = Array.from(new Array(24).keys());
const minutes = Array.from(new Array(60).keys());

export default {
  data() {
    return {
      editHour: undefined,
      editMinute: undefined,
      editType: '',
      editPeriod: undefined,
      campuses: [],
      allowHours: [],
      allowMinutes: [],
      invalidTime: false,
    };
  },
  computed: {
    editing() {
      return this.campuses.reduce(
        (ret1, campus) => ret1
          || campus.periods.reduce(
            (ret2, period) => ret2 || period.editStartTime || period.editEndTime, false,
          ),
        false,
      );
    },
  },
  watch: {
    editHour() {
      switch (this.editType) {
        case 'start':
          if (this.editHour === this.editPeriod.end_time.hour) {
            this.allowMinutes = minutes.filter((h) => h < this.editPeriod.end_time.minute);
            if (this.editMinute >= this.editPeriod.end_time.minute) {
              this.editMinute = this.editPeriod.end_time.minute - 1;
            }
          } else {
            this.allowMinutes = minutes;
          }
          break;
        case 'end':
          if (this.editHour === this.editPeriod.start_time.hour) {
            this.allowMinutes = minutes.filter((h) => h > this.editPeriod.start_time.minute);
            if (this.editMinute <= this.editPeriod.start_time.minute) {
              this.editMinute = this.editPeriod.start_time.minute + 1;
            }
          } else {
            this.allowMinutes = minutes;
          }
          break;
        default:
      }
      if (this.allowHours.length === 0 || this.allowMinutes.length === 0) {
        this.invalidTime = true;
      } else {
        this.invalidTime = false;
      }
    },
  },
  methods: {
    paddingNumToTwo,
    addCampus() {
      const that = this;
      that.$root.$emit('pop-window', {
        component: CampusForm,
        ok_msg: that.$t('general.add'),
        cancel_msg: that.$t('general.cancel'),
        data: {

        },
        callback: {
          ok: (name) => {
            that.$startLoading();
            addCampus(name)
              .then(() => {
                that.loadCampuses();
              })
              .then(() => {
                that.$notify({
                  group: 'attendance',
                  title: that.$t('general.update_success'),
                  type: 'success',
                });
              })
              .catch((e) => {
                that.notifyException(e);
              })
              .finally(() => {
                that.$endLoading();
              });
          },
        },
        title: this.$t('campus.add_campus'),
        validate: true,
        clickOutsideClose: true,
      });
    },
    addPeriod(campus) {
      const that = this;
      const newCampus = JSON.parse(JSON.stringify(campus));

      let startHour = 9;
      let startMinute = 0;
      if (newCampus.periods.length > 0) {
        startHour = newCampus.periods[newCampus.periods.length - 1].end_time.hour;
        startMinute = newCampus.periods[newCampus.periods.length - 1].end_time.minute + 10;
        if (startMinute >= 60) {
          startHour += 1;
          startMinute -= 60;
        }
      }

      let endHour = startHour;
      let endMinute = startMinute + 50;
      if (endMinute >= 60) {
        endHour += 1;
        endMinute -= 60;
      }

      if (startHour >= 24) {
        that.$notify({
          group: 'attendance',
          title: that.$t('general.update_fail'),
          type: 'error',
          text: that.$t('error.no_more_period'),
        });
        return;
      }

      const newPeriod = {
        start_time: {
          hour: startHour,
          minute: startMinute,
        },
        end_time: {
          hour: endHour,
          minute: endMinute,
        },
      };
      if (newPeriod.end_time.hour === 24) {
        newPeriod.end_time.hour = 23;
        newPeriod.end_time.minute = 59;
      }

      newCampus.periods.push(newPeriod);
      that.$startLoading();
      updateCampus(campus.id, newCampus)
        .then(() => {
          this.$notify({
            group: 'attendance',
            title: this.$t('general.update_success'),
            type: 'success',
          });
          campus = {
            ...newCampus,
          };
          return that.loadCampuses();
        })
        .catch((e) => {
          that.$notify({
            group: 'attendance',
            title: that.$t('general.update_fail'),
            type: 'error',
            text: that.$t('error.no_more_period'),
          });
          console.log(e);
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    deleteCampus(campus) {
      this.$startLoading();
      deleteCampus(campus.id)
        .then(() => {
          this.$notify({
            group: 'attendance',
            title: this.$t('general.delete_success'),
            type: 'success',
          });
          return this.loadCampuses();
        })
        .catch((e) => {
          this.notifyException(e);
        })
        .finally(() => {
          this.$endLoading();
        });
    },
    deletePeriod(campus, idx) {
      const that = this;
      that.$startLoading();
      const newCampus = JSON.parse(JSON.stringify(campus));
      newCampus.periods.splice(idx, 1);
      updateCampus(campus.id, newCampus)
        .then(() => {
          campus.periods.splice(idx, 1);
          this.$notify({
            group: 'attendance',
            title: this.$t('general.delete_success'),
            type: 'success',
          });
          return that.loadCampuses();
        })
        .catch((e) => {
          that.notifyException(e);
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    startEdit(period, type) {
      this.editType = type;
      this.editPeriod = period;
      if (type === 'start') {
        period.editStartTime = true;
        this.allowHours = hours.filter((h) => h <= period.end_time.hour);
        if (period.start_time.hour === period.end_time.hour) {
          this.allowMinutes = minutes.filter((h) => h <= period.end_time.minute);
          if (this.allowMinutes.length === 0) {
            this.allowHours = hours.filter((h) => h < period.end_time.hour);
            this.allowMinutes = minutes;
          }
        } else {
          this.allowMinutes = minutes;
        }
        this.editHour = period.start_time.hour;
        this.editMinute = period.start_time.minute;
      } else if (type === 'end') {
        period.editEndTime = true;

        this.allowHours = hours.filter((h) => h >= period.start_time.hour);
        if (period.end_time.hour === period.start_time.hour) {
          this.allowMinutes = minutes.filter((h) => h >= period.start_time.minute);
          if (this.allowMinutes.length === 0) {
            this.allowHours = hours.filter((h) => h > period.start_time.hour);
            this.allowMinutes = minutes;
          }
        } else {
          this.allowMinutes = minutes;
        }
        this.editHour = period.end_time.hour;
        this.editMinute = period.end_time.minute;
      }
      if (this.allowHours.length === 0 || this.allowMinutes.length === 0) {
        this.invalidTime = true;
      } else {
        this.invalidTime = false;
      }
      this.$forceUpdate();
    },
    cancelEdit(period, type) {
      if (type === 'start') {
        period.editStartTime = false;
      } else if (type === 'end') {
        period.editEndTime = false;
      }
      this.editHour = undefined;
      this.editMinute = undefined;
      this.$forceUpdate();
    },
    saveEdit(campus, period, type) {
      const that = this;
      that.$startLoading();
      if (type === 'start') {
        period.editStartTime = false;
        period.start_time.hour = that.editHour;
        period.start_time.minute = that.editMinute;
      } else if (type === 'end') {
        period.editEndTime = false;
        period.end_time.hour = that.editHour;
        period.end_time.minute = that.editMinute;
      }
      that.editHour = undefined;
      that.editMinute = undefined;
      that.$forceUpdate();
      that.$startLoading();
      updateCampus(campus.id, campus)
        .then(() => {
          that.$notify({
            group: 'attendance',
            title: that.$t('general.update_success'),
            type: 'success',
          });
        })
        .catch((e) => {
          that.notifyException(e);
        })
        .finally(() => {
          that.$endLoading();
          return that.loadCampuses();
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    loadCampuses() {
      this.$startLoading();
      return getCampuses()
        .then((data) => {
          this.campuses = data.result;
        })
        .catch((e) => {
          checkIsTokenError(e.response);
        })
        .finally(() => {
          this.$endLoading();
        });
    },
    notifyException(e) {
      const that = this;
      that.$notify({
        group: 'attendance',
        title: that.$t('general.update_fail'),
        type: 'error',
        text: that.$t(`error.${e.response.data.error}`),
      });
    },
  },
  mounted() {
    this.loadCampuses();
  },
};
</script>

<style lang="scss" scoped>
@import "../assets/styles/variable.scss";
.block {
  .campus-block {
    margin-bottom: 20px;
    padding: 20px;
  }
  .campus-name {
    margin: 8px 20px;
    display: flex;
  }
}
.table {
  font-size: 12px;
  display: flex;
  flex-direction: row;

  .fix-column {
    flex: 0 0 120px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .scroll-column {
    flex: 1;
    @include auto-overflow();
    @include customScrollbar();
    display: flex;
    flex-direction: row;
    .scroll-column-inner {
      flex: 0 0 100px;
      display: flex;
      flex-direction: column;
      &:last-child {
        border-right: 1px solid #e9e9e9;
      }
    }
  }
  .t-cell {
    flex: 0 0 36px;

    display: flex;
    align-items: center;
    justify-content: center;

    &.t-cell-2-column {
      flex: 0 0 72px;
    }

    text-align: center;
    &.header {
      background: #fcfcfc;
      border-top: 1px solid #e9e9e9;
    }

    &.period {
      .edit-icon {
        max-width: 0;
        overflow: hidden;

        transition: 0.25s max-width ease-in-out;
      }
      .delete-icon {
        user-select: none;
        cursor: pointer;
      }
      .period-icon {
        margin-left: 4px;
        &.save {
          fill: $color-success;
        }
        &.cancel {
          fill: $color-error;
        }
      }
      &:hover {
        .edit-icon {
          max-width: 12px;
          margin-left: 8px;
        }
      }
    }

    border: 1px solid #e9e9e9;
    border-right: none;
    border-top: none;
    &.actions {
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
  }
  &.editing {
    .t-cell:hover {
      .edit-icon {
        max-width: 0;
        margin-left: 0px;
      }
    }
  }
}
</style>
