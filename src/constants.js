
const ADMIN_ID = "root";
const ADMIN_TYPE = 0;
const TEACHER_TYPE = 1;
const STUDENT_TYPE = 2;
const USER_TYPES = {ADMIN_TYPE, TEACHER_TYPE, STUDENT_TYPE};
const ADMIN_ALLOWED_USER_TYPE = [TEACHER_TYPE, STUDENT_TYPE];
const TEACHER_ALLOWED_USER_TYPE = [STUDENT_TYPE];
const FIDO_LOGIN_ALLOWED_USER_TYPE = [ADMIN_TYPE, TEACHER_TYPE, STUDENT_TYPE];
const CLASS_SIGN_IN_USER_TYPE = [STUDENT_TYPE];

const DELETE_PREFIX = "XXXXXX";

const ADMIN_LOGIN = 0;
const FIDO_LOGIN = 1;
const STUDENT_LOGIN = 2;
const MANUAL_LOGIN = 3;
const LOGIN_TYPES = {ADMIN_LOGIN, FIDO_LOGIN, STUDENT_LOGIN, MANUAL_LOGIN};

const ROLLCALL_STATE_NORMAL = 0;
const ROLLCALL_STATE_LATE = 1;
const ROLLCALL_STATE_ABSENCE = 2;
const ROLLCALL_STATES = {ROLLCALL_STATE_NORMAL, ROLLCALL_STATE_LATE, ROLLCALL_STATE_ABSENCE};

const DEFAULT_LOGIN_TIMEOUT = ((process.env.SESSION_TIMEOUT) ? parseInt(process.env.SESSION_TIMEOUT) : 30 * 60); // 30 minutes
const DEFAULT_CHALLENGE_TIMEOUT = 2 * 60; // 2 minutes
const STUDENT_LOGIN_EARLY_BUFFER = ((process.env.STUDENT_LOGIN_EARLY_BUFFER) ? parseInt(process.env.STUDENT_LOGIN_EARLY_BUFFER) : 10); // 10 minutes

const ACCOUNT_LOGIN = "Account";
const FIDO_KEY_LOGIN = "FIDO Key";
const TEACHER_CALL_NAME_LOGIN = "Manual";
const LOGIN_KEY_TYPES = {ACCOUNT_LOGIN, FIDO_KEY_LOGIN, TEACHER_CALL_NAME_LOGIN};

const englishTable = {
    date: ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."],
    userTypes: ["root", "teacher", "student"],
};

const japaneseTable = {
    date: ["日", "月", "火", "水", "木", "金", "土"],
    userTypes: ["管理者", "教師", "生徒"],
};

const languages = {
    "en-US": englishTable,
    "ja-JP": japaneseTable
};

module.exports = {
    ADMIN_ALLOWED_USER_TYPE, ADMIN_ID, CLASS_SIGN_IN_USER_TYPE, DELETE_PREFIX,
    DEFAULT_CHALLENGE_TIMEOUT, DEFAULT_LOGIN_TIMEOUT, FIDO_LOGIN_ALLOWED_USER_TYPE,
    languages, LOGIN_KEY_TYPES, LOGIN_TYPES, ROLLCALL_STATES,
    STUDENT_LOGIN_EARLY_BUFFER, TEACHER_ALLOWED_USER_TYPE, USER_TYPES
};
