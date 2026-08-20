const STORAGE_KEY = "taoyi-115-attendance-ui-v1";
const SCRIPT_URL_KEY = "taoyi-115-apps-script-url";
const APP_MODE = document.body.dataset.appMode || "admin";
const DEFAULT_SCRIPT_URL = window.TAOYI_BACKEND_URL || "";

const SQUADS = {
  "小蟻": ["小黑蟻", "小黃蟻", "小綠蟻", "小紅蟻", "小蟻團團隊"],
  "炫蜂": ["泥壺蜂", "虎頭蜂", "長腳蜂", "細腰蜂", "炫蜂團團隊"],
  "奔鹿": ["高地鹿", "森林鹿", "草原鹿", "湖泊鹿", "奔鹿團團隊"],
  "翔鷹": ["鷹團", "翔鷹團團隊"],
  "育成會": ["花叢", "天空", "草原", "大地", "育苗小藍隊"],
  "育成鷹團": ["育成鷹團"],
};

const ENTRANCES = [
  { key: "小蟻", label: "小蟻點名", hint: "五組固定入口" },
  { key: "炫蜂", label: "炫蜂點名", hint: "五組固定入口" },
  { key: "奔鹿", label: "奔鹿點名", hint: "五組固定入口" },
  { key: "翔鷹", label: "翔鷹點名", hint: "鷹團小孩/翔鷹團團隊" },
  { key: "育成會", label: "育成會點名", hint: "上午與13:00複點" },
  { key: "育成鷹團", label: "老鷹單飛入口", hint: "大人分流點名" },
];

const CHILD_STATUSES = ["出席", "遲到", "上午請假", "下午請假", "未到"];
const ADULT_CHECKIN_STATUSES = ["出席", "遲到", "上午請假", "下午請假"];
const FAMILY_STATUSES = ["全天出席", "上午請假", "下午請假", "請假"];
const EAGLE_SOLO_ROUTE = "老鷹單飛活動";
const ADULT_ROUTES = ["母團活動", EAGLE_SOLO_ROUTE];
const SPLIT_CHECKIN_ROUTES = [EAGLE_SOLO_ROUTE];
const SUPPORT_TARGETS = [
  { value: "小蟻團", group: "小蟻", squad: "小蟻團團隊" },
  { value: "炫蜂團", group: "炫蜂", squad: "炫蜂團團隊" },
  { value: "奔鹿團", group: "奔鹿", squad: "奔鹿團團隊" },
];
const DEFAULT_RULES = {
  "出席": 0,
  "全天出席": 0,
  "遲到": 0.5,
  "上午請假": 0.5,
  "下午請假": 0.5,
  "上午出席": 0.5,
  "下午出席": 0.5,
  "未到": 1,
  "請假": 1,
};

const state = loadState();
let activeView = APP_MODE === "family" ? "family" : APP_MODE === "checkin" ? "checkin" : "overview";
let activeEntrance = "小蟻";
let activeSquad = "全部";

const eventSelect = document.querySelector("#eventSelect");
const eventDate = document.querySelector("#eventDate");
const eventName = document.querySelector("#eventName");
const eagleSplit = document.querySelector("#eagleSplit");
const preOpen = document.querySelector("#preOpen");
const onsiteOpen = document.querySelector("#onsiteOpen");
const scriptUrl = document.querySelector("#scriptUrl");
const syncGoogle = document.querySelector("#syncGoogle");
const refreshReplies = document.querySelector("#refreshReplies");
const clearLocalTestData = document.querySelector("#clearLocalTestData");
const openState = document.querySelector("#openState");
const metricGrid = document.querySelector("#metricGrid");
const familyAlerts = document.querySelector("#familyAlerts");
const overviewGroups = document.querySelector("#overviewGroups");
const familySearch = document.querySelector("#familySearch");
const loadFamily = document.querySelector("#loadFamily");
const familyCards = document.querySelector("#familyCards");
const familyConfirmPanel = document.querySelector("#familyConfirmPanel");
const familyEventSummary = document.querySelector("#familyEventSummary");
const preReplyLists = document.querySelector("#preReplyLists");
const expectedLists = document.querySelector("#expectedLists");
const entranceGrid = document.querySelector("#entranceGrid");
const boardTitle = document.querySelector("#boardTitle");
const squadTabs = document.querySelector("#squadTabs");
const checkinRecorderPanel = document.querySelector("#checkinRecorderPanel");
const checkinSubmitPanel = document.querySelector("#checkinSubmitPanel");
const checkinList = document.querySelector("#checkinList");
const memberSearch = document.querySelector("#memberSearch");
const guestForm = document.querySelector("#guestForm");
const guestFields = guestForm.querySelector(".guest-fields");
const annualSearch = document.querySelector("#annualSearch");
const annualList = document.querySelector("#annualList");
const cardTemplate = document.querySelector("#personCardTemplate");
const ruleInputs = {
  "出席": document.querySelector("#rulePresent"),
  "全天出席": document.querySelector("#rulePresent"),
  "遲到": document.querySelector("#ruleLate"),
  "上午請假": document.querySelector("#ruleMorning"),
  "下午請假": document.querySelector("#ruleAfternoon"),
  "未到": document.querySelector("#ruleAbsent"),
  "請假": document.querySelector("#ruleAbsent"),
};

setup();
render();

function setup() {
  document.body.classList.toggle("family-mode", APP_MODE === "family");
  document.body.classList.toggle("checkin-mode", APP_MODE === "checkin");
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${activeView}View`);
  });

  syncEventOptions();
  eventSelect.value = state.currentEventId;
  scriptUrl.value = DEFAULT_SCRIPT_URL || localStorage.getItem(SCRIPT_URL_KEY) || "";
  syncEventFields();
  loadBackendSnapshotFromGoogle();

  eventSelect.addEventListener("change", () => {
    state.currentEventId = eventSelect.value;
    syncEventFields();
    saveState();
    render();
  });

  eventDate.addEventListener("change", () => {
    currentEvent().date = eventDate.value;
    saveState();
    render();
  });

  eventName.addEventListener("change", () => {
    currentEvent().name = eventName.value.trim() || `第 ${currentEvent().id} 場活動`;
    saveState();
    render();
  });

  eagleSplit.addEventListener("change", () => {
    currentEvent().eagleSplit = eagleSplit.checked;
    saveState();
    render();
  });
  preOpen.addEventListener("change", () => {
    currentEvent().preOpen = preOpen.checked;
    saveState();
    render();
  });
  onsiteOpen.addEventListener("change", () => {
    currentEvent().onsiteOpen = onsiteOpen.checked;
    saveState();
    render();
  });
  scriptUrl.addEventListener("change", () => {
    localStorage.setItem(SCRIPT_URL_KEY, normalize(scriptUrl.value));
  });
  syncGoogle.addEventListener("click", () => syncToGoogle({ intent: "admin" }));
  if (refreshReplies) refreshReplies.addEventListener("click", refreshBackendReplies);
  clearLocalTestData.addEventListener("click", () => {
    if (!confirm("確定清除這台裝置上的測試點名資料？Apps Script URL 會保留，後端資料不會刪除。")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  Object.entries(ruleInputs).forEach(([status, input]) => {
    if (!input || status === "全天出席" || status === "請假") return;
    input.addEventListener("input", () => {
      const value = Number(input.value);
      state.rules[status] = Number.isFinite(value) ? value : DEFAULT_RULES[status];
      if (status === "出席") state.rules["全天出席"] = state.rules[status];
      if (status === "未到") state.rules["請假"] = state.rules[status];
      saveState();
      renderAnnual();
    });
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === `${activeView}View`));
      render();
    });
  });

  loadFamily.addEventListener("click", renderFamily);
  familySearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") renderFamily();
  });
  memberSearch.addEventListener("input", renderCheckin);
  annualSearch.addEventListener("input", renderAnnual);
  guestForm.querySelectorAll('input[name="guestMode"]').forEach((input) => {
    input.addEventListener("change", syncGuestFields);
  });

  guestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isGuestModeOpen()) return;
    if (activeSquad === "全部") {
      alert("請先選擇單一分隊，再新增臨時出席。");
      return;
    }
    const submitted = checkinSubmission();
    if (submitted) {
      alert(`這個分隊本場已由 ${submitted.recorder} 完成送出。`);
      return;
    }
    const data = Object.fromEntries(new FormData(guestForm).entries());
    if (!normalize(data.name)) {
      alert("請填寫臨時出席自然名。");
      return;
    }
    const member = {
      id: `guest-${Date.now()}`,
      familyId: normalize(data.familyId) || "臨時",
      name: normalize(data.name),
      role: activeEntrance === "育成會" || activeEntrance === "育成鷹團" ? "成人" : "孩子",
      group: activeEntrance,
      squad: activeSquad === "全部" ? SQUADS[activeEntrance][0] : activeSquad,
      sourceGroup: activeEntrance,
      sourceSquad: activeSquad,
      isGuest: true,
      eagleQualified: activeEntrance === "育成鷹團",
    };
    state.members.push(member);
    getRecord(member.id).status = "出席";
    getRecord(member.id).am = true;
    getRecord(member.id).pm = true;
    guestForm.reset();
    guestForm.querySelector('input[name="guestMode"][value="none"]').checked = true;
    syncGuestFields();
    saveState();
    render();
  });
  syncGuestFields();
}

function syncEventOptions() {
  eventSelect.innerHTML = state.events.map((event) => (
    `<option value="${event.id}">${event.id}｜${event.name}</option>`
  )).join("");
}

function loadBackendSnapshotFromGoogle() {
  const url = normalize(DEFAULT_SCRIPT_URL || scriptUrl.value);
  if (!url) return Promise.resolve(false);
  const callbackName = `taoyiSnapshot${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const script = document.createElement("script");
  return new Promise((resolve) => {
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 30000);
    window[callbackName] = (payload) => {
      clearTimeout(timer);
      const changed = mergeBackendSnapshot(payload);
      if (changed) {
        syncEventOptions();
        eventSelect.value = state.currentEventId;
        syncEventFields();
        saveState();
        render();
      }
      cleanup();
      resolve(Boolean(payload?.ok));
    };
    try {
      const endpoint = new URL(url);
      endpoint.searchParams.set("action", "snapshot");
      endpoint.searchParams.set("callback", callbackName);
      script.src = endpoint.toString();
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(false);
      };
      document.body.appendChild(script);
    } catch (error) {
      clearTimeout(timer);
      cleanup();
      resolve(false);
    }
  });
}

