export function paddingNumToTwo(num) {
  return num >= 10 ? num.toString() : `0${num}`;
}

export function datetimeToString(date) {
  const time = new Date(date);

  // eslint-disable-next-line no-restricted-globals
  if (isNaN(time.getTime())) {
    return '';
  }

  const month = paddingNumToTwo(time.getMonth() + 1);
  const day = paddingNumToTwo(time.getDate());
  const hour = paddingNumToTwo(time.getHours());
  const min = paddingNumToTwo(time.getMinutes());
  const sec = paddingNumToTwo(time.getSeconds());

  return `${time.getFullYear()}/${month}/${day} ${hour}:${min}:${sec}`;
}

export function dateToString(date) {
  const month = paddingNumToTwo(date.getMonth() + 1);
  const day = paddingNumToTwo(date.getDate());

  return `${date.getFullYear()}${month}${day}`;
}

const textKeyMap = [
  'general.sunday',
  'general.monday',
  'general.tuesday',
  'general.wednesday',
  'general.thursday',
  'general.friday',
  'general.saturday',
];
export function getDateTextKey(value) {
  return textKeyMap[value];
}
