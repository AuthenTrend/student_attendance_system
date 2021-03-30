import Vue from 'vue';
import VueI18n from 'vue-i18n';
import vueCookies from 'vue-cookies';
import Notifications from 'vue-notification';

import SigninPage from './SigninPage.vue';
import './registerServiceWorker';
import en from './i18n/en';
import jp from './i18n/jp';

import TextButton from './components/TextButton.vue';
import PopWindows from './components/PopWindows.vue';
import InfoInput from './components/InfoInput.vue';
import LabelSwitch from './components/LabelSwitch.vue';

import Icon from './components/Icon.vue';
import GeneralScrollTable from './components/GeneralScrollTable';
import DropdownSelect from './components/DropdownSelect.vue';
import Tooltip from './plugins/tooltip';
import Loading from './plugins/loading';

Vue.use(Tooltip);
Vue.use(Loading);
Vue.use(vueCookies);
Vue.use(Notifications);

Vue.component('text-button', TextButton);
Vue.component('pop-windows', PopWindows);
Vue.component('info-input', InfoInput);
Vue.component('icon', Icon);
Vue.component('dropdown-select', DropdownSelect);
Vue.component('general-scroll-table', GeneralScrollTable);
Vue.component('label-switch', LabelSwitch);

Vue.use(VueI18n);
const i18n = new VueI18n({
  locale: 'en',
  messages: { en, jp },
});

Vue.config.productionTip = false;

new Vue({
  i18n,
  render: (h) => h(SigninPage),
}).$mount('#app');
