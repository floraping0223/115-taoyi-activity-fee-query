const SHEETS = {
  members: "人員基本資料",
  events: "活動設定",
  pre: "會前回覆紀錄",
  onsite: "現場點名紀錄",
  splits: "分流設定",
  work: "工作分配",
  rules: "出勤規則",
  overview: "當日總覽",
  annual: "全年總表",
  check: "系統檢查",
  mapping: "欄位對照",
  missing: "待補資料",
};

const SPREADSHEET_ID = "1t52809HqGSPSdskrF-4-dJM7gMFPaTtc2u5aFNLxfP4";

const HEADERS = {
  [SHEETS.members]: ["人員ID", "家庭編號", "自然名", "屬性", "分團", "小隊", "所屬分團", "育成鷹資格", "啟用", "備註"],
  [SHEETS.events]: ["場次", "活動日期", "活動名稱", "會前確認開放", "現場點名開放", "育成鷹團分流", "狀態", "備註"],
  [SHEETS.pre]: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "預計時段", "活動去向", "請假事由", "回覆時間"],
  [SHEETS.onsite]: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "主要點名群組", "小隊", "現場狀態", "上午實到", "下午13:00實到", "遲到", "下午遲到", "臨時出席", "備註", "點名人員", "更新時間", "點名時段"],
  [SHEETS.splits]: ["場次", "分流名稱", "啟用", "資格規則", "主要點名群組", "備註"],
  [SHEETS.work]: ["場次", "人員ID", "家庭編號", "自然名", "主要點名群組", "小隊", "預計時段", "支援團隊", "職務註記", "工作分配", "備註"],
  [SHEETS.rules]: ["狀態", "缺席權重", "適用對象", "備註"],
  [SHEETS.overview]: ["場次", "群組", "小隊", "預計出席", "上午實到", "下午實到", "遲到", "未到", "親子陪同異常"],
  [SHEETS.annual]: ["人員ID", "家庭編號", "自然名", "分團", "小隊", "場次01", "場次02", "場次03", "場次04", "場次05", "場次06", "場次07", "場次08", "場次09", "場次10", "場次11", "場次12", "正常", "遲到", "上午", "下午", "全天缺席", "公假", "累計缺席", "出席率"],
  [SHEETS.check]: ["檢查時間", "資料表", "檢查項目", "結果", "說明"],
  [SHEETS.mapping]: ["原始Excel欄位", "系統欄位", "處理方式", "備註"],
  [SHEETS.missing]: ["資料類型", "家庭編號", "自然名", "缺少欄位", "影響", "處理狀態"],
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  const callback = e && e.parameter && e.parameter.callback;
  if (action === "events" || action === "snapshot") {
    setupWorkbook_();
    refreshDailyOverview_(PropertiesService.getDocumentProperties().getProperty("currentEventId") || "01");
    const payload = readBackendSnapshot_();
    if (callback) return javascript_(callback, payload);
    return json_(payload);
  }
  setupWorkbook_();
  if (action === "cleanup") {
    const result = cleanupDuplicateReplySheets_();
    refreshDailyOverview_(PropertiesService.getDocumentProperties().getProperty("currentEventId") || "01");
    writeSystemCheck_();
    if (callback) return javascript_(callback, result);
    return json_(result);
  }
  if (action === "setup") {
    return text_("115桃一親子團全年出勤管理系統分頁已建立：" + spreadsheet_().getUrl());
  }
  return text_("115桃一點名表後端已啟用。請由前台同步 Google。");
}

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  if (payload.action !== "snapshot") {
    return json_({ ok: false, message: "Unsupported action" });
  }
  const result = writeSnapshot_(payload);
  const spreadsheet = spreadsheet_();
  return json_(Object.assign({
    ok: true,
    syncedAt: payload.syncedAt || new Date().toISOString(),
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
  }, result));
}

function spreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function setupWorkbook_() {
  Object.values(SHEETS).forEach(name => {
    const sheet = sheet_(name);
    formatSheet_(sheet);
  });
}

