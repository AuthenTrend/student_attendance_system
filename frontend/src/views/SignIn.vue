<template lang="pug">
.sign-in
  .title.row {{$t('signin.classes')}} > {{ id }} {{ className }} > {{day || $t('signin.sign_in')}}
  .row
    text-button(@click="endSignin") {{$t('signin.end_sign_in')}}
    text-button(button-type="primary", @click="startFIDO") {{$t('signin.start_fido')}}
  .block
    .title-row
      .title {{$t('signin.list_of_signed_student')}}
      .link(@click="openNewWindow") {{$t('signin.view_in_new_window')}}
    .list
      .info {{$t('signin.number_of_student_sign_in', {num: attendStudentsCnt})}}
      .students
        .student(v-for="(student, idx) in students", :key="student.id")
          .name {{ student.username }} ({{ student.id }})
          .bar
          .status( :class="{ \
            absent: student.status === 2, \
            late: student.status === 1, \
            attend: student.status === 0 }") {{ student.statusText }}
            .time(v-if="student.signinTime") ({{ student.signinTime }})
</template>

<script>
import {
  getClass, signinClass, endSigninSession, getSigninSessions,
} from '@/utils/api';
import { get as FIDOGet } from '@/utils/fido';
import { datetimeToString } from '@/utils/format';

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
    session: {
      type: String,
    },
  },
  data() {
    return {
      students: [],
      newWindow: undefined,
      attendStudentsCnt: 0,
      className: '',
      day: '',
    };
  },
  computed: {
  },
  methods: {
    startFIDO() {
      const that = this;
      return that.getSessionIsEnd()
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
              return signinClass(that.id, that.session, d)
                .then((data) => {
                  const userID = data.result.student;
                  const { time } = data.result;
                  let name = '';
                  that.students.forEach((s) => {
                    if (s.id === userID) {
                      s.status = 0;
                      s.statusText = that.$t('signin.attend');
                      // remain houre:minute only
                      s.signinTime = datetimeToString(time).substr(11, 5);
                      name = s.username;
                    }
                  });
                  that.attendStudentsCnt = that.students.filter(
                    (s) => s.signinTime !== undefined,
                  ).length;
                  that.saveCache();
                  that.$notify({
                    group: 'attendance',
                    title: that.$t('general.success'),
                    type: 'success',
                    text: that.$t('signin.signin_user_success', { user: name }),
                  });
                  that.$nextTick(() => {
                    that.$forceUpdate();
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
                })
                .then(() => that.startFIDO());
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
    saveCache() {
      localStorage.setItem('signin_students', JSON.stringify(this.students));
    },
    endSignin() {
      const that = this;
      that.getSessionIsEnd()
        .then((ret) => {
          console.log(ret);
          return ret ? '' : endSigninSession(that.id, that.session);
        })
        .then(() => {
          if (that.newWindow) {
            that.newWindow.close();
          }
          localStorage.removeItem('signin_students');
          that.$router.push(`/class/${that.id}`);
        });
    },
    openNewWindow() {
      this.newWindow = window.open(
        '/signin.html',
        'signinpage',
        'menubar=no,location=no,resizable=yes,scrollbars=yes,status=yes,width=500px,height=500px',
      );
    },
    getSessionIsEnd() {
      const that = this;
      // load data if signin session is recovered
      const params = getURLParams();
      console.log(params);

      const parts = that.session.split('_');
      const start = parts[parts.length - 1] || params.start;

      if (start) {
        return getSigninSessions(that.id, 1, 0, parseInt(start, 10) + 1)
          .then((rsp) => {
            const idx = rsp.result.records.findIndex((r) => r.title === that.session);
            return rsp.result.records[idx].end !== '';
          });
      }
      return new Promise((r) => r(false));
    },
  },
  mounted() {
    const that = this;
    let students = [];
    that.$startLoading();
    getClass(that.id)
      .then((data) => {
        console.log(data);
        that.className = data.result.name;
        students = data.result.students;
        students.forEach((s) => {
          s.status = 2;
          s.statusText = that.$t('signin.not_sign_in');
        });
        that.attendStudentsCnt = 0;

        // load data if signin session is recovered
        const params = getURLParams();
        console.log(params);

        const parts = that.session.split('_');
        const start = parts[parts.length - 1] || params.start;

        if (start) {
          return getSigninSessions(that.id, 1, 0, parseInt(start, 10) + 1)
            .then((rsp) => {
              console.log(rsp);
              const idx = rsp.result.records.findIndex((r) => r.title === that.session);
              if (idx < 0) {
                that.$router.push(`/class/${that.id}`);
                return [];
              }
              if (rsp.result.records[idx].end !== '') {
                that.$router.push(`/class/${that.id}`);
              }
              return rsp.result.records[idx].records;
            })
            .then((records) => {
              records.forEach((record) => {
                const idx = students.findIndex((s) => s.id === record.student);
                console.log(record.student, idx);
                if (idx >= 0) {
                  if (record.time !== 0
                    && (students[idx].time === undefined || students[idx].time > record.time)) {
                    students[idx].time = record.time;
                    students[idx].status = record.status;
                    // remain houre:minute only
                    students[idx].statusText = that.$t('signin.attend');
                    students[idx].signinTime = datetimeToString(record.time).substr(11, 5);
                  }
                }
              });
              that.$forceUpdate();
            });
        }
        return '';
      })
      .then(() => {
        that.students = students;
        that.attendStudentsCnt = that.students.filter(
          (s) => s.signinTime !== undefined,
        ).length;
      })
      .finally(() => {
        that.saveCache();
        that.$endLoading();
      });
    const [, timestamp] = that.session.split('_');
    that.day = datetimeToString(parseInt(timestamp, 10)).substr(0, 10);
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";
.block {
  padding: 20px;
  display: flex;
  flex-direction: column;

  .title-row {
    display: flex;
    align-items: center;
    .title {
      margin-right: 8px;
    }
    .link {
      font-size: 12px;
      text-decoration: underline;
      color: $active-color;
      user-select: none;
      cursor: pointer;
    }
  }
  .list {
    border: 1px solid $color-borderline;
    flex: 1;
    margin-top: 8px;
    padding: 8px;
    .info {
      margin-bottom: 20px;
    }
    .students {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: flex-start;
      .student {
        flex: 0 0 320px;
        &:nth-child(2n) {
          flex: 1;
          flex-basis: calc(100% - 480px);
        }
        display: flex;
        align-items: center;
        // justify-content: space-between;
        margin-right: 80px;
        .name {
          flex: 0 0 160px;
          margin-right: 8px;
        }
        .status {
          flex: 0 0 auto;
          text-align: left;
          white-space: nowrap;
          font-size: 12px;
          &.late {
            color: $color-warning;
          }
          display: flex;
          align-items: center;
          .time {
            margin-left: 4px;
          }
        }
      }
    }
  }
}
</style>
