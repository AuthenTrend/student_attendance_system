
const constants = require("./constants");
const storage = require("./storage");

const BASIC_CAMPUS_ID_SIZE = 6;

const campus = {};


campus.getAllCampus = async (loginUid) => {
    if (loginUid != constants.ADMIN_ID) {
        let user = await storage.Users.findOne({id: loginUid, status: 0});
        if (!user || Object.values(constants.USER_TYPES).indexOf(user.type) < 0)
            throw new Error("authority_not_allowed");
    }

    let datas = await storage.Campus.find();

    let result = datas.map(campusData => {
        return {
            id: campusData.id,
            university: campusData.university,
            name: campusData.campus,
            periods: campusData.periods.map(x => {
                return {
                    "start_time": {hour: x.startTime.h, minute: x.startTime.m},
                    "end_time": {hour: x.endTime.h, minute: x.endTime.m}
                };
            })
        };
    });

    return result;
};

campus.addCampus = async (loginUid, campusInfo) => {
    if (loginUid !== constants.ADMIN_ID)
        throw new Error("authority_not_allowed");

    let datas = await storage.Campus.find();
    for (let index = 0; index < datas.length; index++) {
        if (datas[index].university == campusInfo.university.trim() &&
            datas[index].campus == campusInfo.name.trim())
            throw new Error("campus_exist");
    }

    let c = (datas.length) ? (parseInt(datas[datas.length - 1].id) + 1) : 1;
    let campusId = "000000" + (c).toString();
    campusId = campusId.substring(campusId.length - BASIC_CAMPUS_ID_SIZE);

    let newCampus = {
        id: campusId,
        university: campusInfo.university.trim(),
        campus: campusInfo.name.trim(),
        periods: campusInfo.periods.map(x => {
            if (x.end_time.hour < x.start_time.hour)
                throw new Error("invalid_periods");
            else if (x.end_time.hour == x.start_time.hour &&
                x.end_time.minute <= x.start_time.minute)
                throw new Error("invalid_periods");

            return {
                startTime: {h: x.start_time.hour, m: x.start_time.minute},
                endTime: {h: x.end_time.hour, m: x.end_time.minute}
            };
        })
    };

    await storage.Campus.create(newCampus);

    campusInfo["id"] = campusId;

    return campusInfo;
};

campus.updateCampus = async (loginUid, campusId, campusInfo) => {
    if (loginUid != constants.ADMIN_ID) throw new Error("authority_not_allowed");

    let findCampus = await storage.Campus.findOne({id: campusId});
    if (!findCampus) throw new Error("not_find_campus");

    if (findCampus.periods.length > campusInfo.periods.length) {
        let findClasses = await storage.Classes.find({campusId, status: 0});
        for (let idx = 0; idx < findClasses.length; idx++) {
            if (findClasses[idx].schoolTime.period > campusInfo.periods.length) {
                throw new Error("period_classes_not_empty");
            }
        }
    }

    let newPeriods = [];
    for (let idx = 0; idx < campusInfo.periods.length; idx++) {
        let x = campusInfo.periods[idx];
        if (x.start_time.hour < 0 || x.start_time.hour > 23
            || x.start_time.minute < 0 || x.start_time.minute > 59
            || x.end_time.hour < 0 || x.end_time.hour > 23
            || x.end_time.minute < 0 || x.end_time.minute > 59
            || x.end_time.hour < x.start_time.hour
            || (x.end_time.hour === x.start_time.hour
                && x.end_time.minute <= x.start_time.minute))
            throw new Error("invalid_periods");
        if (idx !== 0) {
            let w = campusInfo.periods[idx - 1];
            if (x.start_time.hour < w.end_time.hour
                || (x.start_time.hour === w.end_time.hour &&
                    x.start_time.minute < w.end_time.minute))
                throw new Error("invalid_periods");
        }

        newPeriods.push({
            startTime: {h: x.start_time.hour, m: x.start_time.minute},
            endTime: {h: x.end_time.hour, m: x.end_time.minute}
        });
    }

    findCampus.university = campusInfo.university.trim();
    findCampus.campus = campusInfo.name.trim();
    findCampus.periods = newPeriods;

    await findCampus.save();

    campusInfo["id"] = campusId;

    return campusInfo;
};

campus.deleteCampus = async (loginUid, campusId) => {
    if (loginUid != constants.ADMIN_ID) throw new Error("authority_not_allowed");

    // TODO: some other handle to avoid delete class error
    let classesResult = await storage.Classes.find({campusId, status: 0});
    if (classesResult.length) {
        throw new Error("campus_classes_not_empty");
    }

    let result = await storage.Campus.deleteOne({id: campusId});

    if (result.deletedCount == 0)
        throw new Error("not_find_campus");
    return;
}

module.exports = campus;
