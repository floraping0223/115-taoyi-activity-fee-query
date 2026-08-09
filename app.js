const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMS-IvWMreIMCc9T3kwHQzEnjOKDCeg5GzL6RUF4ob-_1UMuzNNYhNS-r34O8qqJ6HMg/exec";
const DUPLICATE_MESSAGE = "此家庭已重複輸入，請確認後再輸入，如有疑問請洽明鏡。";

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
    td.textContent = "-";
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
  payload.familyId = normalizeFamilyId(payload.familyId);
  payload.lastFive = document.querySelector("#lastFive").value.trim();
  payload.transferLastFive = payload.lastFive;
  payload.last5 = payload.lastFive;
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
    const result = await submitReport(payload);

    if (result.duplicate) {
      reportStatus.textContent = DUPLICATE_MESSAGE;
      reportStatus.className = "report-status warn";
      return;
    }

    reportStatus.textContent = "已送出回報，請至 Google 試算表重新整理確認。";
    reportStatus.className = "report-status ok";
    reportForm.reset();
    transferDate.value = `${yyyy}-${mm}-${dd}`;
    reportFamilyId.value = payload.familyId;
    transferAmount.value = currentExpectedAmount;
  } catch (error) {
    reportStatus.textContent = "送出失敗，請稍後再試。";
    reportStatus.className = "report-status warn";
  } finally {
    submitButton.disabled = false;
  }
});

function submitReport(payload) {
  return new Promise((resolve) => {
    const callbackName = `activityFeeReport_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(GOOGLE_APPS_SCRIPT_URL);
    url.searchParams.set("action", "report");
    url.searchParams.set("callback", callbackName);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const fallback = async () => {
      cleanup();
      const fallbackUrl = new URL(GOOGLE_APPS_SCRIPT_URL);
      Object.entries(payload).forEach(([key, value]) => fallbackUrl.searchParams.set(key, value));
      await submitInBackground(fallbackUrl.toString());
      resolve({ ok: true, duplicate: false, fallback: true });
    };

    const timeout = setTimeout(fallback, 6000);

    window[callbackName] = (result) => {
      clearTimeout(timeout);
      cleanup();
      resolve(result || { ok: true, duplicate: false });
    };

    script.onerror = () => {
      clearTimeout(timeout);
      fallback();
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function submitInBackground(url) {
  const separator = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${separator}_=${Date.now()}`;

  try {
    await fetch(finalUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
    });
  } catch (error) {
    await submitWithImage(finalUrl);
  }
}

function submitWithImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = url;
    setTimeout(resolve, 3000);
  });
}

async function lookupFamily(familyId) {
  if (window.ACTIVITY_FEE_ENCRYPTED_DATA) {
    return lookupEncryptedFamily(familyId);
  }

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

async function lookupEncryptedFamily(familyId) {
  const normalizedFamilyId = normalizeFamilyId(familyId);
  const lookupId = await sha256Hex(`115-taoyi-activity-fee-lookup:${normalizedFamilyId}`);
  const entry = window.ACTIVITY_FEE_ENCRYPTED_DATA.find((item) => item.id === lookupId);

  if (!entry) {
    return { ok: true, familyId: normalizedFamilyId, rows: [], total: 0 };
  }

  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`115-taoyi-activity-fee-key:${normalizedFamilyId}`)
  );
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(entry.iv) },
    cryptoKey,
    base64ToBytes(entry.data)
  );
  const payload = JSON.parse(new TextDecoder().decode(decrypted));
  const rows = payload.rows || [];

  return {
    ok: true,
    familyId: normalizedFamilyId,
    rows,
    total: calculateTotal(rows),
  };
}

function calculateTotal(rows) {
  return rows.reduce((sum, row) => {
    let next = sum;
    if (row.childName) next += 2400;
    if (row.adultFee) next += 500;
    if (row.extraFee) next += 350;
    return next;
  }, 0);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