function sheet_(name) {
  const spreadsheet = spreadsheet_();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureHeaders_(sheet, name);
  return sheet;
}

function writeSnapshot_(payload) {
  PropertiesService.getDocumentProperties().setProperty("currentEventId", payload.currentEventId || "01");
  const isAdminSync = payload.intent === "admin";

  if (isAdminSync) {
    writeSheet_(SHEETS.members, (payload.members || []).map(member => [
      member.id, member.familyId, member.name, member.role, member.group, member.squad,
      member.sourceGroup || "", member.eagleQualified ? "是" : "否", "是", "",
    ]));

    writeSheet_(SHEETS.events, (payload.events || []).map(event => [
      event.id, event.date || "", event.name || "", yes_(event.preOpen), yes_(event.onsiteOpen),
      yes_(event.eagleSplit), event.preOpen || event.onsiteOpen ? "開放" : "尚未開放", "",
    ]));
  }

  const memberById = {};
  (payload.members || []).forEach(member => memberById[member.id] = member);
  const records = payload.records || [];
  const familyConfirmations = payload.familyConfirmations || {};
  const checkinSubmissions = payload.checkinSubmissions || {};
  const shouldAppendFamilyReplies = payload.intent === "family";
  const shouldAppendCheckinReplies = payload.intent === "checkin";

  const familyAppend = appendUniqueRows_(SHEETS.pre, shouldAppendFamilyReplies ? records.filter(record => {
    const member = memberById[record.memberId] || {};
    return Boolean(familyConfirmations[familyConfirmKey_(record.eventId, member.familyId || "")]);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const confirmation = familyConfirmations[familyConfirmKey_(record.eventId, member.familyId || "")] || {};
    return [record.eventId, record.memberId, member.familyId || "", member.name || "", member.role || "",
      record.expected || "", record.route || "", record.note || "", confirmation.submittedAt || payload.syncedAt || ""];
  }) : [], row => [row[0], row[1]].join("|"));

  const checkinRows = shouldAppendCheckinReplies ? records.filter(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    const period = record.checkinPeriod || payload.checkinPeriod || "am";
    return Boolean(checkinSubmissions[checkinSubmissionKey_(record.eventId, group, squad, period)]);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    const period = record.checkinPeriod || payload.checkinPeriod || "am";
    const submission = checkinSubmissions[checkinSubmissionKey_(record.eventId, group, squad, period)] || {};
    const statusText = String(record.status || "");
    return [record.eventId, record.memberId, member.familyId || "", member.name || "", member.role || "",
      group, squad, record.status || "", yes_(record.am), yes_(record.pm), yes_(statusText === "遲到"), yes_(statusText === "下午遲到"),
      yes_(String(record.memberId || "").indexOf("guest-") === 0), record.note || "", submission.recorder || "", submission.submittedAt || payload.syncedAt || "", checkinPeriodLabel_(period)];
  }) : [];
  const checkinAppend = appendUniqueRows_(SHEETS.onsite, checkinRows, row => [row[0], row[1], row[16] || "上午"].join("|"));

  if (isAdminSync) {
    writeSheet_(SHEETS.splits, (payload.events || []).map(event => [
      event.id, "老鷹單飛活動", yes_(event.eagleSplit), "成人屬育成會且所屬分團包含「鷹」", "育成鷹團", "依個人會前選擇分流",
    ]));
  }

  const workRows = records.filter(record => record.work || record.workGroup || record.workRole).map(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return [record.eventId, record.memberId, member.familyId || "", member.name || "",
      group, squad, record.expected || "", record.workGroup || "", record.workRole || "", record.work || "", ""];
  });

  if (isAdminSync) {
    writeSheet_(SHEETS.work, workRows);
  }

  const workAppend = appendUniqueRows_(SHEETS.work, !isAdminSync && shouldAppendCheckinReplies ? records.filter(record => {
    if (!record.work && !record.workGroup && !record.workRole) return false;
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return Object.keys(checkinSubmissions).some(key => key.indexOf(checkinSubmissionKey_(record.eventId, group, squad, "")) === 0);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return [record.eventId, record.memberId, member.familyId || "", member.name || "",
      group, squad, record.expected || "", record.workGroup || "", record.workRole || "", record.work || "", ""];
  }) : [], row => [row[0], row[1]].join("|"));

  if (isAdminSync) {
    writeSheet_(SHEETS.rules, Object.keys(payload.rules || {}).map(status => [
      status, payload.rules[status], "小孩", "",
    ]));

    writeSheet_(SHEETS.annual, (payload.annual || []).map(row => [
      row.personId, row.familyId, row.name, row.group, row.squad,
      ...(row.events || Array(12).fill("")).slice(0, 12),
      row.normal, row.late, row.morning, row.afternoon, row.absent, row.publicLeave || 0, row.totalAbsence, row.attendanceRate,
    ]));
  }

  if (isAdminSync || shouldAppendCheckinReplies) {
    refreshDailyOverview_(payload.currentEventId || "01");
    writeSystemCheck_();
  }

  if (isAdminSync) {
    writeSheet_(SHEETS.mapping, [
      ["家庭編號", "家庭編號", "直接匯入", "家庭串聯 Key"],
      ["自然名", "自然名", "直接匯入", ""],
      ["屬性（家長/小孩）", "屬性", "直接匯入/正規化", "成人、小孩"],
      ["所屬分團", "所屬分團", "直接匯入", "包含鷹則可選老鷹單飛活動"],
      ["所屬小隊", "小隊", "直接匯入", ""],
    ]);
  }
  return {
    intent: payload.intent || "",
    recordsReceived: records.length,
    familyRowsMatched: familyAppend.matched,
    familyRowsAdded: familyAppend.added,
    checkinRowsMatched: checkinAppend.matched,
    checkinRowsAdded: checkinAppend.added,
    workRowsAdded: workAppend.added,
    checkinKeysReceived: Object.keys(checkinSubmissions),
  };
}

