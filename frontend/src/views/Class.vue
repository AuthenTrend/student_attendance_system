<template lang="pug">
.class
  .title.row
    span.click-button.link(@click="goClasses") {{ $t('page.classes') }}
    .seperator
    span {{ id }} {{ info.name }}
  .row
    text-button(@click="gotoList()") {{ $t('general.back_list') }}
    text-button(
      v-if="userInfo && userInfo.type === 1",
      button-type="primary",
      @click="goSignIn"
    ) {{ $t('signin.start_sign_in') }}
  .block
    .session
      .session-title
        span {{ $t('class.class_information') }}
        icon.click-button(
          icon-type="edit"
          :size="20"
          @click="editClass"
          v-if="userInfo && userInfo.type !== 2"
        )
      .information
        .info-row(v-for="key in showKeys", :key="key")
          .name {{ $t(`class.${key}`) }}
          .value
            span {{ showInfo[key] }}
            span.mr-l-8(v-if="key === 'lateAfter' || key === 'absenceAfter'")
              template {{ $t('general.min') }}
    .session
      .session-title {{ $t('general.students') }}
      .attend-students
        .student(v-for="student in students")
          .name {{ student.username }}
          .id - {{ student.id }}
      .operation
        text-button(
          @click="editStudents"
          v-if="userInfo && userInfo.type !== 2"
        ) {{ $t('general.edit') }}
    .session.session-table
      .session-title {{ $t('class.sign_record') }}
      label-switch(
        :options="modeOptions"
        v-model="mode"
        v-if="!editMode && userInfo && userInfo.type !== 2")
      .table(v-if="mode === 'date'")
        .t-header
          .t-row.header
            .t-cell.name {{ $t('class.sign_session') }}
            .t-cell.start {{ $t('class.sign_start_time') }}
            .t-cell.count {{ $t('class.sign_students') }}
            .t-cell.actions {{ $t('general.actions') }}
        .t-body
          template(v-for="s in sessions")
            .t-row(:key="s.start_time")
              .t-cell.name {{ s.name }}
              .t-cell.start {{ s.start_time }}
              .t-cell.count {{ s.count }}
              .t-cell.actions
                template(v-if="!editMode")
                  .text-link(@click="expandRow(s)") {{ $t('general.detail') }}
                  .text-link(
                    @click="continueSession(s)",
                    v-if="s.end_time === '' && userInfo && userInfo.type === 1"
                  ) {{ $t('general.continue') }}
                  .text-link(@click="exportSession(s)") {{ $t('general.export') }}
                  .text-link(
                    @click="startFIDO(s)"
                    v-if="s.end_time === '' && userInfo && userInfo.type === 2"
                  ) {{$t('signin.start_fido')}}
            transition(
              enter-active-class="fade-enter-active",
              leave-active-class="fade-leave-active",
              :key="s.start_time"
            )
              .t-expand(v-if="s.expand", :key="s.start_time")
                .operation-row(
                  v-if="s.expand && userInfo && userInfo.type === 1"
                )
                  text-button(v-if="!editMode", @click="startEdit(s)")
                    span {{ $t('class.edit_status') }}
                  text-button(v-else, button-type="primary", @click="endEdit")
                    span {{ $t('class.end_edit_status') }}
                .students
                  .student(
                    v-for="student in s.students",
                    :key="student.name",
                    :class="{ editing: editMode }"
                  )
                    .student-name {{ student.name }}
                    .student-id {{ student.id }}
                    .student-status.attend-status(
                      :class=`{
                      attend: student.status === 0,
                      late: student.status === 1,
                      absent: student.status === 2}`,
                      v-if="!editMode"
                    ) {{ student.statusText }}
                    .student-status(v-if="editMode")
                      status-switch(
                        v-model="student.status",
                        @change="updateStatus(student, $event)"
                      )
      .scroll-table(v-if="mode === 'student'")
        .fixed-column
          .column
            .t-cell {{ $t('general.student') }}
            .t-cell(v-for="student in students") {{ student.username }}
          .column
            .t-cell {{ $t('general.id') }}
            .t-cell(v-for="student in students") {{ student.id }}
        .scroll-column
          .column(v-for="time in times", :key="time.start")
            .t-cell {{ time.name }}
            .t-cell(v-for="student in students", :key="student.id")
              template(
                v-if="studentAttendMap[student.id][time.start] !== undefined"
              )
                span.attend-status(
                  :class=`{
                      attend: studentAttendMap[student.id][time.start].status === 0,
                      late: studentAttendMap[student.id][time.start].status === 1,
                      absent: studentAttendMap[student.id][time.start].status === 2}`
                ) {{ studentAttendMap[student.id][time.start].text }}
              template(v-else)
                span.attend-status.absent {{ $t('signin.absent') }}
          .column.stretch
            .t-cell
            .t-cell(v-for="student in students", :key="student.id")
      paginate(
        v-if="totalPage > 1",
        :page-count="totalPage",
        prev-text="Prev",
        next-text="Next",
        v-model="currentPage",
        :click-handler="loadSessionPage",
        :container-class="'pagination'",
        :page-class="'page-item'"
      )
