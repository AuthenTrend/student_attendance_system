export const ADMIN_TYPE = 0;
export const TEACHER_TYPE = 1;
export const STUDENT_TYPE = 2;

const TimeCol = {
  labelKey: 'general.time',
  valueKey: 'timeStr',
};
const ClassCol = {
  labelKey: 'general.class',
  valueKey: 'class',
};
const KeyCol = {
  labelKey: 'general.key_used',
  valueKey: 'key_use_boolean',
};
const IPCol = {
  labelKey: 'general.ip',
  valueKey: 'ip',
};

export const userRecordColumnList = {
  [ADMIN_TYPE]: [TimeCol, KeyCol, IPCol],
  [TEACHER_TYPE]: [TimeCol, IPCol],
  [STUDENT_TYPE]: [TimeCol, ClassCol, KeyCol, IPCol],
};