function readBackendSnapshot_() {
  const spreadsheet = spreadsheet_();
  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    currentEventId: PropertiesService.getDocumentProperties().getProperty("currentEventId") || "01",
    events: readEventSettings_(),
    familyReplies: readFamilyReplies_(),
    checkinReplies: readCheckinReplies_(),
  };
}

function readEventSettings_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.events);
  if (!sheet) return [];
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS[SHEETS.events].length).getValues()
    : [];
  return rows.map(row => ({
    id: String(row[0] || "").padStart(2, "0"),
    date: formatDateValue_(row[1]),
    name: row[2] || "",
    preOpen: row[3] === "是" || row[3] === true,
    onsiteOpen: row[4] === "是" || row[4] === true,
    eagleSplit: row[5] === "是" || row[5] === true,
  })).filter(event => event.id);
}

function readFamilyReplies_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.pre);
  if (!sheet) return [];
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS[SHEETS.pre].length).getValues()
    .map(row => ({
      eventId: String(row[0] || "").padStart(2, "0"),
      memberId: row[1] || "",
      familyId: row[2] || "",
      name: row[3] || "",
      role: row[4] || "",
      expected: row[5] || "未確認",
      route: row[6] || "",
      note: row[7] || "",
      submittedAt: formatDateTimeValue_(row[8]),
      syncedAt: formatDateTimeValue_(row[8]),
    }))
    .filter(row => row.eventId && row.memberId);
}

function readCheckinReplies_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.onsite);
  if (!sheet) return [];
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS[SHEETS.onsite].length).getValues()
    .map(row => ({
      eventId: String(row[0] || "").padStart(2, "0"),
      memberId: row[1] || "",
      familyId: row[2] || "",
      name: row[3] || "",
      role: row[4] || "",
      group: row[5] || "",
      squad: row[6] || "",
      status: row[7] || "未確認",
      am: row[8] === "是" || row[8] === true,
      pm: row[9] === "是" || row[9] === true,
      note: row[13] || "",
      recorder: row[14] || "",
      submittedAt: formatDateTimeValue_(row[15]),
      syncedAt: formatDateTimeValue_(row[15]),
      period: row[16] || "",
    }))
    .filter(row => row.eventId && row.memberId);
}

