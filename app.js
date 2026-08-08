const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMS-IvWMreIMCc9T3kwHQzEnjOKDCeg5GzL6RUF4ob-_1UMuzNNYhNS-r34O8qqJ6HMg/exec";

const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");

const lookupForm = document.querySelector("#lookupForm");
const reportForm = document.querySelector("#reportForm");
const message = document.querySelector("#message");
const resultPanel = document.querySelector("#resultPanel");
const resultFamilyId = document.querySelector("#resultFamilyId");
const totalAmount = document.querySelector("#totalAmount");
const resultRows = document.querySelector("#resultRows");
const reportFamilyId = document.querySelector("#reportFamilyId");
const transferDate = document.querySelector("#transferDate");
const transferAmount = document.querySelector("#transferAmount");
const reportStatus = document.querySelector("#reportStatus");
let currentExpectedAmount = 0;

transferDate.value = `${yyyy}-${mm}-${dd}`;

function normalizeFamilyId(value) {
  return String(value || "").trim().replace(/^0+(\d)/, "$1");
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = "";
  message.hidden = true;
}

function cell(value) {
  const td = document.createElement("td");
  if (value) {
    td.textContent = value;
  } else {
    td.textContent = "－";
    td.className = "empty-cell";
  }
  return td;
}

function renderRows(rows) {
  resultRows.replaceChildren();
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.append(
      cell(row.childGroup),
      cell(row.childName),
      cell(row.adultName),
      cell(row.adultFee),
      cell(row.extraName),
      cell(row.extraFee)
    );
    resultRows.appendChild(tr);
  });
}

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  reportStatus.textContent = "";
  reportStatus.className = "report-status";

  const familyId = normalizeFamilyId(new FormData(lookupForm).get("familyId"));
  const lookupButton = lookupForm.querySelector("button");
  lookupButton.disabled = true;
  lookupButton.textContent = "查詢中";

  try {
    const result = await lookupFamily(familyId);
    const rows = result.rows || [];

    if (!rows.length) {
      resultPanel.hidden = true;
      showMessage(`查無家庭編號 ${familyId} 的資料，請確認輸入是否正確。`);
      return;
    }

    const total = Number(result.total || 0);
    currentExpectedAmount = total;
    resultFamilyId.textContent = familyId;
    totalAmount.textContent = currencyFormatter.format(total);
    reportFamilyId.value = familyId;
    transferAmount.value = total;
    renderRows(rows);
    resultPanel.hidden = false;
  } catch (error) {
    resultPanel.hidden = true;
    showMessage("查詢暫時失敗，請稍後再試。");
  } finally {
    lookupButton.disabled = false;
    lookupButton.textContent = "查詢";
  }
});

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = reportForm.querySelector("button");
  const payload = Object.fromEntries(new FormData(reportForm).entries());
  payload.expectedAmount = String(currentExpectedAmount);
  payload.submittedAt = new Date().toISOString();

  if (!/^\d{5}$/.test(payload.lastFive)) {
    reportStatus.textContent = "轉帳後五碼請輸入 5 位數字。";
    reportStatus.className = "report-status warn";
    return;
  }

  submitButton.disabled = true;
  reportStatus.textContent = "正在送出回報...";
  reportStatus.className = "report-status";

  try {
    if (!GOOGLE_APPS_SCRIPT_URL) {
      const savedReports = JSON.parse(localStorage.getItem("activityFeeReports") || "[]");
      savedReports.push(payload);
      localStorage.setItem("activityFeeReports", JSON.stringify(savedReports));
      reportStatus.textContent = "已暫存在此瀏覽器。設定 Google Apps Script 網址後即可直接寫入 Google 試算表。";
      reportStatus.className = "report-status warn";
      return;
    }

    const url = new URL(GOOGLE_APPS_SCRIPT_URL);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
    await submitWithHiddenFrame(url.toString());
    reportStatus.textContent = "已送出回報至 Google 試算表。";
    reportStatus.className = "report-status ok";
    reportForm.reset();
    transferDate.value = `${yyyy}-${mm}-${dd}`;
    reportFamilyId.value = payload.familyId;
    transferAmount.value = currentExpectedAmount;
  } catch (error) {
    reportStatus.textContent = "送出失敗，請稍後再試或確認 Google Apps Script 網址。";
    reportStatus.className = "report-status warn";
  } finally {
    submitButton.disabled = false;
  }
});

function submitWithHiddenFrame(url) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.name = `google-sheet-submit-${Date.now()}`;
    iframe.hidden = true;
    iframe.src = url;
    iframe.addEventListener("load", () => {
      setTimeout(() => iframe.remove(), 1000);
      resolve();
    }, { once: true });
    document.body.appendChild(iframe);
    setTimeout(resolve, 2500);
  });
}

function lookupFamily(familyId) {
  return new Promise((resolve, reject) => {
    const callbackName = `activityFeeLookup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(GOOGLE_APPS_SCRIPT_URL);
    url.searchParams.set("action", "lookup");
    url.searchParams.set("familyId", familyId);
    url.searchParams.set("callback", callbackName);

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Lookup timed out"));
    }, 10000);

    window[callbackName] = (payload) => {
      clearTimeout(timeout);
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Lookup failed"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}