function mergeBackendSnapshot(payload) {
  if (!payload) return false;
  let changed = false;

  if (Array.isArray(payload.events)) {
    const existingEvents = new Map(state.events.map((event) => [event.id, event]));
    payload.events.forEach((incoming) => {
      const event = existingEvents.get(normalize(incoming.id));
      if (!event) return;
      ["date", "name", "preOpen", "onsiteOpen", "eagleSplit"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(incoming, key) && event[key] !== incoming[key]) {
          event[key] = incoming[key];
          changed = true;
        }
      });
    });
  }

  if (payload.currentEventId && state.currentEventId !== payload.currentEventId) {
    state.currentEventId = payload.currentEventId;
    changed = true;
  }

  (payload.familyReplies || []).forEach((reply) => {
    const member = state.members.find((item) => item.id === reply.memberId);
    if (!member) return;
    const record = getRecord(reply.memberId, reply.eventId);
    if (mergeRecordField(record, "expected", reply.expected || "未確認")) changed = true;
    if (mergeRecordField(record, "route", reply.route || "")) changed = true;
    if (mergeRecordField(record, "note", reply.note || "")) changed = true;
    const key = familyConfirmKeyFor(reply.eventId, reply.familyId || member.familyId);
    const confirmation = state.familyConfirmations[key] || {};
    const nextConfirmation = {
      submittedAt: reply.submittedAt || confirmation.submittedAt || "",
      syncStatus: "sent",
      syncedAt: reply.syncedAt || confirmation.syncedAt || reply.submittedAt || "",
    };
    if (JSON.stringify(confirmation) !== JSON.stringify(nextConfirmation)) {
      state.familyConfirmations[key] = nextConfirmation;
      changed = true;
    }
  });

  (payload.checkinReplies || []).forEach((reply) => {
    const member = state.members.find((item) => item.id === reply.memberId);
    if (!member) return;
    const record = getRecord(reply.memberId, reply.eventId);
    if (mergeRecordField(record, "status", reply.status || "未確認")) changed = true;
    if (mergeRecordField(record, "am", Boolean(reply.am))) changed = true;
    if (mergeRecordField(record, "pm", Boolean(reply.pm))) changed = true;
    if (mergeRecordField(record, "note", reply.note || record.note || "")) changed = true;
    const key = checkinSubmissionKeyFor(reply.eventId, reply.group, reply.squad);
    const submission = state.checkinSubmissions[key] || {};
    const nextSubmission = {
      recorder: reply.recorder || submission.recorder || "",
      submittedAt: reply.submittedAt || submission.submittedAt || "",
      syncStatus: "sent",
      syncedAt: reply.syncedAt || submission.syncedAt || reply.submittedAt || "",
    };
    if (JSON.stringify(submission) !== JSON.stringify(nextSubmission)) {
      state.checkinSubmissions[key] = nextSubmission;
      changed = true;
    }
  });

  return changed;
}

function mergeRecordField(record, key, value) {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

async function syncToGoogle(options = {}) {
  const silent = Boolean(options.silent);
  const intent = options.intent || (APP_MODE === "family" ? "family" : "admin");
  const url = normalize(scriptUrl.value);
  if (!url) {
    if (!silent) alert("請先貼上 Apps Script Web App URL。");
    return false;
  }
  if (!silent) {
    const originalText = syncGoogle.textContent;
    syncGoogle.textContent = "同步中";
    syncGoogle.disabled = true;
    syncGoogle.dataset.originalText = originalText;
  }
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(buildSyncPayload(intent)),
    });
    markSubmissionsSynced(intent);
    const loaded = await loadBackendSnapshotFromGoogle();
    if (!silent) syncGoogle.textContent = loaded ? "已同步" : "已送出";
    return true;
  } catch (error) {
    if (!silent) syncGoogle.textContent = "同步失敗";
    return false;
  } finally {
    if (!silent) {
      setTimeout(() => {
        syncGoogle.disabled = false;
        syncGoogle.textContent = syncGoogle.dataset.originalText || "同步設定(勿按)";
      }, 1800);
    }
  }
}

async function refreshBackendReplies() {
  if (!refreshReplies) return;
  const originalText = refreshReplies.textContent;
  refreshReplies.textContent = "讀取中";
  refreshReplies.disabled = true;
  try {
    const loaded = await loadBackendSnapshotFromGoogle();
    refreshReplies.textContent = loaded ? "已更新" : "讀取失敗";
  } finally {
    setTimeout(() => {
      refreshReplies.disabled = false;
      refreshReplies.textContent = originalText || "重新讀取回覆";
    }, 1600);
  }
}

function markSubmissionsSynced(intent) {
  const syncedAt = new Date().toISOString();
  if (intent === "family") {
    Object.values(state.familyConfirmations || {}).forEach((item) => {
      if (item.syncStatus !== "sent") {
        item.syncStatus = "sent";
        item.syncedAt = syncedAt;
      }
    });
  }
  if (intent === "checkin") {
    Object.values(state.checkinSubmissions || {}).forEach((item) => {
      if (item.syncStatus !== "sent") {
        item.syncStatus = "sent";
        item.syncedAt = syncedAt;
      }
    });
  }
  saveState();
}

function buildSyncPayload(intent = "admin") {
  const familyConfirmations = syncFamilyConfirmations(intent);
  const checkinSubmissions = syncCheckinSubmissions(intent);
  return {
    action: "snapshot",
    intent,
    appMode: APP_MODE,
    syncedAt: new Date().toISOString(),
    currentEventId: state.currentEventId,
    events: state.events,
    members: state.members,
    records: syncRecords(intent, familyConfirmations, checkinSubmissions),
    familyConfirmations,
    checkinSubmissions,
    rules: state.rules,
    overview: buildOverviewRows(),
    annual: buildAnnualRows(),
  };
}

function syncFamilyConfirmations(intent) {
  if (intent !== "family") return {};
  return Object.fromEntries(Object.entries(state.familyConfirmations || {})
    .filter(([, confirmation]) => confirmation.syncStatus !== "sent"));
}

