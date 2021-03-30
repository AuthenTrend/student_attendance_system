<template lang="pug">
form.password-form(autocomplete="nofill")
  .password-change-row
    .label {{ $t('user.new_password') }}
    info-input(
      type="password",
      autocomplete="new-password",
      v-model="password",
      :msg="$t('user.info_password')",
      fill
    )
  .password-change-row
    .label
    .err-msg(v-if="passwordEmpty") {{ $t('user.password_empty_err') }}
  .password-change-row
    .label {{ $t('user.check_password') }}
    info-input(
      type="password",
      autocomplete="new-password",
      v-model="checkPassword",
      :msg="$t('user.check_password')",
      fill
    )
  .password-change-row
    .label
    .err-msg(v-if="passwordNotEqual") {{ $t('user.check_password_not_equal') }}
</template>

<script>
export default {
  data() {
    return {
      password: '',
      checkPassword: '',
      passwordNotEqual: false,
      passwordEmpty: false,
    };
  },
  mounted() {
    const that = this;
    that.$on('validate', () => {
      that.password = that.password.trim();
      that.passwordNotEqual = that.password !== that.checkPassword;
      that.passwordEmpty = that.password === '';
      if (that.passwordNotEqual || that.passwordEmpty) {
        return;
      }
      that.$emit('validateSuccess', {
        password: that.password,
      });
    });
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.password-form {
  display: flex;
  flex-direction: column;
  padding: 20px;
  width: 400px;
  .password-change-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    .label {
      margin-right: 20px;
      flex: 0 0 160px;
      text-align: right;
    }
  }
  .err-msg {
    color: $color-error;
  }
}
</style>
