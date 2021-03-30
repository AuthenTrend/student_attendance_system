<template lang="pug">
.sign-in
  .block(v-if="!noSignin")
    .title-row
      .title {{$t('signin.list_of_signed_student')}}
    .list
      .info {{$t('signin.number_of_student_sign_in', {num: attendStudentsCnt})}}
      .students
        .student(v-for="student in students", :key="student.id")
          .name {{ student.username }}({{ student.id }})
          .status( :class="{ \
            absent: student.status === 2, \
            late: student.status === 1, \
            attend: student.status === 0 }") {{ student.statusText }}
            .time(v-if="student.signinTime") ({{ student.signinTime }})
  .block(v-else) Signin session is closed.
</template>

<script>
export default {
  data() {
    return {
      students: [],
      noSignin: false,
    };
  },
  computed: {
    attendStudentsCnt() {
      return this.students.filter((s) => s.status === 0).length;
    },
  },
  methods: {
    startAutoLoad() {
      const cache = localStorage.getItem('signin_students');
      const that = this;
      if (cache && cache !== null) {
        that.students = JSON.parse(cache);
        console.log('refresh');
      } else if (cache === null) {
        that.noSignin = true;
      }
      setTimeout(() => {
        that.startAutoLoad();
      }, 1000);
    },
  },
  mounted() {
    this.startAutoLoad();

    const locale = localStorage.getItem('locale');
    if (locale) {
      this.$i18n.locale = locale;
    }
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
        flex: 0 1 auto;
        display: flex;
        align-items: center;
        margin-right: 20px;
        .name {
          flex: 0 0 auto;
          margin-right: 8px;
        }
        .status {
          flex: 0 0 160px;
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
