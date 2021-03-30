<template>
  <div class="class-form">
    <div class="row">
      <div class="label">{{ $t('user.info_name') }}</div>
      <info-input
        v-model="name"
        :msg="$t('user.info_name')"
        fill
      />
    </div>
    <div
      class="row"
      v-if="showNameError"
    >
      <div class="label"></div>
      <div class="err-msg">{{ $t('user.name_empty_err') }}</div>
    </div>
    <div class="row">
      <div class="label">{{ $t('general.id') }}</div>
      <info-input
        v-model="id"
        :msg="$t('general.id')"
        fill
      />
    </div>
    <div
      class="row"
      v-if="showIDError"
    >
      <div class="label"></div>
      <div class="err-msg">{{ $t('user.id_empty_err') }}</div>
    </div>
    <div class="row">
      <div class="label">{{ $t('user.info_type') }}</div>
      <dropdown-select
        :disabled="currentUserType === 1"
        v-model="userType"
        :options="userTypes"
        width="150px"
        fixed-list-width
      />
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  data() {
    return {
      name: '',
      id: '',

      userType: [2],
      userTypes: [
        {
          text: this.$t('general.student'),
          value: 2,
        },
      ],
      showNameError: false,
      showIDError: false,
    };
  },
  computed: {
    showAcountCol() {
      return this.userType[0] === 0;
    },
    ...mapGetters(['currentUserType']),
  },
  mounted() {
    const that = this;

    if (that.currentUserType === 0) {
      that.userTypes.unshift(
        {
          text: this.$t('general.teacher'),
          value: 1,
        },
      );
    }

    that.$on('validate', () => {
      that.name = that.name.trim();
      that.id = that.id.trim();
      if (that.name === '') {
        that.showNameError = true;
      }
      if (that.id === '') {
        that.showIDError = true;
      }
      if (that.showIDError || that.showNameError) {
        return;
      }

      that.$emit('validateSuccess', {
        username: that.name,
        id: that.id,
        type: that.userType[0],
      });
    });
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

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
      text-align: right;
    }
    .err-msg {
      color: $color-error;
    }
  }
}
</style>
