<template lang="pug">
.file-form
  .title {{ $t('file.choose_import_file') }}
  .row
    text-button(@click="showSelectFile") {{ $t('file.select_csv') }}
    .file-name {{ fileName }}
    input(type="file", @change="chooseFile", hidden, ref="fileSelector")
  .row(v-if="showErr")
    .error {{ $t('file.err_csv_file_not_choose') }}
</template>

<script>
export default {
  name: 'FileForm',
  data() {
    return {
      file: undefined,
      showErr: false,
      fileName: '',
    };
  },
  methods: {
    showSelectFile() {
      this.$refs.fileSelector.click();
    },
    chooseFile(e) {
      const that = this;
      console.log(e.target.files);
      if (e.target.files.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        // that.file = e.target.files[0];
        const fileName = e.target.files[0].name;
        that.fileName = 'Loading file...';

        const reader = new FileReader();
        reader.addEventListener('load', (e2) => {
          that.file = new File([e2.target.result], fileName, { type: 'text/csv' });
          that.fileName = fileName;
        });

        reader.readAsText(e.target.files[0]);
      }
    },
    validate() {
      if (this.file !== undefined) {
        this.$emit('validateSuccess', this.file);
      } else {
        this.showErr = true;
      }
    },
  },
  mounted() {
    this.$on('validate', this.validate);
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.file-form {
  min-width: 300px;
  display: flex;
  flex-direction: column;
  padding: 20px;
  .row {
    display: flex;
    flex-direction: row;
    align-items: center;

    margin-top: 8px;
    .file-name {
      margin-left: 8px;
    }
    .error {
      color: $color-error;
      font-size: 0.8em;
    }
    input {
      visibility: hidden;
    }
  }
}
</style>