function syncCheckinSubmissions(intent) {
  if (intent !== "checkin") return {};
  return Object.fromEntries(Object.entries(state.checkinSubmissions || {})
    .filter(([, submission]) => submission.syncStatus !== "sent"));
}

function syncRecords(intent, familyConfirmations, checkinSubmissions) {
  const records = Object.values(state.records);
  if (intent === "family") {
    return records.filter((record) => {
      const member = memberById(record.memberId) || {};
      return Boolean(familyConfirmations[familyConfirmKeyFor(record.eventId, member.familyId || "")]);
    });
  }
  if (intent === "checkin") {
    return records.filter((record) => {
      const member = memberById(record.memberId) || {};
      const key = checkinSubmissionKeyFor(record.eventId, resolveCheckinGroup(member), resolveCheckinSquad(member));
      return Boolean(checkinSubmissions[key]);
    });
  }
  return records;
}

function memberById(memberId) {
  return state.members.find((member) => member.id === memberId) || null;
}

function buildOverviewRows() {
  const groups = currentEvent().eagleSplit ? ENTRANCES : ENTRANCES.filter((entry) => entry.key !== "育成鷹團");
  return groups.flatMap((entry) => SQUADS[entry.key].map((squad) => {
    const members = expectedMembers().filter((member) => resolveCheckinGroup(member) === entry.key && resolveCheckinSquad(member) === squad);
    const records = members.map((member) => getRecord(member.id));
    return {
      eventId: currentEvent().id,
      group: entry.key,
      squad,
      expected: members.length,
      morning: records.filter(hasMorning).length,
      afternoon: records.filter(hasAfternoon).length,
      late: records.filter((record) => record.status === "遲到").length,
      absent: records.filter((record) => record.status === "未到").length,
      familyAlerts: findFamilyAlerts().filter((alert) => alert.group === entry.key && alert.squad === squad).length,
    };
  }));
}

function buildAnnualRows() {
  return state.members.filter(isAnnualChild).map((member) => {
    const counts = { normal: 0, late: 0, morning: 0, afternoon: 0, absent: 0 };
    let total = 0;
    const eventValues = state.events.map((event) => {
      const record = getRecord(member.id, event.id);
      const status = annualStatus(record);
      const weight = recordWeight(status);
      total += weight;
      updateAnnualCounts(counts, status);
      return status === "未確認" ? "" : weight;
    });
    const completed = state.events.filter((event) => annualStatus(getRecord(member.id, event.id)) !== "未確認").length;
    return {
      personId: member.id,
      familyId: member.familyId,
      name: member.name,
      group: member.group,
      squad: member.squad,
      events: eventValues,
      ...counts,
      totalAbsence: total,
      attendanceRate: completed ? (completed - total) / completed : "",
    };
  });
}

function render() {
  openState.textContent = `第 ${currentEvent().id} 場`;
  renderFamilyEventSummary();
  renderMetrics();
  renderAlerts();
  renderOverviewGroups();
  renderEntrances();
  if (activeView === "family") renderFamily();
  if (activeView === "expected") renderExpectedLists();
  if (activeView === "checkin") renderCheckin();
  if (activeView === "annual") renderAnnual();
}

function renderFamilyEventSummary() {
  if (!familyEventSummary) return;
  const event = currentEvent();
  const eventDateText = event.date ? event.date : "尚未設定";
  familyEventSummary.innerHTML = `
    <div>
      <span>活動場次</span>
      <strong>第 ${event.id} 場</strong>
    </div>
    <div>
      <span>活動日期</span>
      <strong>${escapeHtml(eventDateText)}</strong>
    </div>
    <div>
      <span>活動名稱</span>
      <strong>${escapeHtml(event.name || "尚未設定")}</strong>
    </div>
  `;
}

function syncEventFields() {
  const event = currentEvent();
  eventDate.value = event.date;
  eventName.value = event.name;
  eagleSplit.checked = event.eagleSplit;
  preOpen.checked = event.preOpen;
  onsiteOpen.checked = event.onsiteOpen;
  syncRuleFields();
}

function syncRuleFields() {
  ruleInputs["出席"].value = state.rules["出席"];
  ruleInputs["遲到"].value = state.rules["遲到"];
  ruleInputs["上午請假"].value = state.rules["上午請假"];
  ruleInputs["下午請假"].value = state.rules["下午請假"];
  ruleInputs["未到"].value = state.rules["未到"];
}

function renderMetrics() {
  const members = expectedMembers();
  const children = members.filter(isChild);
  const adults = members.filter(isAdult);
  const childRecords = children.map((member) => getRecord(member.id));
  const adultRecords = adults.map((member) => getRecord(member.id));
  const metrics = [
    ["孩子預計", children.length],
    ["孩子上午實到", childRecords.filter(hasMorning).length],
    ["孩子下午實到", childRecords.filter(hasAfternoon).length],
    ["成人上午實到", adultRecords.filter(hasMorning).length],
    ["陪同異常", findFamilyAlerts().length],
  ];
  metricGrid.innerHTML = metrics.map(([label, value]) => (
    `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`
  )).join("");
}

function renderAlerts() {
  const alerts = findFamilyAlerts();
  if (!alerts.length) {
    familyAlerts.innerHTML = `<div class="empty-note">目前沒有無家庭成人陪同的實到兒童。</div>`;
    return;
  }
  familyAlerts.innerHTML = alerts.map((alert) => (
    `<article class="alert-item"><strong>家庭 ${alert.familyId}｜${alert.period}</strong><p>${alert.name}｜${alert.group}｜${alert.squad}</p></article>`
  )).join("");
}

function renderOverviewGroups() {
  const groups = currentEvent().eagleSplit ? ENTRANCES : ENTRANCES.filter((entry) => entry.key !== "育成鷹團");
  overviewGroups.innerHTML = groups.map((entry) => {
    const rows = SQUADS[entry.key].map((squad) => {
      const members = expectedMembers().filter((member) => resolveCheckinGroup(member) === entry.key && resolveCheckinSquad(member) === squad);
      const records = members.map((member) => getRecord(member.id));
      return `<div class="mini-stat"><span>${squad}</span><span>${members.length}</span><span>${records.filter(hasMorning).length}</span><span>${records.filter(hasAfternoon).length}</span><span>${records.filter((record) => record.status === "未到").length}</span></div>`;
    }).join("");
    return `<article class="section-card"><h3>${entry.label}</h3><div class="mini-stat"><span>小隊</span><span>預</span><span>早</span><span>午</span><span>未</span></div>${rows}</article>`;
  }).join("");
}

function renderExpectedLists() {
  renderPreReplyLists();
  const groups = currentEvent().eagleSplit ? ENTRANCES : ENTRANCES.filter((entry) => entry.key !== "育成鷹團");
  expectedLists.replaceChildren(...groups.map((entry) => renderExpectedCard(entry)));
}

function renderPreReplyLists() {
  if (!preReplyLists) return;
  const families = Object.keys(state.familyConfirmations || {})
    .map((key) => {
      const [eventId, type, familyId] = key.split("|");
      return { eventId, type, familyId, confirmation: state.familyConfirmations[key] };
    })
    .filter((item) => item.eventId === currentEvent().id && item.type === "family")
    .sort((a, b) => String(a.familyId).localeCompare(String(b.familyId), "zh-Hant", { numeric: true }));
  const repliedFamilyIds = new Set(families.map((family) => family.familyId));
  const pendingFamilies = expectedFamilyConfirmFamilies()
    .filter((family) => !repliedFamilyIds.has(family.familyId));

  if (!families.length) {
    preReplyLists.innerHTML = `
      <section class="pre-reply-card">
        <div class="pre-reply-title"><strong>會前回覆總覽</strong><span>目前尚未讀到本場家庭回覆。</span></div>
      </section>
      ${renderPendingFamilyReplies(pendingFamilies)}
    `;
    return;
  }

  const rows = families.map((family) => {
    const members = state.members
      .filter((member) => member.familyId === family.familyId)
      .sort(familyConfirmSort);
    const memberRows = members.map((member) => {
      const record = getRecord(member.id);
      return `
        <div class="pre-reply-row">
          <span>家庭 ${escapeHtml(member.familyId)}</span>
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(displayRole(member))}</span>
          <span>${escapeHtml(record.expected || "未確認")}</span>
          <span>${escapeHtml(record.route || "--")}</span>
          <span>${escapeHtml(record.note || "--")}</span>
        </div>
      `;
    }).join("");
    return `
      <article class="pre-reply-card">
        <div class="pre-reply-title">
          <strong>家庭 ${escapeHtml(family.familyId)}</strong>
          <span>${formatTime(family.confirmation.submittedAt)}｜${syncStatusText(family.confirmation)}</span>
        </div>
        <div class="pre-reply-row header">
          <span>家庭</span><span>自然名</span><span>屬性</span><span>會前狀態</span><span>活動去向</span><span>備註</span>
        </div>
        ${memberRows}
      </article>
    `;
  }).join("");

  preReplyLists.innerHTML = `
    <section class="pre-reply-summary">
      <strong>會前回覆總覽</strong>
      <span>${families.length} 個家庭已回覆，${pendingFamilies.length} 個家庭尚未回覆。</span>
    </section>
    ${rows}
    ${renderPendingFamilyReplies(pendingFamilies)}
  `;
}

