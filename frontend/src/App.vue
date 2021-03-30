<template>
  <div id="app">
    <div
      v-if="prepared"
      :class="{ blur: isBackgroundBlur }"
    >
      <div
        id="header"
        v-if="isLogin"
      >
        <div class="user-info">{{ username }}</div>
        <text-button @click="logout">{{ $t('general.logout') }}</text-button>
      </div>
      <div
        id="menu"
        v-if="isLogin && !firstLogin"
      >
        <div class="logo">
          {{ $t("system.name") }}
        </div>
        <template v-for="page in pageConfig">
          <div
            v-if="page.show"
            :key="page.key"
            class="nav-item click-button"
            :class="{ active: currentPage.key === page.key }"
            @click="goPage(page)"
          >
            {{ $t(page.nameKey) }}
          </div>
        </template>
      </div>
      <div
        id="content-container"
        :class="{full: !isLogin || firstLogin}"
      >
        <router-view id="content" />
      </div>
    </div>
    <div
      id="loading"
      v-if="showLoading"
    >
      <div class="bar" />
      <div class="bar" />
      <div class="bar" />
    </div>
    <pop-windows />
    <notifications
      group="attendance"
      class="notification"
      :duration=5000
    />
  </div>
</template>

<script>
import {
  mapState, mapMutations, mapGetters, mapActions,
} from 'vuex';
import pageConfig from '@/config/page';
import { logout, getUserKeys } from '@/utils/api';

export default {
  data() {
    pageConfig.forEach((c) => {
      c.show = true;
    });
    return {
      isBackgroundBlur: false,
      showLoading: false,
      pageConfig,
      prepared: false,
    };
  },
  computed: {
    ...mapState(['currentPage', 'userInfo', 'firstLogin']),
    ...mapGetters(['isLogin', 'username']),
  },
  watch: {
    $route() {
      const that = this;
      pageConfig.forEach((c) => {
        if (c.routerName === that.$router.currentRoute.name) {
          that.setPage(c);
        }
      });
    },
    username() {
      const that = this;
      that.pageConfig.forEach((c) => {
        c.show = c.access.indexOf(that.userInfo.type) >= 0;
      });
      that.$forceUpdate();
    },
  },
  methods: {
    ...mapActions(['setCurrentUserID']),
    ...mapMutations(['setPage', 'setToken', 'setFirstLogin']),
    logout() {
      logout().finally(() => {
        this.$router.push('/login');
      });
    },
    goPage(page) {
      this.setPage(page);
      this.$router.push(page.url);
    },
  },
  mounted() {
    const that = this;

    const locale = localStorage.getItem('locale');
    if (locale) {
      this.$i18n.locale = locale;
    }

    that.$root.$on('pop-window', () => {
      that.$nextTick(() => {
        that.isBackgroundBlur = true;
      });
    });
    that.$root.$on('close-window', () => {
      that.$nextTick(() => {
        that.isBackgroundBlur = false;
      });
    });
    that.$root.$on('start-loading', () => {
      that.showLoading = true;
      that.isBackgroundBlur = true;
    });
    that.$root.$on('stop-loading', () => {
      that.showLoading = false;
      that.isBackgroundBlur = false;
    });

    pageConfig.forEach((c) => {
      if (c.routerName === that.$router.currentRoute.name) {
        that.setPage(c);
      }
    });
    const secret = that.$cookies.get('sd');
    const token = that.$cookies.get('ut');
    const user = that.$cookies.get('user');
    if (that.$router.currentRoute.name !== 'Login' && secret !== null && token !== null) {
      that.setToken({ secret, token });
      getUserKeys(user)
        .then((rsp) => {
          if (rsp.result.length === 0) {
            that.setFirstLogin(true);
          }
        })
        .then(() => that.setCurrentUserID(user))
        .then((data) => {
          console.log(data);
          that.pageConfig.forEach((c) => {
            c.show = c.access.indexOf(data.result.type) >= 0;
          });
          that.prepared = true;
          that.$forceUpdate();
        });
    }
    console.log(!that.isLogin, that.$router.currentRoute.name !== 'Login');
    if (!that.isLogin && that.$router.currentRoute.name !== 'Login') {
      console.log('login');
      that.$router.push('/login');
      that.prepared = true;
    } else if (that.$router.currentRoute.name === 'Login') {
      that.prepared = true;
    }
  },
};
</script>

<style lang="scss">
@import "assets/styles/variable.scss";