function refreshDailyOverview_(eventId) {
  const events = readEventSettings_();
  const targetEventId = String(eventId || PropertiesService.getDocumentProperties().getProperty("currentEventId") || "01").padStart(2, "0");
  const event = events.filter(item => item.id === targetEventId)[0] || {};
  const members = readMembers_();
  const recordsByMemberId = {};
  const familySubmitted = {};

  readFamilyReplies_()
    .filter(reply => reply.eventId === targetEventId)
    .forEach(reply => {
      recordsByMemberId[reply.memberId] = Object.assign(recordsByMemberId[reply.memberId] || {}, {
        memberId: reply.memberId,
        eventId: reply.eventId,
        expected: reply.expected || "未確認",
        route: reply.route || "",
        note: reply.note || "",
      });
      familySubmitted[reply.familyId] = true;
    });

  readWorkAssignments_()
    .filter(work => work.eventId === targetEventId)
    .forEach(work => {
      recordsByMemberId[work.memberId] = Object.assign(recordsByMemberId[work.memberId] || {}, {
        memberId: work.memberId,
        eventId: work.eventId,
        workGroup: work.workGroup || "",
        workRole: work.workRole || "",
        work: work.work || "",
      });
    });

  readCheckinReplies_()
    .filter(reply => reply.eventId === targetEventId)
    .forEach(reply => {
      recordsByMemberId[reply.memberId] = mergeCheckinIntoRecord_(recordsByMemberId[reply.memberId] || {
        memberId: reply.memberId,
        eventId: reply.eventId,
        expected: "未確認",
      }, reply);
      if (!members.some(member => member.id === reply.memberId)) {
        members.push({
          id: reply.memberId,
          familyId: reply.familyId,
          name: reply.name,
          role: reply.role,
          group: reply.group,
          squad: reply.squad,
          sourceGroup: reply.group,
          eagleQualified: false,
          active: true,
        });
      }
    });

  const rows = overviewEntrances_(event.eagleSplit).reduce((allRows, entry) => {
    SQUADS_[entry.key].forEach(squad => {
      const scopedMembers = members.filter(member => {
        const record = overviewRecord_(recordsByMemberId, member, targetEventId);
        if (record.expected === "未確認" && !isGuestMember_(member)) return false;
        if (record.expected === "請假" || record.expected === "公假") return false;
        return resolveCheckinGroup_(member, record, events) === entry.key
          && resolveCheckinSquad_(member, record, events) === squad;
      });
      const records = scopedMembers.map(member => overviewRecord_(recordsByMemberId, member, targetEventId));
      allRows.push([
        targetEventId,
        entry.key,
        squad,
        scopedMembers.length,
        records.filter(hasMorning_).length,
        records.filter(hasAfternoon_).length,
        records.filter(record => record.status === "遲到" || record.status === "下午遲到" || record.amLate || record.pmLate).length,
        records.filter(record => record.status === "未到").length,
        countFamilyAlerts_(members, recordsByMemberId, familySubmitted, targetEventId, entry.key, squad, events),
      ]);
    });
    return allRows;
  }, []);

  writeSheet_(SHEETS.overview, rows);
}

const SQUADS_ = {
  "小蟻": ["小黑蟻", "小黃蟻", "小綠蟻", "小紅蟻", "小蟻團團隊"],
  "炫蜂": ["泥壺蜂", "虎頭蜂", "長腳蜂", "細腰蜂", "炫蜂團團隊"],
  "奔鹿": ["高地鹿", "森林鹿", "草原鹿", "湖泊鹿", "奔鹿團團隊"],
  "翔鷹": ["鷹團", "翔鷹團團隊"],
  "育成會": ["花叢", "天空", "草原", "大地", "育苗小藍隊"],
  "育成鷹團": ["育成鷹團"],
};

