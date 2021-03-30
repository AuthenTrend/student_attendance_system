const MyPlugin = {
  install(Vue) {
    Vue.mixin({
      created() {
        const that = this;

        that.$startLoading = () => that.$root.$emit('start-loading');
        that.$endLoading = () => that.$root.$emit('stop-loading');
      },
    });
  },
};

export default MyPlugin;