body {
  margin: 0;
}
div {
  margin: 0;
  box-sizing: border-box;
}
input {
  color: $color-font-normal;
  &[disabled] {
    color: $color-font-disabled;
  }
}
input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
  display: none;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  & > .blur {
    filter: blur(5px);
  }

  #header {
    height: $header-height;
    width: calc(100vw - #{$menu-width});
    position: absolute;
    left: $menu-width;
    top: 0;
    padding-right: 20px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    .text-button {
      margin-left: 8px;
    }
    font-size: 12px;
  }

  #menu {
    position: absolute;
    left: 0;
    top: 0;
    height: 100vh;
    width: $menu-width;
    box-shadow: 5px 0 10px 0 rgba(0, 0, 0, 0.08);
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      height: $header-height;
      text-align: center;
      // padding: 0 60px;
    }
    .nav-item {
      height: 52px;
      line-height: 52px;
      text-align: center;
      &.active {
        background-color: #eaf3ff;
        border-left: 4px solid $color-primary;
      }
    }
  }
  #content-container {
    background: #eeeeee;
    position: absolute;
    left: $menu-width;
    top: $header-height;
    height: calc(100vh - #{$header-height});
    width: calc(100vw - #{$menu-width});

    &.full {
      height: 100vh;
      width: 100vw;
      left: 0;
      top: 0;
      padding: 0;

      #content {
        border-radius: 0;
        box-shadow: none;
        height: 100vh;
      }
    }

    padding: 20px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    & > div,
    #content {
      border-radius: 4px;
      box-shadow: 0 4px 9px 0 rgba(115, 115, 115, 0.2),
        0 5px 8px 0 rgba(228, 228, 228, 0.5);
      background: white;
      width: 100%;
      height: calc(100vh - 40px - #{$header-height});

      @include auto-overflow();
      @include customScrollbar();

      display: flex;
      flex-direction: column;
      .title {
        font-size: 16px;
        &.row {
          display: flex;
          align-items: center;
          .link {
            text-decoration: underline;
            color: $active-color;
          }
          .seperator {
            &::before {
              content: ">";
              padding: 0 8px;
            }
          }
        }
      }
      .row {
        flex: 0 0 60px;
        line-height: 60px;
        padding-left: 20px;
        box-shadow: inset 0 -1px 0 0 #e9e9e9;
        .text-button {
          margin-right: 8px;
        }
      }
      .block {
        flex: 1;
      }
    }
  }
  #loading {
    position: fixed;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;

    .bar {
      width: 10px;
      height: 5px;
      background: $color-primary;
      margin: 2px;
      animation: bar 1s infinite linear;

      &:nth-child(1) {
        animation-delay: 0s;
      }

      &:nth-child(2) {
        animation-delay: 0.25s;
      }

      &:nth-child(3) {
        animation-delay: 0.5s;
      }
    }

    @keyframes bar {
      0% {
        transform: scaleY(1) scaleX(0.5);
      }

      50% {
        transform: scaleY(10) scaleX(1);
      }

      100% {
        transform: scaleY(1) scaleX(0.5);
      }
    }
  }
}
.notification {
  margin: 20px;
}
.pagination {
  user-select: none;
  display: inline-block;
  padding-left: 0;
  margin: 8px 8px;
  border-radius: 4px;

  li {
    display: inline; // Remove list-style and block-level defaults
    a,
    span {
      position: relative;
      float: left; // Collapse white-space
      padding: 6px 12px;
      line-height: 1;
      text-decoration: none;
      // color: $color-primary;
      background-color: #fff;
      border: 1px solid $color-borderline;
      margin-left: -1px;
    }
    &:first-child {
      a,
      span {
        margin-left: 0;
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
      }
    }
    &:last-child {
      a,
      span {
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
      }
    }
  }

  li a,
  li span {
    &:hover,
    &:focus {
      z-index: 3;
      color: $color-primary;
      background-color: #eee;
      border-color: $color-borderline-hover;
      outline: none;
    }
  }

  .active a,
  .active span {
    &,
    &:hover,
    &:focus {
      z-index: 2;
      color: $color-primary;
      background-color: #ddd;
      // border-color: $color-primary;
      cursor: default;
    }
  }

  .disabled {
    span,
    span:hover,
    span:focus,
    a,
    a:hover,
    a:focus {
      cursor: not-allowed;
    }
  }
}
</style>
