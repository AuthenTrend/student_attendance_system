(function(t){function e(e){for(var s,i,u=e[0],r=e[1],l=e[2],d=0,f=[];d<u.length;d++)i=u[d],Object.prototype.hasOwnProperty.call(a,i)&&a[i]&&f.push(a[i][0]),a[i]=0;for(s in r)Object.prototype.hasOwnProperty.call(r,s)&&(t[s]=r[s]);c&&c(e);while(f.length)f.shift()();return o.push.apply(o,l||[]),n()}function n(){for(var t,e=0;e<o.length;e++){for(var n=o[e],s=!0,u=1;u<n.length;u++){var r=n[u];0!==a[r]&&(s=!1)}s&&(o.splice(e--,1),t=i(i.s=n[0]))}return t}var s={},a={signin:0},o=[];function i(e){if(s[e])return s[e].exports;var n=s[e]={i:e,l:!1,exports:{}};return t[e].call(n.exports,n,n.exports,i),n.l=!0,n.exports}i.m=t,i.c=s,i.d=function(t,e,n){i.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n})},i.r=function(t){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},i.t=function(t,e){if(1&e&&(t=i(t)),8&e)return t;if(4&e&&"object"===typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(i.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var s in t)i.d(n,s,function(e){return t[e]}.bind(null,s));return n},i.n=function(t){var e=t&&t.__esModule?function(){return t["default"]}:function(){return t};return i.d(e,"a",e),e},i.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},i.p="/";var u=window["webpackJsonp"]=window["webpackJsonp"]||[],r=u.push.bind(u);u.push=e,u=u.slice();for(var l=0;l<u.length;l++)e(u[l]);var c=r;o.push([1,"chunk-vendors","chunk-common"]),n()})({1:function(t,e,n){t.exports=n("4f05")},"21b2":function(t,e,n){"use strict";var s=n("8bf0"),a=n.n(s);a.a},"4f05":function(t,e,n){"use strict";n.r(e);n("e260"),n("e6cf"),n("cca6"),n("a79d");var s=n("2b0e"),a=n("a925"),o=n("2b27"),i=n.n(o),u=n("ee98"),r=n.n(u),l=function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"sign-in"},[t.noSignin?n("div",{staticClass:"block"},[t._v("Signin session is closed.")]):n("div",{staticClass:"block"},[n("div",{staticClass:"title-row"},[n("div",{staticClass:"title"},[t._v(t._s(t.$t("signin.list_of_signed_student")))])]),n("div",{staticClass:"list"},[n("div",{staticClass:"info"},[t._v(t._s(t.$t("signin.number_of_student_sign_in",{num:t.attendStudentsCnt})))]),n("div",{staticClass:"students"},t._l(t.students,(function(e){return n("div",{key:e.id,staticClass:"student"},[n("div",{staticClass:"name"},[t._v(t._s(e.username)+"("+t._s(e.id)+")")]),n("div",{staticClass:"status",class:{absent:2===e.status,late:1===e.status,attend:0===e.status}},[t._v(t._s(e.statusText)),e.signinTime?n("div",{staticClass:"time"},[t._v("("+t._s(e.signinTime)+")")]):t._e()])])})),0)])])])},c=[],d=(n("4de4"),{data:function(){return{students:[],noSignin:!1}},computed:{attendStudentsCnt:function(){return this.students.filter((function(t){return 0===t.status})).length}},methods:{startAutoLoad:function(){var t=localStorage.getItem("signin_students"),e=this;t&&null!==t?(e.students=JSON.parse(t),console.log("refresh")):null===t&&(e.noSignin=!0),setTimeout((function(){e.startAutoLoad()}),1e3)}},mounted:function(){this.startAutoLoad();var t=localStorage.getItem("locale");t&&(this.$i18n.locale=t)}}),f=d,p=(n("21b2"),n("2877")),v=Object(p["a"])(f,l,c,!1,null,"0ab3df5d",null),b=v.exports,g=(n("ddb8"),n("b7d1")),m=n("dc75"),_=n("4ee1"),h=n("0e3f"),y=n("5860"),w=n("6b7d"),C=n("cdae"),S=n("6783"),O=n("efa1"),j=n("e80f"),x=n("53f7");s["default"].use(j["a"]),s["default"].use(x["a"]),s["default"].use(i.a),s["default"].use(r.a),s["default"].component("text-button",_["a"]),s["default"].component("pop-windows",h["a"]),s["default"].component("info-input",y["a"]),s["default"].component("icon",C["a"]),s["default"].component("dropdown-select",O["a"]),s["default"].component("general-scroll-table",S["a"]),s["default"].component("label-switch",w["a"]),s["default"].use(a["a"]);var k=new a["a"]({locale:"en",messages:{en:g["a"],jp:m["a"]}});s["default"].config.productionTip=!1,new s["default"]({i18n:k,render:function(t){return t(b)}}).$mount("#app")},"8bf0":function(t,e,n){}});
//# sourceMappingURL=signin.8816c306.js.map