<template lang="pug">
.info-input.icon-input(
  ref="infoInput",
  :class="{ 'ie-focus-within': isFocus, fill: fill, flex: flex, disabled: disabled, error: error }",
  v-tooltip="errorTooltip"
)
  input(
    v-if="!showPassword",
    v-model="text",
    ref="input",
    :placeholder="placeholder",
    :disabled="disabled",
    :maxlength="maxlength",
    :type="type",
    :max="type === 'number' ? max : ''",
    :min="type === 'number' ? min : ''"
    :autocomplete="autocomplete",
    @input="$emit('input', text)",
    @focus="toggleFocus(true)",
    @blur="blur",
    :name="name"
  )
  input(
    v-else,
    v-model="text",
    ref="input",
    :placeholder="placeholder",
    :disabled="disabled",
    :maxlength="maxlength",
    :autocomplete="autocomplete",
    @input="$emit('input', text)",
    @focus="toggleFocus(true)",
    @blur="blur",
    :name="name"
  )
  .toggle-password(v-if="type === 'password'")
    icon(
      v-if="!showPassword",
      icon-type="show_password",
      :size="16",
      @click="showPassword = true"
    )
    icon(
      v-else,
      icon-type="hide_password",
      :size="16",
      @click="showPassword = false"
    )
  .input-icon.info-icon(
    v-if="msg !== ''",
    ref="infoIcon",
    v-tooltip="infoTooltip"
  )
    icon(icon-type="info", :size="16", enableHover)
  </div>
</div>
</template>

<script>
import misc from '@/utils/misc';

function createEvent(eventname) {
  let event;
  if (typeof Event === 'function') {
    event = new Event(eventname);
  } else { // IE 11 do not support Event()
    event = document.createEvent('Event');
    event.initEvent(eventname, false, false);
  }
  return event;
}

export default {
  props: {
    value: {
      type: [String, Number],
      required: true,
    },
    type: {
      type: String,
      required: false,
      default: 'text',
    },
    fill: {
      type: Boolean,
      required: false,
      default: false,
    },
    flex: {
      type: Boolean,
      required: false,
      default: false,
    },
    placeholder: {
      type: String,
      required: false,
      default: '',
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    maxlength: {
      type: Number,
      required: false,
    },
    error: {
      type: Boolean,
      required: false,
      default: false,
    },
    errorMsg: {
      type: String,
      required: false,
      default: '',
    },
    msg: {
      type: String,
      required: false,
      default: '',
    },
    autocomplete: {
      type: String,
      required: false,
      default: '',
    },
    max: {
      type: Number,
      required: false,
      default: undefined,
    },
    min: {
      type: Number,
      required: false,
      default: 0,
    },
    name: {
      type: String,
      required: false,
      default: misc.randomStr(),
    },
  },
  data() {
    return {
      text: '',
      isFocus: false,
      errorTooltip: {
        msg: '',
        eventOnly: true,
        errorType: true,
        alignLeft: true,
      },
      showPassword: false,
    };
  },
  computed: {
    infoTooltip() {
      const { msg } = this;
      return {
        msg,
        top: 0,
        alignLeft: true,
      };
    },
  },
  watch: {
    value() {
      this.text = this.value;
    },
    errorMsg() {
      const that = this;
      that.errorTooltip.msg = that.errorMsg;
      that.$refs.infoInput.dispatchEvent(createEvent('tooltip-reload'));
    },
    error() {
      const that = this;
      if (that.error) {
        that.$refs.infoInput.dispatchEvent(createEvent('tooltip-show'));
        // reposition info tooltip
        const extralines = Math.ceil(that.msg.length / 25) - 1; // each line can fit about 25 words
        that.infoTooltip.top = 30 + 30 + (extralines * 18) + 8;
        // inputHeight + tooltipHeight + extralines * lineheight + padding
        that.$refs.infoIcon.dispatchEvent(createEvent('tooltip-reload'));
      } else {
        that.$refs.infoInput.dispatchEvent(createEvent('tooltip-hide'));
        // reposition info tooltip
        that.infoTooltip.top = 0;
        that.$refs.infoIcon.dispatchEvent(createEvent('tooltip-reload'));
      }
    },
    max() {
      this.$forceUpdate();
    },
  },
  methods: {
    focus() {
      this.$refs.input.focus();
      this.toggleFocus(true);
    },
    toggleFocus(bool) {
      this.isFocus = bool;
    },
    blur() {
      this.toggleFocus(false);
      this.$emit('blur');
    },
  },
  mounted() {
    this.text = this.value;
  },
};
</script>

<style lang="scss" scoped>
@import "../assets/styles/variable";

$input-height: 28px;

.info-input {
  height: $input-height;
  display: inline-flex;
  &.fill {
    width: 100%;
    display: flex;

    input {
      display: block;
      flex: 1;
      width: auto;
    }
    .input-icon {
      flex: 0 0 auto;
    }
  }

  .info-icon {
    &:hover {
      cursor: pointer;
    }
  }
}
input {
  outline: none;
  background: transparent;
}

/* workaround of focus-within of IE*/
.ie-focus-within {
  outline: none;
  box-shadow: 0 0 0 2px rgba(75, 75, 100, 0.2);
  border-color: $color-borderline-hover;
}

.icon-input {
  box-sizing: border-box;
  width: 160px;
  border: solid 1px $color-borderline;
  border-radius: 2px;
  background: white;
  display: flex;
  align-items: center;
  position: relative;
  &:hover {
    border-color: $color-borderline-hover;
  }
  &.disabled {
    border-color: $color-borderline-disabled;
  }
  &:focus-within {
    /** do not support IE **/
    outline: none;
    box-shadow: 0 0 0 2px rgba(75, 75, 100, 0.2);
    border-color: $color-borderline-hover;
  }
  &.error {
    background-color: $color-input-error;
  }

  input {
    flex: 1 1 0px; // IE11 Hack: give flex-basis specific px or %
    min-width: 0px;
    padding: 4px 8px;
    padding-right: 0px;
    border: 0px;
    &:focus {
      outline: none;
      box-shadow: none;
    }
  }
  .toggle-password {
    flex: 0 0 auto;
    padding-top: 3px;
  }
  .input-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 4px 8px;
  }
}
</style>
