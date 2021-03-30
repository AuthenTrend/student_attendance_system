<template>
  <div class="class-form">
    <div class="row">
      <div class="label">{{ $t('general.name') }}</div>
      <info-input
        v-model="campusName"
        :msg="$t('campus.name_info')"
        fill
        :error="isUserNameTooltipShown"
        :errorMsg="userNameErrorMsg"
      />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      campusName: '',
      nameMaxLength: 64,
      isUserNameTooltipShown: false,
      userNameErrorMsg: '',
    };
  },
  methods: {
    validate() {
      this.$emit('validateSuccess', this.campusName);
    },
  },
  mounted() {
    this.$on('validate', this.validate);
  },
};
</script>

<style lang="scss" scoped>
.class-form {
  display: flex;
  flex-direction: column;
  padding: 20px;
  width: 400px;
  .row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    .label {
      margin-right: 20px;
      flex: 0 0 100px;
      text-align: right;
    }
  }
}
</style>
