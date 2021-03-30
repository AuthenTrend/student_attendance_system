<template lang="pug">
.students-form
  .operation
    dropdown-select(
      v-model="newStudent",
      :options="users",
      width="150px",
      fixed-list-width
    )
    text-button(@click="addStudent", :button-type="canAdd ? '' : 'disable'") {{ $t('general.add') }}
  .students
    .title {{ $t('class.attend_students') }}
    .list(v-if="students.length > 0")
      .student(v-for="(student, idx) in students")
        .name {{ student.username }}
        .id - {{ student.id }}
        .delete(@click="removeStudent(idx)") x
    .list(v-else) {{ $t('class.no_students') }}
</template>

<script>
import { getUsers } from '@/utils/api';

export default {
  props: {
    extData: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      students: [],
      newStudent: [],
      allUsers: [],
      usersMap: {},
      users: [],
    };
  },
  computed: {
    canAdd() {
      return this.newStudent.length > 0;
    },
  },
  methods: {
    validate() {
      this.$emit('validateSuccess', this.students);
    },
    addStudent() {
      const id = this.newStudent[0];
      const user = this.usersMap[id];
      this.students.push({
        id: user.id,
        username: user.username,
      });
      this.newStudent = [];
      this.calculateUsers();
    },
    removeStudent(idx) {
      this.students.splice(idx, 1);
      this.calculateUsers();
      this.$forceUpdate();
    },
    loadUsers() {
      const that = this;
      getUsers().then((data) => {
        const newAllUsers = [];
        that.usersMap = {};
        data.result.forEach((u) => {
          if (u.type !== 2) {
            return;
          }
          newAllUsers.push({
            text: u.username,
            value: u.id,
          });
          that.usersMap[u.id] = u;
        });
        that.allUsers = newAllUsers;
        that.calculateUsers();
      });
    },
    calculateUsers() {
      const tMap = {};
      this.students.forEach((s) => {
        tMap[s.id] = true;
      });
      console.log(tMap);
      this.users = this.allUsers.filter((u) => !tMap[u.value]);
    },
  },
  mounted() {
    const that = this;
    console.log(that.extData);
    that.students = that.extData.students;
    that.$on('validate', () => {
      that.validate();
    });
    that.loadUsers();
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.students-form {
  width: 500px;
  padding: 0 20px;
  .students {
    margin-top: 20px;
    .title {
      font-weight: bold;
    }
    .list {
      margin-top: 8px;
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
        .delete {
          color: $color-error;
          margin-left: 4px;
          cursor: pointer;
          user-select: none;
        }
      }
    }
  }
  .operation {
    display: flex;
    .text-button {
      margin-left: 8px;
    }
  }
}
</style>