const ENTRANCES_ = [
  { key: "小蟻" },
  { key: "炫蜂" },
  { key: "奔鹿" },
  { key: "翔鷹" },
  { key: "育成會" },
  { key: "育成鷹團" },
];

function overviewEntrances_(eagleSplit) {
  return eagleSplit ? ENTRANCES_ : ENTRANCES_.filter(entry => entry.key !== "育成鷹團");
}

function readMembers_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.members);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS[SHEETS.members].length).getValues()
    .map(row => ({
      id: row[0] || "",
      familyId: row[1] || "",
      name: row[2] || "",
      role: row[3] || "",
      group: row[4] || "",
      squad: row[5] || "",
      sourceGroup: row[6] || row[4] || "",
      eagleQualified: row[7] === "是" || row[7] === true,
      active: row[8] !== "否",
    }))
    .filter(member => member.id && member.active);
}

function readWorkAssignments_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.work);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS[SHEETS.work].length).getValues()
    .map(row => ({
      eventId: String(row[0] || "").padStart(2, "0"),
      memberId: row[1] || "",
      workGroup: row[7] || "",
      workRole: row[8] || "",
      work: row[9] || "",
    }))
    .filter(row => row.eventId && row.memberId);
}

function mergeCheckinIntoRecord_(record, reply) {
  record.status = reply.status || record.status || "未確認";
  record.note = reply.note || record.note || "";
  if (reply.period === "全場" || reply.period === "full") {
    record.am = reply.am;
    record.pm = reply.pm;
    record.amLate = reply.status === "遲到";
    record.pmLate = reply.status === "下午遲到";
  } else if (reply.period === "下午") {
    record.pm = reply.pm;
    record.pmLate = reply.status === "下午遲到";
  } else {
    record.am = reply.am;
    record.amLate = reply.status === "遲到";
  }
  return record;
}

function overviewRecord_(recordsByMemberId, member, eventId) {
  if (!recordsByMemberId[member.id]) {
    recordsByMemberId[member.id] = {
      memberId: member.id,
      eventId: eventId,
      expected: "未確認",
      status: "未確認",
      am: false,
      pm: false,
      amLate: false,
      pmLate: false,
      route: "",
      workGroup: "",
    };
  }
  return recordsByMemberId[member.id];
}

function countFamilyAlerts_(members, recordsByMemberId, familySubmitted, eventId, group, squad, events) {
  let count = 0;
  const byFamily = {};
  members.forEach(member => {
    if (!byFamily[member.familyId]) byFamily[member.familyId] = [];
    byFamily[member.familyId].push(member);
  });
  Object.keys(byFamily).forEach(familyId => {
    const familyMembers = byFamily[familyId];
    const adults = familyMembers.filter(member => member.role === "成人");
    familyMembers.filter(member => member.role !== "成人").forEach(child => {
      const childRecord = overviewRecord_(recordsByMemberId, child, eventId);
      if (resolveCheckinGroup_(child, childRecord, events) !== group || resolveCheckinSquad_(child, childRecord, events) !== squad) return;
      [
        { period: "am", present: hasMorning_(childRecord) },
        { period: "pm", present: hasAfternoon_(childRecord) },
      ].forEach(item => {
        const adultPresent = familyHasPublicLeaveAdult_(adults, recordsByMemberId, eventId)
          || adults.some(adult => isAccompanyingAdultPresent_(adult, item.period, Boolean(familySubmitted[familyId]), recordsByMemberId, eventId));
        if (item.present && !adultPresent) count += 1;
      });
    });
  });
  return count;
}

function isAccompanyingAdultPresent_(adult, period, familySubmitted, recordsByMemberId, eventId) {
  const record = overviewRecord_(recordsByMemberId, adult, eventId);
  if (record.expected === "請假" || record.expected === "公假") return false;
  if (familySubmitted && record.expected === "未確認") return false;
  if (!record.status || record.status === "未確認") return false;
  return period === "am" ? hasMorning_(record) : hasAfternoon_(record);
}

