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
  mapping: "欄位對照",
  missing: "待補資料",
};

const HEADERS = {
  [SHEETS.members]: ["人員ID", "家庭編號", "自然名", "屬性", "分團", "小隊", "所屬分團", "育成鷹資格", "啟用", "備註"],
  [SHEETS.events]: ["場次", "活動日期", "活動名稱", "會前確認開放", "現場點名開放", "育成鷹團分流", "狀態", "備註"],
  [SHEETS.pre]: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "預計時段", "活動去向", "請假事由", "回覆時間"],
  [SHEETS.onsite]: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "主要點名群組", "小隊", "現場狀態", "上午實到", "下午13:00實到", "遲到", "臨時出席", "備註", "點名人員", "更新時間"],
  [SHEETS.splits]: ["場次", "分流名稱", "啟用", "資格規則", "主要點名群組", "備註"],
  [SHEETS.work]: ["場次", "人員ID", "家庭編號", "自然名", "主要點名群組", "小隊", "預計時段", "支援團隊", "職務註記", "工作分配", "備註"],
  [SHEETS.rules]: ["狀態", "缺席權重", "適用對象", "備註"],
  [SHEETS.overview]: ["場次", "群組", "小隊", "預計出席", "上午實到", "下午實到", "遲到", "未到", "親子陪同異常"],
  [SHEETS.annual]: ["人員ID", "家庭編號", "自然名", "分團", "小隊", "場次01", "場次02", "場次03", "場次04", "場次05", "場次06", "場次07", "場次08", "場次09", "場次10", "場次11", "場次12", "正常", "遲到", "上午", "下午", "全天缺席", "累計缺席", "出席率"],
  [SHEETS.mapping]: ["原始Excel欄位", "系統欄位", "處理方式", "備註"],
  [SHEETS.missing]: ["資料類型", "家庭編號", "自然名", "缺少欄位", "影響", "處理狀態"],
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  const callback = e && e.parameter && e.parameter.callback;
  setupWorkbook_();
  if (action === "events" || action === "snapshot") {
    const payload = readBackendSnapshot_();
    if (callback) return javascript_(callback, payload);
    return json_(payload);
  }
  if (action === "setup") {
    return text_("115桃一親子團全年出勤管理系統分頁已建立：" + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  }
  return text_("115桃一點名表後端已啟用。請由前台同步 Google。");
}

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  setupWorkbook_();
  if (payload.action !== "snapshot") {
    return json_({ ok: false, message: "Unsupported action" });
  }
  writeSnapshot_(payload);
  return json_({ ok: true, syncedAt: payload.syncedAt || new Date().toISOString() });
}

function setupWorkbook_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEETS).forEach(name => {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    ensureHeaders_(sheet, name);
    formatSheet_(sheet);
  });
}

