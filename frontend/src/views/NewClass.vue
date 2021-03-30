<template>
  <div
    class="new-class"
    id="content"
  >
    <div
      class="title row"
      v-if="!editMode"
    >
      <span
        class="click-button link"
        @click="goClasses"
      > {{ $t('page.classes') }} </span>
      <div class="seperator"></div>
      <span>
        {{ $t('class.add_class') }}
      </span>
    </div>
    <div
      class="title row"
      v-if="editMode"
    >
      <span
        class="click-button link"
        @click="goClasses"
      > {{ $t('page.classes') }} </span>
      <div class="seperator"></div>
      <span
        class="click-button link"
        @click="goClass"
      > {{ id }} </span>
      <div class="seperator"></div>
      {{ $t('class.edit_class') }}
    </div>
    <div class="block">
      <div class="class-form">
        <div class="form-row">
          <div class="label">{{ $t('class.category') }}</div>
          <info-input
            v-model="category"
            :msg="$t('class.info_category')"
            fill
            @blur="checkError(category)"
          />
        </div>
        <div
          class="form-row error"
          v-if="categoryErr !== ''"
        >
          <div class="label"></div>
          <div>{{categoryErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.class_no') }}</div>
          <info-input
            v-model="no"
            :msg="$t('class.info_no')"
            fill
            :disabled="editMode"
            @blur="checkError(no)"
          />
        </div>
        <div
          class="form-row error"
          v-if="classNoErr !== ''"
        >
          <div class="label"></div>
          <div>{{classNoErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.name') }}</div>
          <info-input
            v-model="name"
            :msg="$t('class.info_name')"
            fill
            @blur="checkError(name)"
          />
        </div>
        <div
          class="form-row error"
          v-if="nameErr !== ''"
        >
          <div class="label"></div>
          <div>{{nameErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.campusName') }}</div>
          <dropdown-select
            v-model="campus"
            :options="campuses"
            width="150px"
            fixed-list-width
          />
        </div>
        <div
          class="form-row error"
          v-if="campusErr !== ''"
        >
          <div class="label"></div>
          <div>{{campusErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.day') }}</div>
          <dropdown-select
            v-model="date"
            :options="dates"
            width="150px"
            fixed-list-width
          />
        </div>
        <div
          class="form-row error"
          v-if="dateErr !== ''"
        >
          <div class="label"></div>
          <div>{{dateErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.period') }}</div>
          <dropdown-select
            v-model="period"
            :options="periods"
            :disabled="campus === undefined"
            width="150px"
            fixed-list-width
          />
        </div>
        <div
          class="form-row error"
          v-if="periodErr !== ''"
        >
          <div class="label"></div>
          <div>{{periodErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.teacherName') }}</div>
          <dropdown-select
            v-model="teacher"
            :options="teachers"
            width="150px"
            fixed-list-width
          />
        </div>
        <div
          class="form-row error"
          v-if="teacherErr !== ''"
        >
          <div class="label"></div>
          <div>{{teacherErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.lateAfter') }}</div>
          <info-input
            v-model="lateAfter"
            type="number"
            :max="absentAfter"
            :msg="$t('class.info_late_after')"
            fill
          />
          <div class="rear-label">{{ $t('general.minutes') }}</div>
        </div>
        <div
          class="form-row error"
          v-if="lateAfterErr !== ''"
        >
          <div class="label"></div>
          <div>{{lateAfterErr}}</div>
        </div>
        <div class="form-row">
          <div class="label">{{ $t('class.absenceAfter') }}</div>
          <info-input
            v-model="absentAfter"
            type="number"
            :msg="$t('class.info_absent_after')"
            fill
          />
          <div class="rear-label">{{ $t('general.minutes') }}</div>
        </div>
        <div class="form-row">
          <text-button
            button-type="primary"
            @click="saveClass"
          >
            <span v-if="editMode">{{$t('general.save')}}</span>
            <span v-else>{{$t('general.add')}}</span>
          </text-button>
          <text-button
            class="cancel-btn"
            @click="cancel"
          > {{$t('general.cancel')}} </text-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { campuses } from '@/utils/mock';
import {
  addClass, getUsers, getCampuses, getClass, updateClass,
} from '@/utils/api';
import { paddingNumToTwo } from '@/utils/format';

export default {
  props: {
    id: {
      required: false,
    },
  },
  data() {
    const campusMap = {};
    campuses.forEach((c) => {
      campusMap[c.id] = c;
    });
    return {
      name: '',
      category: '',
      no: '',
      lateAfter: 10,
      absentAfter: 15,

      campusesInfo: campusMap,

      campus: [],

      period: undefined,

      teacher: [],
      teachers: [],

      campuses: [],

      date: [1],
      dates: [],

      categoryErr: '',
      nameErr: '',
      dateErr: '',
      campusErr: '',
      periodErr: '',
      classNoErr: '',
      teacherErr: '',
      timeSetErr: '',
      lateAfterErr: '',

      checkData: [
        { key: 'category', errMsgKey: 'categoryErr', errKey: 'class.categoryEmptyErr' },
        { key: 'no', errMsgKey: 'classNoErr', errKey: 'class.classNoEmptyErr' },
        { key: 'name', errMsgKey: 'nameErr', errKey: 'class.nameEmptyErr' },
        { key: 'date', errMsgKey: 'dateErr', errKey: 'class.dateEmptyErr' },
        { key: 'campus', errMsgKey: 'campusErr', errKey: 'class.campusEmptyErr' },
        { key: 'period', errMsgKey: 'periodErr', errKey: 'class.periodEmptyErr' },
        { key: 'teacher', errMsgKey: 'teacherErr', errKey: 'class.teacherEmptyErr' },
      ],
      classIsExist: false,
    };
  },
  computed: {
    ...mapState(['userInfo']),
    editMode() {
      return this.id !== '' && this.classIsExist;
    },
    periods() {
      const campusIdx = this.campuses.findIndex((c) => {
        if (this.campus.length > 0) {
          return c.id === this.campus[0];
        }
        return false;
      });
      if (campusIdx >= 0) {
        return this.campuses[campusIdx].periods.map((period, idx) => ({
          text: `${idx + 1} - ${paddingNumToTwo(period.start_time.hour)}:${paddingNumToTwo(period.start_time.minute)}`,
          value: idx,
        }));
      }
      return [];
    },
  },
  methods: {
    goClass() {
      this.$router.push({ name: 'Class', props: { id: this.id } });
    },
    goClasses() {
      this.$router.push({ name: 'Classes' });
    },
    checkError(key, all) {
      console.log('blur');
      const that = this;

      let hasErr = false;
      that.checkData.forEach((check) => {
        if (key !== that[check.key] && !all) {
          return;
        }
        if (hasErr && !all) {
          return;
        }
        if (Array.isArray(that[check.key])) {
          if (!all) {
            return;
          }
          if (that[check.key].length <= 0) {
            that[check.errMsgKey] = that.$t(check.errKey);
            hasErr = true;
            return;
          }
        }
        if (that[check.key] === undefined) {
          if (!all) {
            return;
          }
          that[check.errMsgKey] = that.$t(check.errKey);
          hasErr = true;
          return;
        }
        if (that[check.key] === '') {
          that[check.errMsgKey] = that.$t(check.errKey);
          hasErr = true;
          return;
        }
        if (typeof check.check === 'function') {
          if (!check.check(that[check.key])) {
            that[check.errMsgKey] = that.$t(check.errKey);
            hasErr = true;
            return;
          }
        }
        that[check.errMsgKey] = '';

        console.log(check.key, Array.isArray(that[check.key]), that[check.key]);
      });

      return !hasErr;
    },
    saveClass() {
      const that = this;

      if (!that.checkError('', true)) {
        return;
      }

      const classInfo = {
        class_no: that.no,
        name: that.name,
        category: that.category,

        date: that.date[0],

        campus: that.campus[0],
        campusName: that.campuses.find((t) => t.value === that.campus[0]).text,
        period: parseInt(that.period[0], 10) + 1,
        teacherId: that.teacher[0],
        teacherName: that.teachers.find((t) => t.value === that.teacher[0]).text,
        lateAfter: that.lateAfter,
        absenceAfter: that.absentAfter,
        students: [],
      };

      console.log(classInfo);
      const promise = this.editMode ? updateClass(that.no, classInfo) : addClass(classInfo);
      promise
        .then(() => {
          if (this.editMode) {
            that.$router.push({ name: 'Class', props: { id: this.id } });
          } else {
            that.$router.push({ name: 'Classes' });
          }
        }).then(() => {
          that.$notify({
            group: 'attendance',
            title: that.$t('general.update_success'),
            type: 'success',
          });
        })
        .catch((e) => {
          that.$notify({
            group: 'attendance',
            title: that.$t('class.add_class_fail'),
            type: 'error',
            text: that.$t(`error.${e.response.data.error}`),
          });
        });
    },
    cancel() {
      if (!this.editMode) {
        this.$router.push({ name: 'Classes' });
      } else {
        this.$router.push({ name: 'Class', props: { id: this.id } });
      }
    },
    loadUsers() {
      const that = this;
      const teachers = [];
      that.$startLoading();
      if (that.userInfo.type === 1) {
        teachers.push(JSON.parse(JSON.stringify(that.userInfo)));
      }
      return getUsers()
        .then((rsp) => {
          teachers.push(...rsp.result.filter((u) => u.type === 'teacher' || u.type === 1));
          that.teachers = teachers.map((t) => ({
            text: t.username || t.name,
            value: t.id,
          }));
          if (that.teachers.length > 0) {
            that.teacher = [that.teachers[0].value];
          }
        })
        .finally(() => {
          that.$endLoading();
        });
    },
    loadData() {
      const that = this;
      let returnCampuses = [];
      that.$startLoading();
      let promise = getCampuses().then((rsp) => {
        returnCampuses = rsp.result.map((c) => {
          c.text = c.name;
          c.value = c.id;
          return c;
        });
      });
      if (this.id !== '') {
        promise = promise.then(() => getClass(that.id))
          .then((rsp) => {
            that.no = rsp.result.class_no;
            that.name = rsp.result.name;
            that.category = rsp.result.category;
            that.date = [rsp.result.date];
            const idx = returnCampuses.findIndex((c) => c.text === rsp.result.campusName);
            that.campus = [returnCampuses[idx].value];
            that.period = [rsp.result.period - 1];
            that.teacher = [rsp.result.teacherId];
            that.lateAfter = rsp.result.lateAfter;
            that.absentAfter = rsp.result.absenceAfter;
            that.classIsExist = true;
            that.$nextTick(() => {
              that.$forceUpdate();
            });
          });
      }
      promise = promise
        .then(() => {
          that.campuses = returnCampuses;
        })
        .finally(() => {
          that.$endLoading();
        });
      return promise;
    },
  },
  mounted() {
    console.log('mounted');
    this.loadUsers()
      .then(() => this.loadData());
    this.dates = [
      { text: this.$t('general.monday'), value: 1 },
      { text: this.$t('general.tuesday'), value: 2 },
      { text: this.$t('general.wednesday'), value: 3 },
      { text: this.$t('general.thursday'), value: 4 },
      { text: this.$t('general.friday'), value: 5 },
      { text: this.$t('general.saturday'), value: 6 },
      { text: this.$t('general.sunday'), value: 0 },
    ];
    this.checkData.push(
      {
        key: 'lateAfter',
        errMsgKey: 'lateAfterErr',
        errKey: 'class.lateAfterBiggerThenAbsentErr',
        check: (val) => parseInt(val, 10) <= parseInt(this.absentAfter, 10),
      },
    );
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/styles/variable.scss";

.class-form {
  display: flex;
  flex-direction: column;
  padding: 20px;
  width: 500px;
  .form-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    &.error {
      color: $color-error;
    }
    .label {
      margin-right: 8px;
      flex: 0 0 100px;
      text-align: right;
    }
    .rear-label {
      margin-left: 8px;
    }
    .cancel-btn {
      margin-left: 8px;
    }
  }
}
</style>