function renderPendingFamilyReplies(families) {
  if (!families.length) return "";
  const rows = families.map((family) => `
    <article class="pre-reply-card pending">
      <div class="pre-reply-title">
        <strong>家庭 ${escapeHtml(family.familyId)}</strong>
        <span>尚未收到會前確認</span>
      </div>
      <div class="pending-family-members">${escapeHtml(family.members.map((member) => member.name).join("、"))}</div>
    </article>
  `).join("");
  return `
    <section class="pre-reply-summary pending">
      <strong>尚未回覆家庭</strong>
      <span>以下家庭目前沒有在後端會前回覆紀錄中。</span>
    </section>
    ${rows}
  `;
}

function expectedFamilyConfirmFamilies() {
  return Object.entries(groupBy(state.members, (member) => member.familyId))
    .filter(([familyId, members]) => normalize(familyId) && members.some(shouldIncludeInFamilyConfirm))
    .map(([familyId, members]) => ({
      familyId,
      members: members.filter(shouldIncludeInFamilyConfirm).sort(familyConfirmSort),
    }))
    .sort((a, b) => String(a.familyId).localeCompare(String(b.familyId), "zh-Hant", { numeric: true }));
}

function shouldIncludeInFamilyConfirm(member) {
  const sourceSquad = normalize(member.sourceSquad || member.squad);
  return Boolean(member.familyId && member.name && sourceSquad && sourceSquad !== "/");
}

function renderExpectedCard(entry) {
  const members = expectedMembers()
    .filter((member) => resolveGroup(member) === entry.key)
    .sort((a, b) => resolveSquad(a).localeCompare(resolveSquad(b), "zh-Hant") || memberSort(a, b));
  const card = document.createElement("article");
  card.className = "expected-card";
  const rows = members.map((member) => renderExpectedRow(member)).join("");
  card.innerHTML = `
    <div class="expected-title">
      <strong>${entry.label.replace("點名", "預計出席")}</strong>
      <span>${members.length} 人</span>
    </div>
    <div class="expected-list">
      <div class="expected-row header">
        <span>家庭編號</span><span>自然名</span><span>小隊/所屬分團</span><span>預計時段</span><span>工作分配</span>
      </div>
      ${rows || '<div class="empty-note">目前沒有預計出席名單。</div>'}
    </div>
  `;
  card.querySelectorAll("[data-work-group]").forEach((select) => {
    select.addEventListener("change", () => {
      const record = getRecord(select.dataset.workGroup);
      record.workGroup = normalize(select.value);
      record.work = formatWorkAssignment(record);
      saveState();
      render();
    });
  });
  card.querySelectorAll("[data-work-role]").forEach((input) => {
    input.addEventListener("input", () => {
      const record = getRecord(input.dataset.workRole);
      record.workRole = normalize(input.value);
      record.work = formatWorkAssignment(record);
      saveState();
    });
  });
  return card;
}

function renderExpectedRow(member) {
  const record = getRecord(member.id);
  const needsWork = isAdult(member) && (resolveGroup(member) === "育成會" || resolveGroup(member) === "育成鷹團");
  const work = needsWork && APP_MODE !== "checkin"
    ? `<div class="work-assignment">
        <select data-work-group="${member.id}" aria-label="支援團隊">
          <option value="">原點名入口</option>
          ${SUPPORT_TARGETS.map((target) => `<option value="${target.value}" ${record.workGroup === target.value ? "selected" : ""}>${target.value}</option>`).join("")}
        </select>
        <input data-work-role="${member.id}" type="text" value="${escapeAttribute(record.workRole || record.work)}" placeholder="職務註記：支援人力、安全官">
      </div>`
    : `<span>${escapeHtml(formatWorkAssignment(record) || "--")}</span>`;
  return `
    <div class="expected-row">
      <span>家庭 ${member.familyId}</span>
      <strong>${member.name}</strong>
      <span>${isAdult(member) ? member.sourceGroup || resolveSquad(member) : resolveSquad(member)}</span>
      <span>${record.expected}</span>
      ${work}
    </div>
  `;
}

function renderEntrances() {
  entranceGrid.innerHTML = "";
  ENTRANCES.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entrance-card";
    button.hidden = entry.key === "育成鷹團" && !currentEvent().eagleSplit;
    button.classList.toggle("is-active", activeEntrance === entry.key);
    button.innerHTML = `${entry.label}<span>${entry.hint}</span>`;
    button.addEventListener("click", () => {
      activeEntrance = entry.key;
      activeSquad = "全部";
      renderCheckin();
      renderEntrances();
    });
    entranceGrid.appendChild(button);
  });
}

function renderFamily() {
  if (!currentEvent().preOpen) {
    familyCards.innerHTML = `<div class="empty-note">本場尚未開放家庭會前確認。</div>`;
    familyConfirmPanel.innerHTML = "";
    return;
  }
  const familyId = normalize(familySearch.value);
  const families = groupBy(state.members, (member) => member.familyId);
  if (!familyId) {
    const firstFamilies = Object.keys(families).slice(0, 8).join("、");
    familyCards.innerHTML = `<div class="empty-note">請輸入家庭編號。可先試：${firstFamilies}</div>`;
    familyConfirmPanel.innerHTML = "";
    return;
  }
  const members = (families[familyId] || []).slice().sort(familyConfirmSort);
  if (!members.length) {
    familyCards.innerHTML = `<div class="empty-note">找不到家庭 ${familyId}。</div>`;
    familyConfirmPanel.innerHTML = "";
    return;
  }
  const confirmation = familyConfirmation(familyId);
  familyCards.replaceChildren(...members.map((member) => renderPersonCard(member, "family", { locked: Boolean(confirmation) })));
  renderFamilyConfirmPanel(familyId, confirmation);
}

function renderCheckin() {
  if (activeEntrance === "育成鷹團" && !currentEvent().eagleSplit) activeEntrance = "育成會";
  if (!["全部", ...SQUADS[activeEntrance]].includes(activeSquad)) activeSquad = "全部";
  boardTitle.textContent = entranceLabel(activeEntrance);
  const squads = ["全部", ...SQUADS[activeEntrance]];
  squadTabs.innerHTML = "";
  squads.forEach((squad) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = squad;
    button.classList.toggle("is-active", activeSquad === squad);
    button.addEventListener("click", () => {
      activeSquad = squad;
      renderCheckin();
    });
    squadTabs.appendChild(button);
  });

  if (!currentEvent().onsiteOpen) {
    checkinRecorderPanel.innerHTML = "";
    checkinSubmitPanel.innerHTML = "";
    checkinList.innerHTML = `<div class="empty-note">本場尚未開放現場點名。</div>`;
    return;
  }

  const submission = checkinSubmission();
  renderCheckinRecorderPanel(submission);
  renderCheckinSubmitPanel(submission);
  syncGuestFields();
  const members = currentCheckinMembers();

  if (!members.length) {
    checkinList.innerHTML = `<div class="empty-note">這個入口目前沒有名單。若現場有人臨時出席，可直接在下方新增。</div>`;
    return;
  }
  checkinList.replaceChildren(...members.map((member) => renderPersonCard(member, "checkin", { locked: Boolean(submission) })));
}

