<template lang="pug">
.check
  .title {{ title }}
  info-input(v-model="data")
</template>

<script>
export default {
  props: {
    extData: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      data: '',
      title: '',
    };
  },
  mounted() {
    this.data = this.extData.data;
    this.title = this.extData.title;
    this.$on('validate', () => {
      this.$emit('validateSuccess', this.data);
    });
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.check {
  padding: 20px;
  display: flex;
  align-items: center;
  .title {
    margin-right: 8px;
  }
}
</style>
