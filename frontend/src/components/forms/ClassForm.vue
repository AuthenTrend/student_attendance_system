<template>
  <div class="class-form">
    <div class="row">
      <div class="label">Category</div>
      <info-input
        v-model="category"
        :msg="$t('class.info_category')"
        fill
        :error="isUserNameTooltipShown"
        :errorMsg="userNameErrorMsg"
      />
    </div>
    <div class="row">
      <div class="label">Name</div>
      <info-input v-model="name" :msg="$t('class.info_name')" fill />
    </div>
    <div class="row">
      <div class="label">Class No</div>
      <info-input v-model="no" :msg="$t('class.info_no')" fill />
    </div>
    <div class="row">
      <div class="label">Teacher</div>
      <dropdown-select
        v-model="teacher"
        :options="teachers"
        width="150px"
        fixed-list-width
      />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      name: '',
      category: '',
      no: '',

      teacher: ['TA'],
      teachers: [
        {
          text: 'Teacher A',
          value: 'TA',
        },
        {
          text: 'Teacher B',
          value: 'TB',
        },
        {
          text: 'Teacher C',
          value: 'TC',
        },
      ],
    };
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
      margin-right: 8px;
      flex: 0 0 100px;
    }
  }
}
</style>