function renderFamilyConfirmPanel(familyId, confirmation) {
  if (confirmation) {
    familyConfirmPanel.innerHTML = `
      <div class="confirm-status"><strong>本家庭已完成確認</strong><span>${formatTime(confirmation.submittedAt)}｜${syncStatusText(confirmation)}</span></div>
      <p class="confirm-help">表單填寫如需修改，請洽點名人員孔雀魚。</p>
    `;
    return;
  }
  familyConfirmPanel.innerHTML = `
    <p class="required-note">必填：每位成員上方出席狀態；分流成人另需填老鷹單飛活動選擇。</p>
    <button id="confirmFamily" type="button">確認送出家庭資料</button>
  `;
  familyConfirmPanel.querySelector("#confirmFamily").addEventListener("click", async () => {
    const missing = validateFamilyConfirmation(familyId);
    if (missing.length) {
      alert(`請先完成必填欄位：\n${missing.join("\n")}`);
      return;
    }
    const key = familyConfirmKey(familyId);
    state.familyConfirmations[key] = { submittedAt: new Date().toISOString(), syncStatus: "pending" };
    saveState();
    renderFamily();
    const synced = await syncToGoogle({ silent: true, intent: "family" });
    state.familyConfirmations[key].syncStatus = synced ? "sent" : "failed";
    state.familyConfirmations[key].syncedAt = synced ? new Date().toISOString() : "";
    saveState();
    renderFamily();
  });
}

function renderCheckinRecorderPanel(submission) {
  checkinRecorderPanel.classList.remove("recorder-panel");
  if (activeSquad === "全部") {
    checkinRecorderPanel.innerHTML = "";
    return;
  }
  if (submission) {
    checkinRecorderPanel.innerHTML = `
      <div class="confirm-status"><strong>點名人員</strong><span>${escapeHtml(submission.recorder)}</span></div>
    `;
    return;
  }
  checkinRecorderPanel.classList.add("recorder-panel");
  checkinRecorderPanel.innerHTML = `
    <div class="recorder-title">
      <strong>先填點名人員</strong>
      <span>必填，只填自然名</span>
    </div>
    <label>
      <span>點名人員自然名（必填）</span>
      <input id="checkinRecorder" type="text" value="${escapeAttribute(state.checkinRecorderDrafts?.[checkinSubmissionKey()] || "")}" placeholder="請填自然名">
    </label>
  `;
  checkinRecorderPanel.querySelector("#checkinRecorder").addEventListener("input", (event) => {
    state.checkinRecorderDrafts[checkinSubmissionKey()] = normalize(event.target.value);
    saveState();
  });
}

function renderCheckinSubmitPanel(submission) {
  if (activeSquad === "全部") {
    checkinSubmitPanel.innerHTML = `<div class="confirm-status"><strong>請先選擇單一分隊</strong><span>每個分隊本場只能送出一次。</span></div>`;
    return;
  }
  if (submission) {
    checkinSubmitPanel.innerHTML = `
      <div class="confirm-status"><strong>${activeSquad} 已完成點名</strong><span>填寫人：${escapeHtml(submission.recorder)}｜${formatTime(submission.submittedAt)}｜${syncStatusText(submission)}</span></div>
      <p class="confirm-help">表單填寫如需修改，請洽點名人員孔雀魚。</p>
    `;
    return;
  }
  checkinSubmitPanel.innerHTML = `
    <p class="required-note">必填：點名人員自然名、此分隊每位成員現場狀態。</p>
    <button id="submitCheckin" type="button">確認送出本分隊點名</button>
  `;
  checkinSubmitPanel.querySelector("#submitCheckin").addEventListener("click", async () => {
    const recorder = normalize(checkinRecorderPanel.querySelector("#checkinRecorder")?.value);
    if (!recorder) {
      alert("請先填寫點名人員。");
      return;
    }
    const missing = validateCheckinSubmission();
    if (missing.length) {
      alert(`請先完成必填欄位：\n${missing.join("\n")}`);
      return;
    }
    const key = checkinSubmissionKey();
    state.checkinSubmissions[key] = {
      recorder,
      submittedAt: new Date().toISOString(),
      eventId: currentEvent().id,
      group: activeEntrance,
      squad: activeSquad,
      syncStatus: "pending",
    };
    delete state.checkinRecorderDrafts[key];
    saveState();
    render();
    const synced = await syncToGoogle({ silent: true, intent: "checkin" });
    state.checkinSubmissions[key].syncStatus = synced ? "sent" : "failed";
    state.checkinSubmissions[key].syncedAt = synced ? new Date().toISOString() : "";
    saveState();
    render();
  });
}

function syncGuestFields() {
  const disabled = Boolean(checkinSubmission()) || activeSquad === "全部";
  guestForm.querySelectorAll('input[name="guestMode"]').forEach((input) => {
    input.disabled = disabled;
  });
  const open = isGuestModeOpen() && !disabled;
  guestFields.hidden = !open;
  guestFields.querySelectorAll("input, button").forEach((field) => {
    field.disabled = !open;
  });
}

function isGuestModeOpen() {
  return guestForm.querySelector('input[name="guestMode"]:checked')?.value === "has";
}

function validateFamilyConfirmation(familyId) {
  return state.members
    .filter((member) => member.familyId === familyId)
    .sort(familyConfirmSort)
    .flatMap((member) => {
      const missing = [];
      if (isFamilyStatusMissing(member)) missing.push(`${member.name}：請選上方出席狀態`);
      if (isRouteMissing(member)) missing.push(`${member.name}：請選老鷹單飛活動`);
      return missing;
    });
}

function validateCheckinSubmission() {
  return currentCheckinMembers().filter(isCheckinStatusMissing).map((member) => `${member.name}：請選現場狀態`);
}

function currentCheckinMembers() {
  const term = normalize(memberSearch.value).toLowerCase();
  return expectedMembers({ includeUnconfirmed: true })
    .filter((member) => resolveCheckinGroup(member) === activeEntrance)
    .filter((member) => activeSquad === "全部" || resolveCheckinSquad(member) === activeSquad)
    .filter((member) => !term || [member.familyId, member.name, member.group, member.squad].join(" ").toLowerCase().includes(term))
    .sort(checkinSort);
}

function isFamilyStatusMissing(member) {
  return getRecord(member.id).expected === "未確認";
}

function isCheckinStatusMissing(member) {
  return getRecord(member.id).status === "未確認";
}

function isRouteMissing(member) {
  const record = getRecord(member.id);
  return currentEvent().eagleSplit && isAdult(member) && member.eagleQualified && record.expected !== "請假" && !record.route;
}

function isExpectedHint(record, action) {
  if (record.status !== "未確認") return false;
  if (record.expected === "全天出席") return action === "出席";
  return normalizePartialLeaveStatus(record.expected) === action;
}

