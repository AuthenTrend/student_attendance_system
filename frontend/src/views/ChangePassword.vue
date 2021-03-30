<template lang="pug">
.change-password
  .title.row
    span {{ $t('user.chagne_password') }}
  .block
    .desc
      span {{ $t('user.first_change_pass_desc') }}
    password-change-form.form(ref="form", @validateSuccess="doSave")
    .operation
      text-button(button-type="primary", @click="save") {{ $t('general.save') }}
</template>

<script>
import { mapState } from 'vuex';
import { getUser, updateUser } from '@/utils/api';
import PasswordChangeForm from '@/components/forms/PasswordChangeForm.vue';

export default {
  components: {
    'password-change-form': PasswordChangeForm,
  },
  computed: {
    ...mapState(['firstLogin', 'currentUser']),
  },
  methods: {
    save() {
      const that = this;
      that.$refs.form.$emit('validate');
    },
    doSave({ password }) {
      const that = this;
      console.log(password);
      getUser(this.currentUser)
        .then((data) => {
          const updatedUser = JSON.parse(JSON.stringify(data.result));
          updatedUser.password = password;
          that.$startLoading();
          return updateUser(updatedUser);
        })
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
          that.$router.push(`/user/${that.currentUser}/newkey`);
        });
    },
  },
  mounted() {
    // if (!this.firstLogin) {
    //   this.$router.push({ name: 'Profile' });
    // }
  },
};
</script>

<style lang="scss" scoped>
.form {
  margin-top: 8px;
}
.operation {
  width: 428px;
  padding-left: 20px;
}
.desc {
  margin-left: 20px;
  margin-top: 20px;
}
</style>
