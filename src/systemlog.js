
const rfs = require("rotating-file-stream");

const DEFAULT_LOG_PATH = process.env.DEFAULT_LOG_PATH || "./logs";

const logStream = rfs.createStream(
    "access.log",
    {interval: "7d",    // every 7 days
    size: "25M",
    path: `${DEFAULT_LOG_PATH}`});      // every 25 MegaBytes

const syslog = {};

syslog.getLogFileStream = () => {
    return logStream;
}

syslog.getTimeString = (time) => {
    let d = `0${time.getUTCDate()}`;
    d = d.substring(d.length - 2);
    let mo = `0${time.getUTCMonth() + 1}`;
    mo = mo.substring(mo.length - 2);
    let h = `0${time.getUTCHours()}`;
    h = h.substring(h.length - 2);
    let m = `0${time.getUTCMinutes()}`;
    m = m.substring(m.length - 2);
    let s = `0${time.getUTCSeconds()}`;
    s = s.substring(s.length - 2);
    return `${d}-${mo}-${time.getUTCFullYear()} ${h}:${m}:${s}`;
}

syslog.info = (message) => {
    let t = syslog.getTimeString(new Date());
    logStream.write(`${t} [INFO] ${message}\n`);
}

syslog.error = (message) => {
    let t = syslog.getTimeString(new Date());
    logStream.write(`${t} [ERROR] ${message}\n`);
}

syslog.logSystemRequest = (message) => {
    logStream.write(`${message}\n`);
}

module.exports = syslog;