function renderPersonCard(member, mode, options = {}) {
  const record = getRecord(member.id);
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const locked = Boolean(options.locked);
  const group = mode === "checkin" ? resolveCheckinGroup(member) : resolveGroup(member);
  const squad = mode === "checkin" ? resolveCheckinSquad(member) : resolveSquad(member);
  const expectedText = record.expected === "未確認" ? "尚未確認" : `預計${record.expected}`;
  const checkinExpectedText = mode === "checkin" && record.expected !== "未確認" ? `｜預計${record.expected}` : "";
  const roleText = mode === "family" ? displayRole(member) : member.role;
  const groupText = mode === "family" ? member.sourceGroup || group : group;
  const squadText = mode === "family" ? member.sourceSquad || squad : squad;
  card.querySelector(".person-meta").textContent = `家庭 ${member.familyId}｜${roleText}｜${groupText}｜${squadText}｜${expectedText}${checkinExpectedText}`;
  card.querySelector(".person-name").textContent = member.name;
  const status = card.querySelector(".person-status");
  status.textContent = mode === "family" ? record.expected : record.status;
  status.dataset.state = status.textContent;
  card.classList.toggle("needs-required", mode === "family" ? isFamilyStatusMissing(member) : isCheckinStatusMissing(member));

  const actions = mode === "family" ? FAMILY_STATUSES : checkinActions(member);
  const actionWrap = card.querySelector(".status-actions");
  actions.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    button.className = item === "未到" || item === "請假" ? "danger" : "";
    if (mode === "checkin" && isExpectedHint(record, item)) button.classList.add("is-expected");
    button.disabled = locked;
    button.classList.toggle("is-selected", mode === "family" ? record.expected === item : record.status === item);
    button.addEventListener("click", () => {
      if (locked) return;
      if (mode === "family") {
        record.expected = item;
        if (item === "請假") record.route = "";
      } else {
        applyAttendanceStatus(record, item, member);
      }
      saveState();
      render();
    });
    actionWrap.appendChild(button);
  });

  const adultRow = card.querySelector(".adult-row");
  adultRow.hidden = mode === "family" || !isAdult(member);
  const amCheck = card.querySelector(".am-check");
  const pmCheck = card.querySelector(".pm-check");
  amCheck.checked = record.am;
  pmCheck.checked = record.pm;
  amCheck.disabled = locked;
  pmCheck.disabled = locked;
  amCheck.addEventListener("change", () => updatePeriod(member, "am", amCheck.checked));
  pmCheck.addEventListener("change", () => updatePeriod(member, "pm", pmCheck.checked));

  const splitRow = card.querySelector(".split-row");
  const needsRoute = currentEvent().eagleSplit && isAdult(member) && member.eagleQualified && record.expected !== "請假";
  splitRow.hidden = !needsRoute;
  if (needsRoute) {
    const title = document.createElement("div");
    title.className = "split-title";
    title.innerHTML = `<strong>老鷹單飛活動選擇</strong><span>上方出席狀態與本欄都要選填</span>`;
    splitRow.appendChild(title);
    splitRow.classList.toggle("needs-required", mode === "family" && isRouteMissing(member));
    const routes = mode === "checkin" ? SPLIT_CHECKIN_ROUTES : ADULT_ROUTES;
    routes.forEach((route) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = route;
      button.disabled = locked;
      button.classList.toggle("is-selected", record.route === route);
      button.addEventListener("click", () => {
        if (locked) return;
        record.route = route;
        saveState();
        render();
      });
      splitRow.appendChild(button);
    });
  }

  const note = card.querySelector(".note-field");
  note.value = record.note;
  note.disabled = locked;
  note.addEventListener("change", () => {
    if (locked) return;
    record.note = normalize(note.value);
    saveState();
  });

  return card;
}

function renderAnnual() {
  const term = normalize(annualSearch.value).toLowerCase();
  const children = state.members
    .filter(isAnnualChild)
    .filter((member) => !term || [member.familyId, member.name, member.group, member.squad].join(" ").toLowerCase().includes(term))
    .sort(memberSort);
  if (!children.length) {
    annualList.innerHTML = `<div class="empty-note">找不到符合條件的孩子。</div>`;
    return;
  }
  annualList.innerHTML = children.map((member) => {
    let total = 0;
    const counts = { normal: 0, late: 0, morning: 0, afternoon: 0, absent: 0 };
    const cells = state.events.map((event) => {
      const record = getRecord(member.id, event.id);
      const status = annualStatus(record);
      const weight = recordWeight(status);
      total += weight;
      updateAnnualCounts(counts, status);
      const cls = weight === 0 ? "ok" : weight < 1 ? "warn" : "bad";
      const text = status === "未確認" ? "-" : String(weight);
      return `<span class="annual-cell ${cls}">${text}</span>`;
    }).join("");
    const completed = state.events.filter((event) => annualStatus(getRecord(member.id, event.id)) !== "未確認").length;
    const attendanceRate = completed ? Math.round(((completed - total) / completed) * 100) : 0;
    return `<article class="annual-row"><strong>家庭 ${member.familyId}</strong><span>${member.name}｜${member.group}｜${member.squad}</span>${cells}<span class="annual-total">缺席 ${total}<br><span class="annual-detail">正常 ${counts.normal}｜遲到 ${counts.late}｜上午 ${counts.morning}｜下午 ${counts.afternoon}｜缺席 ${counts.absent}｜出席率 ${attendanceRate}%</span></span></article>`;
  }).join("");
}

function updatePeriod(member, period, checked) {
  const record = getRecord(member.id);
  record[period] = checked;
  if (record.am && record.pm) record.status = isAdult(member) ? "全天出席" : "出席";
  if (record.am && !record.pm) record.status = "下午請假";
  if (!record.am && record.pm) record.status = "上午請假";
  if (!record.am && !record.pm && record.status !== "請假") record.status = "未到";
  saveState();
  render();
}

function applyAttendanceStatus(record, status, member) {
  if (status === "出席" || status === "全天出席" || status === "遲到") {
    record.status = isAdult(member) ? "全天出席" : status === "全天出席" ? "出席" : status;
    record.am = true;
    record.pm = true;
    return;
  }
  if (isAfternoonLeave(status)) {
    record.status = "下午請假";
    record.am = true;
    record.pm = false;
    return;
  }
  if (isMorningLeave(status)) {
    record.status = "上午請假";
    record.am = false;
    record.pm = true;
    return;
  }
  if (status === "請假" || status === "未到") {
    record.status = "未到";
    record.am = false;
    record.pm = false;
  }
}

function shouldRepairExpectedAttendance(record) {
  if (!["全天出席", "上午請假", "下午請假", "上午出席", "下午出席", "請假"].includes(record.expected)) return false;
  if (record.status === "未確認" || !record.status) return true;
  if (record.expected === "全天出席") return !record.am || !record.pm;
  if (isAfternoonLeave(record.expected)) return !record.am || record.pm;
  if (isMorningLeave(record.expected)) return record.am || !record.pm;
  if (record.expected === "請假") return record.am || record.pm || record.status !== "未到";
  return false;
}

function shouldClearExpectedOnlyCheckin(saved, member, record) {
  if (!["全天出席", "上午請假", "下午請假", "上午出席", "下午出席", "請假"].includes(record.expected)) return false;
  if (record.status === "未確認") return false;
  const eventId = record.eventId || currentEvent().id;
  if (hasSubmittedCheckin(saved, eventId, member, record)) return false;
  if (record.expected === "全天出席") return record.am && record.pm && ["出席", "全天出席"].includes(record.status);
  if (isAfternoonLeave(record.expected)) return record.am && !record.pm && isAfternoonLeave(record.status);
  if (isMorningLeave(record.expected)) return !record.am && record.pm && isMorningLeave(record.status);
  if (record.expected === "請假") return !record.am && !record.pm && record.status === "未到";
  return false;
}

function hasSubmittedCheckin(saved, eventId, member, record) {
  const group = resolveCheckinGroupFromSnapshot(member, record, saved.events || []);
  const squad = resolveCheckinSquadFromSnapshot(member, record, saved.events || []);
  return Object.values(saved.checkinSubmissions || {}).some((submission) => (
    submission.eventId === eventId
    && submission.group === group
    && submission.squad === squad
  ));
}

function resolveGroupFromSnapshot(member, record, events) {
  if (member.group === "未在團" && member.squad === "育苗小藍隊") return "育成會";
  const event = events.find((item) => item.id === record.eventId) || {};
  if (event.eagleSplit && isAdult(member) && member.eagleQualified && member.group === "育成會" && isEagleSoloRoute(record.route)) return "育成鷹團";
  if (isAdult(member) && member.group && member.group !== "育成會") return member.group;
  if (isAdult(member)) return "育成會";
  return member.group;
}

function resolveCheckinGroupFromSnapshot(member, record, events) {
  const support = supportAssignmentFromRecord(member, record);
  return support?.group || resolveGroupFromSnapshot(member, record, events);
}

function resolveCheckinSquadFromSnapshot(member, record, events) {
  const support = supportAssignmentFromRecord(member, record);
  if (support) return support.squad;
  const group = resolveGroupFromSnapshot(member, record, events);
  if (group === "育成鷹團") return "育成鷹團";
  return member.squad || "";
}

function supportAssignmentFromRecord(member, record) {
  if (!isAdult(member)) return null;
  return SUPPORT_TARGETS.find((target) => target.value === record.workGroup) || null;
}