</template>

<script>
import { mapState } from 'vuex';
import {
  getClass, getCampuses, updateClassStudents, createSigninSession,
  getSigninSessions, getUsers, updateSigninRecord, signinClass,
} from '@/utils/api';
import {
  paddingNumToTwo, getDateTextKey, dateToString, datetimeToString,
} from '@/utils/format';
import AttendStatusSwitch from '@/components/AttendStatusSwitch.vue';
import StudentsForm from '@/components/forms/StudentsForm.vue';
import misc from '@/utils/misc';
import { get as FIDOGet } from '@/utils/fido';

const statusTextKeyMap = {
  0: 'signin.attend',
  1: 'signin.late',
  2: 'signin.absent',
};

function getURLParams() {
  const url = window.location.href;
  const urlSplit = url.split('?');
  if (urlSplit.length < 2) {
    return {};
  }
  const params = urlSplit[1].split('&');
  const ret = {};
  params.forEach((param) => {
    const parts = param.split('=');
    if (parts.length < 2) {
      ret[parts[0]] = '';
    } else {
      // eslint-disable-next-line prefer-destructuring
      ret[parts[0]] = parts[1];
    }
  });
  return ret;
}

export default {
  props: {
    id: {
      type: String,
    },
  },
  components: {
    'status-switch': AttendStatusSwitch,
  },
  data() {
    return {
      info: {},
      showInfo: {},
      showKeys: [
        'class_no', 'campusName',
        'category', 'period',
        'name', 'lateAfter',
        'day', 'absenceAfter',
        'teacherName',
      ],

      editMode: false,
      editSession: undefined,

      mode: 'date',
      modeOptions: [
        {
          val: 'date',
          text: this.$t('class.group_by_date'),
        },
        {
          val: 'student',
          text: this.$t('class.group_by_student'),
        },
      ],
      sessions: [],
      students: [],
      times: [],
      studentIDMap: {},
      studentAttendMap: {},

      studentMap: {},
      pageLimit: 10,
      totalPage: 1,
      currentPage: 1,
      expandSessionID: undefined,
    };
  },
  computed: {
    ...mapState(['userInfo']),
  },
  methods: {
    exportSession(s) {
      console.log(s);
      let output = '\ufeffID, Name, Status\n';
      s.students.forEach((student) => {
        output += `${student.id},${student.name},${student.statusText}\n`;
      });
      const data = new Blob([output], { type: 'text/csv' });
      misc.downloadRawFile(data, `${this.id}_${s.name}.csv`);
    },
    editClass() {
      this.$router.push({ name: 'EditClass', params: { id: this.id } });
    },
    goClasses() {
      this.$router.push({ name: 'Classes' });
    },
    updateStatus(student, status) {
      console.log(student, status);
      const record = {
        status,
        student: student.id,
        session: this.editSession.title,
      };
      updateSigninRecord(this.id, [record])
        .then(() => {
          this.$notify({
            group: 'attendance',
            title: this.$t('general.update_success'),
            type: 'success',
          });
          student.statusText = this.$t(statusTextKeyMap[status]);
        })
        .catch((e) => {
          this.$notify({
            group: 'attendance',
            title: this.$t('general.update_fail'),
            type: 'warn',
            text: this.$t(`error.${e.response.data.message}`),
          });
        });
    },
    expandRow(row) {
      this.sessions.forEach((s) => {
        s.expand = false;
      });
      row.expand = true;
      this.expandSessionID = row.title;
    },
    continueSession(row) {
      console.log(row);
      this.$router.push(`/class/${this.id}/signin/${row.title}?start=${row.start}`);
    },
    formatSessions(sessions) {
      const that = this;
      that.studentAttendMap = {};
      that.students.forEach((s) => {
        that.studentAttendMap[s.id] = {};
      });

      that.times = [];
      that.sessions = sessions.map((s) => {
        const start = new Date(parseInt(s.start, 10));
        const end = new Date(parseInt(s.end, 10));
        const studentMap = {};
        s.records.forEach((r) => {
          // when student is not set or record is earlier
          if (studentMap[r.student] === undefined
            || (r.time !== 0
              && (studentMap[r.student].time === 0
                || studentMap[r.student].time > r.time))) {
            studentMap[r.student] = r;
          }
        });
        const sessionName = dateToString(start);
        let students = [];
        if (that.userInfo.type === 2) {
          const status = studentMap[that.userInfo.id] ? studentMap[that.userInfo.id].status : 2;
          let statusText = that.$t(statusTextKeyMap[status]);
          if (status === 2 && studentMap[that.userInfo.id] !== undefined
              && studentMap[that.userInfo.id].time !== 0) {
            statusText = that.$t('signin.signed_but_absent');
          }
          students = [{
            name: that.userInfo.name,
            id: that.userInfo.id,
            time: (studentMap[that.userInfo.id]
              ? datetimeToString(new Date(studentMap[that.userInfo.id].time)).substr(11, 5) : ''),
            status,
            statusText,
          }];
        } else {
          students = JSON.parse(JSON.stringify(that.students)).map((student) => {
            const status = studentMap[student.id] ? studentMap[student.id].status : 2;
            let statusText = that.$t(statusTextKeyMap[status]);
            if (status === 2 && studentMap[student.id] !== undefined
              && studentMap[student.id].time !== 0) {
              statusText = that.$t('signin.signed_but_absent');
            }

            return {
              name: student.username,
              id: student.id,
              time: (studentMap[student.id]
                ? datetimeToString(new Date(studentMap[student.id].time)).substr(11, 5) : ''),
              status,
              statusText,
            };
          });
        }

        Object.keys(studentMap).forEach((id) => {
          if (!that.studentAttendMap[id]) {
            return;
          }
          let text = that.$t(statusTextKeyMap[studentMap[id].status]);
          if (studentMap[id].status === 2 && studentMap[id] !== undefined
            && studentMap[id].time !== 0) {
            text = that.$t('signin.signed_but_absent');
          }
          that.studentAttendMap[id][s.start] = {
            status: studentMap[id].status,
            text,
          };
        });

        that.times.push({
          start: s.start,
          name: sessionName,
        });

        return {
          name: sessionName,
          start_time: datetimeToString(start),
          start: s.start,
          end_time: datetimeToString(end),
          title: s.title,
          // count: Object.keys(studentMap).filter((k) => studentMap[k].status !== 2).length,
          count: Object.keys(studentMap).filter((k) => studentMap[k].time !== 0).length,
          expand: s.title === that.expandSessionID,
          students,
        };
      });
      that.$forceUpdate();
    },
    gotoList() {
      this.$router.push({ name: 'Classes' });
    },
    // startEdit() {
    startEdit(session) {
      this.editMode = true;
      this.editSession = session;
    },
    endEdit() {
      this.editMode = false;
      this.editSession = undefined;
      this.loadSessionPage();
    },
    editStudents() {
      const that = this;
      this.$root.$emit('pop-window', {
        component: StudentsForm,
        ok_msg: that.$t('general.save'),
        cancel_msg: that.$t('general.cancel'),
        extData: {
          students: JSON.parse(JSON.stringify(that.info.students)),
        },
        callback: {
          ok: (students) => {
            console.log(students);
            that.updateStudents(students)
              .then(() => {
                this.$notify({
                  group: 'attendance',
                  title: this.$t('general.update_success'),
                  type: 'success',
                });
                that.reload();
              })
              .catch((e) => {
                this.$notify({
                  group: 'attendance',
                  title: this.$t('general.update_fail'),
                  type: 'warn',
                  text: this.$t(`error.${e.response.data.message}`),
                });
              });
          },
        },
        title: that.$t('class.edit_students'),
        validate: true,
      });
    },
    updateStudents(students) {
      return updateClassStudents(this.id, students);
    },
    goSignIn() {
      const that = this;
      createSigninSession(that.id).then((data) => {
        this.$router.push(`/class/${this.id}/signin/${data.result.title}`);
      });
    },
    loadSessionPage(page) {
      console.log(page);
      const that = this;
      const offset = (page - 1) * that.pageLimit;
      return getSigninSessions(that.id, that.pageLimit, offset)
        .then((data) => {
          that.totalPage = parseInt((data.result.total - 1) / that.pageLimit, 10) + 1;
          that.formatSessions(data.result.records);
        });
    },
    reload() {
      const that = this;
      that.$startLoading();
      return getClass(that.id)
        .then((rsp) => {
          that.info = rsp.result;
          that.showInfo = JSON.parse(JSON.stringify(rsp.result));
          that.students = that.info.students;
          delete that.showInfo.id;
          delete that.showInfo.teacherId;
          delete that.showInfo.students;
          that.showInfo.day = that.$t(getDateTextKey(that.showInfo.date));
        })
        .then(() => getCampuses())
        .then((data) => {
          const compuses = data.result;
          const campusMap = {};
          compuses.forEach((c) => {
            campusMap[c.name] = c;
          });
          const campus = campusMap[that.info.campusName];
          const period = campus.periods[that.info.period - 1];
          that.showInfo.campusName = campus.name;
          that.showInfo.period = `${that.info.period} ( ${paddingNumToTwo(period.start_time.hour)}:${paddingNumToTwo(period.start_time.minute)} )`;
        })
        .then(() => getUsers())
        .then((data) => {
          that.studentMap = {};
          data.result.forEach((d) => {
            if (d.type !== 2) {
              return;
            }
            that.studentMap[d.id] = d;
          });
        })
        .then(() => that.loadSessionPage(that.currentPage))
        .finally(() => {
          that.$endLoading();
        });
    },
    startFIDO(s) {
      const that = this;
      return that.getSessionIsEnd(s)
        .then((ret) => {
          console.log(ret);
          if (ret) {
            that.$notify({
              group: 'attendance',
              title: that.$t('error.update_fail'),
              type: 'warn',
              text: that.$t('error.session_is_end'),
            });
            that.$router.push(`/class/${that.id}`);
            return '';
          }
          return FIDOGet()
            .then((d) => {
              console.log(d);
              return signinClass(that.id, s.title, d)
                .then((data) => {
                  const userID = data.result.student;
                  const { time } = data.result;
                  let name = '';
                  that.students.forEach((st) => {
                    if (st.id === userID) {
                      st.status = 0;
                      st.statusText = that.$t('signin.attend');
                      // remain houre:minute only
                      st.signinTime = datetimeToString(time).substr(11, 5);
                      name = st.username;
                    }
                  });
                  that.reload();
                  that.$notify({
                    group: 'attendance',
                    title: that.$t('general.success'),
                    type: 'success',
                    text: that.$t('signin.signin_user_success', { user: name }),
                  });
                })
                .catch((e) => {
                  console.log(e.response.data.error);
                  that.$notify({
                    group: 'attendance',
                    title: that.$t('error.sign_fail'),
                    type: 'warn',
                    text: that.$t(`error.${e.response.data.error}`),
                  });
                });
            });
        })
        .catch((e) => {
          console.log(e);
          return that.getSessionIsEnd();
        })
        .then((ret) => {
          if (ret) {
            that.$notify({
              group: 'attendance',
              title: that.$t('error.update_fail'),
              type: 'warn',
              text: that.$t('error.session_is_end'),
            });
            that.$router.push(`/class/${that.id}`);
          }
        });
    },
    getSessionIsEnd(s) {
      const that = this;
      // load data if signin session is recovered
      const params = getURLParams();
      console.log(params);

      const parts = s.title.split('_');
      const start = parts[parts.length - 1] || params.start;

      if (start) {
        return getSigninSessions(that.id, 1, 0, parseInt(start, 10) + 1)
          .then((rsp) => {
            const idx = rsp.result.records.findIndex((r) => r.title === s.title);
            return rsp.result.records[idx].end !== '';
          });
      }
      return new Promise((r) => r(false));
    },
  },
  mounted() {
    this.reload();
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
  .session-table {
    @include auto-overflow();
    @include customScrollbar();
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
    display: flex;
    align-items: center;
    .icon {
      margin-left: 8px;
    }
  }
  .attend-students {
    padding: 0px 20px;
    display: flex;
    flex-wrap: wrap;
    .student {
      display: flex;
      align-items: center;
      margin-right: 8px;

      background: #eee;
      padding: 4px;
      border-radius: 4px;
      .name {
        margin-right: 4px;
      }
      .id {
        font-size: 10px;
      }
    }
  }
  .operation {
    margin-top: 8px;
    padding: 0px 20px;
  }
  .information {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex-wrap: wrap;
    padding: 0px 20px;

    .info-row {
      display: flex;
      align-items: center;
      // justify-content: space-between;
      flex: 0 0 400px;
      &:nth-child(2n) {
        flex-basis: calc(100% - 540px);
      }
      margin-right: 60px;
      padding: 8px 20px;
      .name {
        flex: 0 0 120px;
        text-align: right;
        margin-right: 20px;
      }
      .value {
        flex: 0 0 200px;
        display: flex;
        align-items: center;
        .icon {
          margin-left: 8px;
        }
      }
    }
  }
  .table {
    border-top: 1px solid #e9e9e9;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    @include auto-overflow();
    @include customScrollbar();
    .t-header {
      flex: 0 0 32px;
    }
    .t-body {
      flex: 1;
      @include auto-overflow();
      @include customScrollbar();
    }
    .t-row {
      flex: 0 0 36px;
      line-height: 36px;
      &.header {
        background: #fcfcfc;
      }
      &:hover {
        background: #f9f9f9;
        cursor: pointer;
      }
      border-bottom: 1px solid #e9e9e9;

      display: flex;
      flex-direction: row;
      .name {
        flex: 0 0 120px;
      }
      .start {
        flex: 0 0 150px;
      }
      .count {
        flex: 0 0 140px;
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
      .t-cell {
        padding-left: 20px;
        height: 36px;
        display: flex;
        align-items: center;
      }
    }
    .t-expand {
      border-bottom: 1px solid #e9e9e9;
      box-shadow: inset 0 0 8px #e0e9e9;
      overflow: hidden;
      .operation-row {
        padding: 8px 20px;
      }
    }

    .fade-enter-active {
      animation: go 0.5s ease-in-out;
    }
    .fade-leave-active {
      animation: back 0.5s ease-in-out;
    }
  }

  .scroll-table {
    border-top: 1px solid #e9e9e9;
    font-size: 12px;
    display: flex;
    .fixed-column {
      flex: 0 0 256px;
      display: flex;
    }
    .scroll-column {
      flex: 1;
      display: flex;
      @include auto-overflow();
      @include customScrollbar();
    }
    .column {
      display: flex;
      flex-direction: column;

      flex: 0 0 128px;
      &.stretch {
        flex: 1;
      }
      .t-cell {
        flex: 0 0 36px;
        text-align: center;
        border-bottom: 1px solid #e9e9e9;

        display: flex;
        align-items: center;
        justify-content: center;
      }
      .t-cell:first-child {
        background: #fcfcfc;
      }
      &:last-child {
        .t-cell {
          border-right: 1px solid #e9e9e9;
        }
      }
    }
  }
}
.students {
  display: flex;
  flex-wrap: wrap;
  .student {
    flex: 0 0 220px;
    &.editing {
      flex: 0 0 320px;
    }
    margin: 8px 20px;

    display: flex;
    align-items: center;
    .student-id {
      margin-left: 8px;
      color: $color-font-mark;
    }
    .student-status {
      margin-left: 8px;
    }
  }
}
.attend-status {
  &.late {
    color: $color-warning;
  }
  &.absent {
    color: $color-error;
  }
}

.mr-l-8 {
  margin-left: 8px;
}

@keyframes go {
  from {
    max-height: 0px;
  }
  to {
    max-height: 100vh;
  }
}

@keyframes back {
  from {
    max-height: 100vh;
  }
  to {
    max-height: 0;
  }
}
</style>