function familyHasPublicLeaveAdult_(adults, recordsByMemberId, eventId) {
  return adults.some(adult => overviewRecord_(recordsByMemberId, adult, eventId).expected === "公假");
}

function hasMorning_(record) {
  return Boolean(record.am) || record.status === "出席" || record.status === "全天出席" || record.status === "遲到" || record.status === "下午請假";
}

function hasAfternoon_(record) {
  return Boolean(record.pm) || record.status === "出席" || record.status === "全天出席" || record.status === "下午遲到" || record.status === "上午請假";
}

function isGuestMember_(member) {
  return String(member.id || "").indexOf("guest-") === 0;
}

function formatDateValue_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}

function formatDateTimeValue_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return String(value);
}

function writeSheet_(name, rows) {
  const sheet = sheet_(name);
  sheet.clear();
  const values = [HEADERS[name]].concat(rows || []);
  sheet.getRange(1, 1, values.length, HEADERS[name].length).setValues(values);
  formatSheet_(sheet);
}

function appendUniqueRows_(name, rows, keyGetter) {
  const sheet = sheet_(name);
  const width = HEADERS[name].length;
  const existing = new Set();
  let duplicateCount = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, width).getValues().forEach(row => {
      const key = keyGetter(row);
      if (!key) return;
      if (existing.has(key)) {
        duplicateCount += 1;
        return;
      }
      existing.add(key);
    });
  }
  if (duplicateCount > 0) {
    dedupeSheetByKey_(name, keyGetter);
    return appendUniqueRows_(name, rows, keyGetter);
  }
  const fresh = (rows || []).filter(row => {
    const key = keyGetter(row);
    if (!key || existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (fresh.length) {
    sheet.getRange(lastRow + 1, 1, fresh.length, width).setValues(fresh);
  }
  formatSheet_(sheet);
  return { matched: (rows || []).length, added: fresh.length, kept: Math.max(lastRow - 1, 0) };
}

function cleanupDuplicateReplySheets_() {
  const pre = dedupeSheetByKey_(SHEETS.pre, row => [row[0], row[1]].join("|"));
  const onsite = dedupeSheetByKey_(SHEETS.onsite, row => [row[0], row[1], row[16] || "上午"].join("|"));
  const work = dedupeSheetByKey_(SHEETS.work, row => [row[0], row[1]].join("|"));
  return {
    ok: true,
    message: "重複資料已整理，保留每位成員最新一筆。",
    preRemoved: pre.removed,
    onsiteRemoved: onsite.removed,
    workRemoved: work.removed,
  };
}

function dedupeSheetByKey_(name, keyGetter) {
  const sheet = sheet_(name);
  const width = HEADERS[name].length;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { removed: 0, kept: 0 };
  const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  const byKey = {};
  const orderedKeys = [];
  rows.forEach(row => {
    const key = keyGetter(row);
    if (!key || key === "|") {
      orderedKeys.push("__row_" + orderedKeys.length);
      byKey[orderedKeys[orderedKeys.length - 1]] = row;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(byKey, key)) orderedKeys.push(key);
    byKey[key] = row;
  });
  const keptRows = orderedKeys.map(key => byKey[key]);
  const removed = rows.length - keptRows.length;
  if (removed > 0) writeSheet_(name, keptRows);
  return { removed, kept: keptRows.length };
}

function writeSystemCheck_() {
  const now = new Date();
  const rows = []
    .concat(checkDuplicateRows_(SHEETS.pre, row => [row[0], row[1]].join("|"), "同一場次+同一人員"))
    .concat(checkDuplicateRows_(SHEETS.onsite, row => [row[0], row[1], row[16] || "上午"].join("|"), "同一場次+同一人員+同一時段"))
    .concat(checkDuplicateRows_(SHEETS.work, row => [row[0], row[1]].join("|"), "同一場次+同一人員"))
    .concat(checkRequiredSheet_(SHEETS.members))
    .concat(checkRequiredSheet_(SHEETS.events))
    .concat(checkRequiredSheet_(SHEETS.pre))
    .concat(checkRequiredSheet_(SHEETS.onsite))
    .concat(checkRequiredSheet_(SHEETS.work))
    .map(row => [now].concat(row));
  writeSheet_(SHEETS.check, rows.length ? rows : [[now, "全部", "基本檢查", "正常", "目前沒有發現重複或缺表。"]]);
}

function checkDuplicateRows_(name, keyGetter, label) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [[name, label, "正常", "目前沒有重複資料。"]];
  const width = HEADERS[name].length;
  const counts = {};
  sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues().forEach(row => {
    const key = keyGetter(row);
    if (!key || key === "|") return;
    counts[key] = (counts[key] || 0) + 1;
  });
  const duplicates = Object.keys(counts).filter(key => counts[key] > 1);
  if (!duplicates.length) return [[name, label, "正常", "目前沒有重複資料。"]];
  return duplicates.map(key => [name, label, "異常", key + " 重複 " + counts[key] + " 筆"]);
}

function checkRequiredSheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) return [[name, "分頁存在", "異常", "找不到這張分頁。"]];
  const headers = sheet.getRange(1, 1, 1, HEADERS[name].length).getValues()[0];
  const mismatch = HEADERS[name].filter((header, index) => headers[index] !== header);
  if (mismatch.length) return [[name, "欄位標題", "異常", "第 1 列欄位與系統設定不一致。"]];
  return [[name, "欄位標題", "正常", ""]];
}