function clearCheckinStatus(record) {
  record.status = "未確認";
  record.am = false;
  record.pm = false;
}

function recordWeight(status) {
  return Number(state.rules[status] ?? DEFAULT_RULES[status] ?? 0);
}

function updateAnnualCounts(counts, status) {
  if (status === "出席" || status === "全天出席") counts.normal += 1;
  if (status === "遲到") counts.late += 1;
  if (isAfternoonLeave(status)) counts.morning += 1;
  if (isMorningLeave(status)) counts.afternoon += 1;
  if (status === "未到" || status === "請假") counts.absent += 1;
}

function annualStatus(record) {
  if (record.status && record.status !== "未確認") return normalizePartialLeaveStatus(record.status);
  const expected = normalizePartialLeaveStatus(record.expected);
  if (["請假", "上午請假", "下午請假"].includes(expected)) return expected;
  return "未確認";
}

function findFamilyAlerts() {
  const byFamily = groupBy(state.members, (member) => member.familyId);
  const alerts = [];
  Object.entries(byFamily).forEach(([familyId, members]) => {
    const adults = members.filter(isAdult);
    const familySubmitted = Boolean(familyConfirmation(familyId));
    members.filter(isChild).forEach((child) => {
      const record = getRecord(child.id);
      [
        ["上午", hasMorning(record), adults.some((adult) => isAccompanyingAdultPresent(adult, "am", familySubmitted))],
        ["下午", hasAfternoon(record), adults.some((adult) => isAccompanyingAdultPresent(adult, "pm", familySubmitted))],
      ].forEach(([period, childPresent, adultPresent]) => {
        if (childPresent && !adultPresent) {
          alerts.push({ familyId, period, name: child.name, group: child.group, squad: child.squad });
        }
      });
    });
  });
  return alerts;
}

function isAccompanyingAdultPresent(adult, period, familySubmitted = false) {
  const record = getRecord(adult.id);
  if (record.expected === "請假") return false;
  if (familySubmitted && record.expected === "未確認") return false;
  if (record.status === "未確認") return false;
  return period === "am" ? hasMorning(record) : hasAfternoon(record);
}

function expectedMembers(options = {}) {
  return state.members.filter((member) => {
    const record = getRecord(member.id);
    if (!options.includeUnconfirmed && !member.isGuest && record.expected === "未確認") return false;
    if (record.expected === "請假") return false;
    if (!currentEvent().eagleSplit || !member.eagleQualified || !isAdult(member) || member.group !== "育成會") return true;
    return true;
  });
}

function resolveGroup(member) {
  const record = getRecord(member.id);
  if (currentEvent().eagleSplit && isAdult(member) && member.eagleQualified && member.group === "育成會" && isEagleSoloRoute(record.route)) return "育成鷹團";
  if (member.group === "未在團" && member.squad === "育苗小藍隊") return "育成會";
  if (isAdult(member) && member.group && member.group !== "育成會") return member.group;
  if (isAdult(member)) return "育成會";
  return member.group;
}

function resolveSquad(member) {
  const group = resolveGroup(member);
  if (group === "育成鷹團") return "育成鷹團";
  if (SQUADS[group]?.includes(member.squad)) return member.squad;
  return SQUADS[group]?.[0] || member.squad || "未分隊";
}

function resolveCheckinGroup(member) {
  const support = supportAssignment(member);
  return support?.group || resolveGroup(member);
}

function resolveCheckinSquad(member) {
  const support = supportAssignment(member);
  if (support) return support.squad;
  return resolveSquad(member);
}

function supportAssignment(member) {
  if (!isAdult(member)) return null;
  const record = getRecord(member.id);
  return SUPPORT_TARGETS.find((target) => target.value === record.workGroup) || null;
}

function getRecord(memberId, eventId = currentEvent().id) {
  const key = `${eventId}|${memberId}`;
  if (!state.records[key]) {
    const member = state.members.find((item) => item.id === memberId);
    state.records[key] = {
      memberId,
      eventId,
      status: "未確認",
      expected: "未確認",
      am: false,
      pm: false,
      route: "",
      work: "",
      workGroup: "",
      workRole: "",
      note: "",
    };
  }
  return state.records[key];
}

function familyConfirmKey(familyId) {
  return familyConfirmKeyFor(currentEvent().id, familyId);
}

function familyConfirmKeyFor(eventId, familyId) {
  return `${eventId}|family|${familyId}`;
}

function familyConfirmation(familyId) {
  return state.familyConfirmations?.[familyConfirmKey(familyId)] || null;
}

function checkinSubmissionKey() {
  return checkinSubmissionKeyFor(currentEvent().id, activeEntrance, activeSquad);
}

function checkinSubmissionKeyFor(eventId, group, squad) {
  return `${eventId}|checkin|${group}|${squad}`;
}

function checkinSubmission() {
  if (activeSquad === "全部") return null;
  return state.checkinSubmissions?.[checkinSubmissionKey()] || null;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.members?.length && saved?.events?.length) return migrateState(saved);
  } catch (error) {
    // Use fresh state when browser data is not readable.
  }
  return {
    currentEventId: "01",
    events: buildEvents(),
    members: buildMembers(),
    records: {},
    familyConfirmations: {},
    checkinSubmissions: {},
    checkinRecorderDrafts: {},
    rules: { ...DEFAULT_RULES },
  };
}

function migrateState(saved) {
  saved.rules = { ...DEFAULT_RULES, ...(saved.rules || {}) };
  saved.familyConfirmations = saved.familyConfirmations || {};
  saved.checkinSubmissions = saved.checkinSubmissions || {};
  saved.checkinRecorderDrafts = saved.checkinRecorderDrafts || {};
  saved.events.forEach((event) => {
    if (!Object.prototype.hasOwnProperty.call(event, "preOpen")) event.preOpen = true;
    if (!Object.prototype.hasOwnProperty.call(event, "onsiteOpen")) event.onsiteOpen = true;
  });
  const rosterChanged = syncRosterFromSource(saved);
  saved.members.forEach((member) => {
    if (member.group === "鷹團育成") member.group = "育成鷹團";
    if (member.squad === "鷹團育成") member.squad = "育成鷹團";
    if (member.sourceGroup === "鷹團育成") member.sourceGroup = "育成鷹團";
    if (member.sourceSquad === "鷹團育成") member.sourceSquad = "育成鷹團";
  });
  const memberById = Object.fromEntries((saved.members || []).map((member) => [member.id, member]));
  let recordsRepaired = false;
  Object.values(saved.records || {}).forEach((record) => {
    if (record.route === "單飛活動" || record.route === "育成鷹團活動") record.route = EAGLE_SOLO_ROUTE;
    if (record.route === "請假" || record.route === "本次請假" || record.route === "不參加老鷹單飛") record.route = "";
    if (!record.expected) record.expected = record.status && record.status !== "未確認" ? record.status : "未確認";
    if (record.expected === "出席") record.expected = "全天出席";
    record.expected = normalizePartialLeaveStatus(record.expected);
    record.status = normalizePartialLeaveStatus(record.status);
    if (record.expected === "請假" && record.route) {
      record.route = "";
      recordsRepaired = true;
    }
    if (syncRecordPeriodFlags(record)) recordsRepaired = true;
    if (!Object.prototype.hasOwnProperty.call(record, "work")) record.work = "";
    if (!Object.prototype.hasOwnProperty.call(record, "workGroup")) record.workGroup = "";
    if (!Object.prototype.hasOwnProperty.call(record, "workRole")) record.workRole = record.work || "";
    const member = memberById[record.memberId];
    if (member && shouldClearExpectedOnlyCheckin(saved, member, record)) {
      clearCheckinStatus(record);
      recordsRepaired = true;
    }
  });
  if (rosterChanged || recordsRepaired) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  return saved;
}