function writeSnapshot_(payload) {
  PropertiesService.getDocumentProperties().setProperty("currentEventId", payload.currentEventId || "01");

  writeSheet_(SHEETS.members, (payload.members || []).map(member => [
    member.id, member.familyId, member.name, member.role, member.group, member.squad,
    member.sourceGroup || "", member.eagleQualified ? "是" : "否", "是", "",
  ]));

  writeSheet_(SHEETS.events, (payload.events || []).map(event => [
    event.id, event.date || "", event.name || "", yes_(event.preOpen), yes_(event.onsiteOpen),
    yes_(event.eagleSplit), event.preOpen || event.onsiteOpen ? "開放" : "尚未開放", "",
  ]));

  const memberById = {};
  (payload.members || []).forEach(member => memberById[member.id] = member);
  const records = payload.records || [];
  const familyConfirmations = payload.familyConfirmations || {};
  const checkinSubmissions = payload.checkinSubmissions || {};
  const shouldAppendFamilyReplies = payload.intent === "family";
  const shouldAppendCheckinReplies = payload.intent === "checkin";

  appendUniqueRows_(SHEETS.pre, shouldAppendFamilyReplies ? records.filter(record => {
    const member = memberById[record.memberId] || {};
    return Boolean(familyConfirmations[familyConfirmKey_(record.eventId, member.familyId || "")]);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const confirmation = familyConfirmations[familyConfirmKey_(record.eventId, member.familyId || "")] || {};
    return [record.eventId, record.memberId, member.familyId || "", member.name || "", member.role || "",
      record.expected || "", record.route || "", record.note || "", confirmation.submittedAt || payload.syncedAt || ""];
  }) : [], row => [row[0], row[1]].join("|"));

  appendUniqueRows_(SHEETS.onsite, shouldAppendCheckinReplies ? records.filter(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return Boolean(checkinSubmissions[checkinSubmissionKey_(record.eventId, group, squad)]);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    const submission = checkinSubmissions[checkinSubmissionKey_(record.eventId, group, squad)] || {};
    return [record.eventId, record.memberId, member.familyId || "", member.name || "", member.role || "",
      group, squad, record.status || "", yes_(record.am), yes_(record.pm), yes_(record.status === "遲到"),
      yes_(String(record.memberId || "").indexOf("guest-") === 0), record.note || "", submission.recorder || "", submission.submittedAt || payload.syncedAt || ""];
  }) : [], row => [row[0], row[1]].join("|"));

  writeSheet_(SHEETS.splits, (payload.events || []).map(event => [
    event.id, "老鷹單飛活動", yes_(event.eagleSplit), "成人屬育成會且所屬分團包含「鷹」", "育成鷹團", "依個人會前選擇分流",
  ]));

  appendUniqueRows_(SHEETS.work, shouldAppendCheckinReplies ? records.filter(record => {
    if (!record.work && !record.workGroup && !record.workRole) return false;
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return Boolean(checkinSubmissions[checkinSubmissionKey_(record.eventId, group, squad)]);
  }).map(record => {
    const member = memberById[record.memberId] || {};
    const group = resolveCheckinGroup_(member, record, payload.events || []);
    const squad = resolveCheckinSquad_(member, record, payload.events || []);
    return [record.eventId, record.memberId, member.familyId || "", member.name || "",
      group, squad, record.expected || "", record.workGroup || "", record.workRole || "", record.work || "", ""];
  }) : [], row => [row[0], row[1]].join("|"));

  writeSheet_(SHEETS.rules, Object.keys(payload.rules || {}).map(status => [
    status, payload.rules[status], "小孩", "",
  ]));

  writeSheet_(SHEETS.overview, (payload.overview || []).map(row => [
    row.eventId, row.group, row.squad, row.expected, row.morning, row.afternoon, row.late, row.absent, row.familyAlerts,
  ]));

  writeSheet_(SHEETS.annual, (payload.annual || []).map(row => [
    row.personId, row.familyId, row.name, row.group, row.squad,
    ...(row.events || Array(12).fill("")).slice(0, 12),
    row.normal, row.late, row.morning, row.afternoon, row.absent, row.totalAbsence, row.attendanceRate,
  ]));

  writeSheet_(SHEETS.mapping, [
    ["家庭編號", "家庭編號", "直接匯入", "家庭串聯 Key"],
    ["自然名", "自然名", "直接匯入", ""],
    ["屬性（家長/小孩）", "屬性", "直接匯入/正規化", "成人、小孩"],
    ["所屬分團", "所屬分團", "直接匯入", "包含鷹則可選老鷹單飛活動"],
    ["所屬小隊", "小隊", "直接匯入", ""],
  ]);
}

function readBackendSnapshot_() {
  return {
    ok: true,
    currentEventId: PropertiesService.getDocumentProperties().getProperty("currentEventId") || "01",
    events: readEventSettings_(),
    familyReplies: readFamilyReplies_(),
    checkinReplies: readCheckinReplies_(),
  };
}

function readEventSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.events);
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.pre);
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.onsite);
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
      note: row[12] || "",
      recorder: row[13] || "",
      submittedAt: formatDateTimeValue_(row[14]),
      syncedAt: formatDateTimeValue_(row[14]),
    }))
    .filter(row => row.eventId && row.memberId);
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  sheet.clear();
  const values = [HEADERS[name]].concat(rows || []);
  sheet.getRange(1, 1, values.length, HEADERS[name].length).setValues(values);
  formatSheet_(sheet);
}

function appendUniqueRows_(name, rows, keyGetter) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  ensureHeaders_(sheet, name);
  const width = HEADERS[name].length;
  const existing = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, width).getValues().forEach(row => {
      existing.add(keyGetter(row));
    });
  }
  const fresh = (rows || []).filter(row => {
    const key = keyGetter(row);
    if (!key || existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (fresh.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, width).setValues(fresh);
  }
  formatSheet_(sheet);
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

function checkinSubmissionKey_(eventId, group, squad) {
  return [eventId || "", "checkin", group || "", squad || ""].join("|");
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
  sheet.autoResizeColumns(1, lastColumn);
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