function ensureHeaders_(sheet, name) {
  const headers = HEADERS[name];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  let needsHeader = false;
  headers.forEach((header, index) => {
    if (current[index] !== header) needsHeader = true;
  });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function familyConfirmKey_(eventId, familyId) {
  return [eventId || "", "family", familyId || ""].join("|");
}

function checkinSubmissionKey_(eventId, group, squad, period) {
  return [eventId || "", "checkin", group || "", squad || "", period || ""].join("|");
}

function checkinPeriodLabel_(period) {
  if (period === "full" || period === "全場") return "全場";
  return period === "pm" || period === "下午" ? "下午" : "上午";
}

function resolveGroup_(member, record, events) {
  if (member.group === "未在團" && member.squad === "育苗小藍隊") return "育成會";
  if (member.role !== "成人") return member.group || "";
  const event = events.filter(item => item.id === record.eventId)[0] || {};
  if (event.eagleSplit && member.eagleQualified && member.group === "育成會" && isEagleSoloRoute_(record.route)) return "育成鷹團";
  if (member.group && member.group !== "育成會") return member.group;
  return "育成會";
}

function resolveCheckinGroup_(member, record, events) {
  const support = supportAssignment_(member, record);
  return support ? support.group : resolveGroup_(member, record, events);
}

function resolveCheckinSquad_(member, record, events) {
  const support = supportAssignment_(member, record);
  if (support) return support.squad;
  const group = resolveGroup_(member, record, events);
  if (group === "育成鷹團") return "育成鷹團";
  return member.squad || "";
}

function supportAssignment_(member, record) {
  if (member.role !== "成人") return null;
  const targets = {
    "小蟻團": { group: "小蟻", squad: "小蟻團團隊" },
    "炫蜂團": { group: "炫蜂", squad: "炫蜂團團隊" },
    "奔鹿團": { group: "奔鹿", squad: "奔鹿團團隊" },
  };
  return targets[record.workGroup] || null;
}

function isEagleSoloRoute_(route) {
  return route === "老鷹單飛活動" || route === "育成鷹團活動" || route === "單飛活動";
}

function yes_(value) {
  return value ? "是" : "否";
}

function formatSheet_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#24435c");
}

function text_(content) {
  return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.TEXT);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function javascript_(callback, payload) {
  const safeCallback = /^[\w$.]+$/.test(callback) ? callback : "callback";
  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
