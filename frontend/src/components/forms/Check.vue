<template lang="pug">
.check {{ msg }}
</template>

<script>
export default {
  props: {
    extData: {
      type: Object,
      required: true,
    },
  },
  computed: {
    msg() {
      return this.extData ? this.extData.msg : '';
    },
  },
};
</script>

<style lang="scss" scoped>
.check {
  padding: 20px;
}
</style>