function syncRosterFromSource(saved) {
  if (!Array.isArray(window.PEOPLE_DATA) || !window.PEOPLE_DATA.length) return false;
  const roster = buildMembers();
  const rosterVersion = String(hash(roster.map((member) => [
    member.id,
    member.familyId,
    member.name,
    member.role,
    member.group,
    member.squad,
    member.sourceGroup,
    member.eagleQualified ? "1" : "0",
  ].join(":")).join("|")));
  if (saved.rosterVersion === rosterVersion) return false;

  const guests = (saved.members || []).filter((member) => member.isGuest);
  saved.members = [...roster, ...guests];
  saved.rosterVersion = rosterVersion;
  return true;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildEvents() {
  return Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: number,
      date: "",
      name: `${index + 8 <= 12 ? index + 8 : index - 4}月團集會`,
      eagleSplit: number === "02",
      preOpen: true,
      onsiteOpen: true,
    };
  });
}

function buildMembers() {
  if (Array.isArray(window.PEOPLE_DATA) && window.PEOPLE_DATA.length) {
    return window.PEOPLE_DATA
      .filter((member) => member.enabled !== false)
      .filter((member) => normalize(member.squad) && normalize(member.sourceSquad))
      .map((member) => ({
        id: member.id,
        familyId: normalize(member.familyId),
        name: normalize(member.name),
        role: member.role === "成人" ? "成人" : member.role === "孩子" ? "孩子" : member.role,
        group: normalize(member.group),
        squad: normalizeSquad(member.squad) || "未分隊",
        sourceGroup: normalize(member.sourceGroup),
        sourceSquad: normalize(member.sourceSquad),
        sourceAttribute: normalize(member.sourceAttribute),
        eagleQualified: Boolean(member.eagleQualified),
      }));
  }
  const source = Array.isArray(window.ACTIVITY_FEE_DATA) ? window.ACTIVITY_FEE_DATA : [];
  const members = [];
  source.forEach((row, index) => {
    if (row.childName) {
      const group = normalizeGroup(row.childGroup);
      members.push({
        id: `child-${row.row || index}`,
        familyId: normalize(row.familyId),
        name: normalize(row.childName),
        role: "孩子",
        group,
        squad: inferSquad(group, row.childName, index),
        sourceGroup: normalize(row.childGroup),
        sourceSquad: "",
        eagleQualified: false,
      });
    }
    if (row.adultName) {
      members.push({
        id: `adult-${row.row || index}`,
        familyId: normalize(row.familyId),
        name: normalize(row.adultName),
        role: "成人",
        group: "育成會",
        squad: inferAdultSquad(row.adultName, index),
        sourceGroup: normalize(row.childGroup) || "育成會",
        sourceSquad: "",
        eagleQualified: String(row.childGroup || row.adultFee || row.extraName || "").includes("鷹"),
      });
    }
  });
  if (members.length) return dedupeMembers(members);
  return [
    { id: "demo-child-1", familyId: "123", name: "小蟻示範", role: "孩子", group: "小蟻", squad: "小黑蟻", eagleQualified: false },
    { id: "demo-child-2", familyId: "123", name: "奔鹿示範", role: "孩子", group: "奔鹿", squad: "高地鹿", eagleQualified: false },
    { id: "demo-adult-1", familyId: "123", name: "育成示範", role: "成人", group: "育成會", squad: "花叢", eagleQualified: true },
  ];
}

function dedupeMembers(members) {
  const seen = new Set();
  return members.filter((member) => {
    const key = `${member.familyId}|${member.name}|${member.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(member.familyId && member.name);
  });
}

function normalizeGroup(value) {
  const text = normalize(value);
  if (text.includes("小蟻")) return "小蟻";
  if (text.includes("炫蜂")) return "炫蜂";
  if (text.includes("奔鹿")) return "奔鹿";
  if (text.includes("翔鷹") || text.includes("鷹")) return "翔鷹";
  return "小蟻";
}

function inferSquad(group, seed, index) {
  const options = SQUADS[group] || ["未分隊"];
  return options[Math.abs(hash(`${seed}-${index}`)) % options.length];
}

function inferAdultSquad(seed, index) {
  const options = SQUADS["育成會"];
  return options[Math.abs(hash(`${seed}-${index}`)) % options.length];
}

function hash(text) {
  return String(text).split("").reduce((sum, char) => ((sum << 5) - sum) + char.charCodeAt(0), 0);
}

function currentEvent() {
  return state.events.find((event) => event.id === state.currentEventId) || state.events[0];
}

function hasMorning(record) {
  return attendancePeriods(record).am;
}

function hasAfternoon(record) {
  return attendancePeriods(record).pm;
}

function attendancePeriods(record) {
  const status = normalizePartialLeaveStatus(record.status);
  if (["出席", "全天出席", "遲到"].includes(status)) return { am: true, pm: true };
  if (isAfternoonLeave(status)) return { am: true, pm: false };
  if (isMorningLeave(status)) return { am: false, pm: true };
  if (!status || ["未確認", "未到", "請假"].includes(status)) return { am: false, pm: false };
  return { am: Boolean(record.am), pm: Boolean(record.pm) };
}

function syncRecordPeriodFlags(record) {
  const periods = attendancePeriods(record);
  if (record.am === periods.am && record.pm === periods.pm) return false;
  record.am = periods.am;
  record.pm = periods.pm;
  return true;
}

function isMorningLeave(status) {
  return status === "上午請假" || status === "下午出席";
}

function isAfternoonLeave(status) {
  return status === "下午請假" || status === "上午出席";
}

function normalizePartialLeaveStatus(status) {
  if (status === "上午出席") return "下午請假";
  if (status === "下午出席") return "上午請假";
  return status;
}

function isChild(member) {
  return member.role === "孩子";
}

function isAnnualChild(member) {
  return isChild(member) && member.group !== "未在團";
}

function isAdult(member) {
  return member.role !== "孩子";
}

function displayRole(member) {
  if (member.sourceAttribute?.includes("家長")) return "家長";
  if (member.sourceAttribute?.includes("小孩")) return "小孩";
  return member.role;
}

function isEagleSoloRoute(route) {
  return route === EAGLE_SOLO_ROUTE || route === "育成鷹團活動" || route === "單飛活動";
}

function entranceLabel(key) {
  return ENTRANCES.find((entry) => entry.key === key)?.label || `${key}點名`;
}

function checkinActions(member) {
  if (isAdult(member) && currentEvent().eagleSplit && member.eagleQualified) return ADULT_CHECKIN_STATUSES;
  return CHILD_STATUSES;
}

function checkinSort(a, b) {
  if (resolveCheckinSquad(a) === "育苗小藍隊" && resolveCheckinSquad(b) === "育苗小藍隊") {
    return String(a.familyId).localeCompare(String(b.familyId), "zh-Hant", { numeric: true })
      || familyAdultFirstSort(a, b)
      || a.name.localeCompare(b.name, "zh-Hant");
  }
  return resolveCheckinSquad(a).localeCompare(resolveCheckinSquad(b), "zh-Hant")
    || roleSort(a, b)
    || memberSort(a, b);
}

function formatWorkAssignment(record) {
  return [normalize(record.workGroup), normalize(record.workRole)].filter(Boolean).join("｜");
}

function roleSort(a, b) {
  return (isChild(a) ? 0 : 1) - (isChild(b) ? 0 : 1);
}

function familyConfirmSort(a, b) {
  return familyAdultFirstSort(a, b)
    || memberSort(a, b);
}

function familyAdultFirstSort(a, b) {
  return (isAdult(a) ? 0 : 1) - (isAdult(b) ? 0 : 1);
}

function memberSort(a, b) {
  return String(a.familyId).localeCompare(String(b.familyId), "zh-Hant", { numeric: true })
    || a.group.localeCompare(b.group, "zh-Hant")
    || a.name.localeCompare(b.name, "zh-Hant");
}

function groupBy(items, getter) {
  return items.reduce((groups, item) => {
    const key = getter(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function normalize(value) {
  return String(value || "").trim();
}

function normalizeSquad(value) {
  const text = normalize(value);
  const aliases = {
    "花叢-": "花叢",
    "天空-": "天空",
    "草原-": "草原",
    "大地-": "大地",
  };
  return aliases[text] || text;
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function syncStatusText(item) {
  if (!normalize(scriptUrl.value)) return "尚未送後端：未設定 Apps Script URL";
  if (item?.syncStatus === "sent") return "已送後端";
  if (item?.syncStatus === "pending") return "同步後端中";
  if (item?.syncStatus === "failed") return "尚未送後端：請重新送出或洽點名人員";
  return "尚未送後端";
}
