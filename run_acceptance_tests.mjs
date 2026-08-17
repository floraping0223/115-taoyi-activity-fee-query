import { chromium } from "playwright";

const url = "file:///C:/Users/USER/Documents/528/index.html";
const storageKey = "taoyi-115-attendance-ui-v1";

function events() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1).padStart(2, "0"),
    date: "",
    name: `測試場${i + 1}`,
    eagleSplit: i === 0,
    preOpen: true,
    onsiteOpen: true,
  }));
}

function person(id, familyId, name, role, group, squad, eagleQualified = false, sourceGroup = group) {
  return { id, familyId, name, role, group, squad, sourceGroup, sourceSquad: squad, eagleQualified };
}

async function makePage(seed) {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [storageKey, seed]);
  await page.goto(url);
  return { browser, page, errors };
}

async function clickCard(page, name, buttonName) {
  await page.locator(".person-card").filter({ hasText: name }).getByRole("button", { name: buttonName, exact: true }).click();
}

async function run() {
  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }

  await test("1大人+1孩子全天到正常", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a1", "1", "大人", "成人", "育成會", "花叢"),
      person("c1", "1", "孩子", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "出席");
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "大人", "出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("目前沒有")) throw new Error(text);
  });

  await test("1大人+3孩子全天到全部正常", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a1", "2", "媽媽", "成人", "育成會", "天空"),
      person("c1", "2", "小蟻孩", "孩子", "小蟻", "小黃蟻"),
      person("c2", "2", "蜂孩", "孩子", "炫蜂", "泥壺蜂"),
      person("c3", "2", "鹿孩", "孩子", "奔鹿", "高地鹿"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    for (const [entry, child] of [["小蟻", "小蟻孩"], ["炫蜂", "蜂孩"], ["奔鹿", "鹿孩"]]) {
      await page.getByRole("button", { name: "現場點名" }).click();
      await page.getByRole("button", { name: new RegExp(`${entry}點名`) }).click();
      await clickCard(page, child, "出席");
    }
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "媽媽", "出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("目前沒有")) throw new Error(text);
  });

  await test("孩子到大人沒到立即異常", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a1", "3", "爸爸", "成人", "育成會", "大地"),
      person("c1", "3", "孩子", "孩子", "小蟻", "小紅蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("家庭 3")) throw new Error(text);
  });

  await test("大人到孩子沒到孩子計缺席", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a1", "4", "爸爸", "成人", "育成會", "大地"),
      person("c1", "4", "孩子", "孩子", "小蟻", "小紅蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "爸爸", "出席");
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "未到");
    await page.getByRole("button", { name: "全年總表" }).click();
    const text = await page.locator("#annualList").textContent();
    await browser.close();
    if (!text.includes("缺席 1")) throw new Error(text);
  });

  await test("上午成人到下午離開產生下午異常", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a1", "5", "媽媽", "成人", "育成會", "花叢"),
      person("c1", "5", "孩子", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "出席");
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "媽媽", "上午出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("下午")) throw new Error(text);
  });

  await test("孩子遲到缺席值0.5", async () => {
    const seed = { currentEventId: "01", events: events(), members: [person("c1", "6", "孩子", "孩子", "小蟻", "小黑蟻")], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await clickCard(page, "孩子", "遲到");
    await page.getByRole("button", { name: "全年總表" }).click();
    const text = await page.locator("#annualList").textContent();
    await browser.close();
    if (!text.includes("缺席 0.5")) throw new Error(text);
  });

  await test("臨時出席可新增", async () => {
    const seed = { currentEventId: "01", events: events(), members: [], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.fill('input[name="familyId"]', "7");
    await page.fill('input[name="name"]', "臨時孩");
    await page.getByRole("button", { name: "加入本場點名" }).click();
    const text = await page.locator("#checkinList").textContent();
    await browser.close();
    if (!text.includes("臨時孩")) throw new Error(text);
  });

  await test("12場歷史不覆蓋", async () => {
    const seed = { currentEventId: "01", events: events(), members: [person("c1", "8", "孩子", "孩子", "小蟻", "小黑蟻")], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await clickCard(page, "孩子", "遲到");
    await page.selectOption("#eventSelect", "12");
    await page.getByRole("button", { name: "現場點名" }).click();
    await clickCard(page, "孩子", "未到");
    await page.getByRole("button", { name: "全年總表" }).click();
    const text = await page.locator("#annualList").textContent();
    await browser.close();
    if (!text.includes("缺席 1.5")) throw new Error(text);
  });

  await test("育成鷹分流與下一場恢復", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a", "9", "A成人", "成人", "育成會", "花叢", true, "育成會鷹"),
      person("b", "9", "B成人", "成人", "育成會", "天空", true, "育成會鷹鹿"),
      person("c", "9", "C成人", "成人", "育成會", "大地", false, "育成會鹿"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "9");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "A成人", "育成鷹團活動");
    await clickCard(page, "B成人", "育成鷹團活動");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /育成會點名/ }).click();
    const nursery = await page.locator("#checkinList").textContent();
    await page.getByRole("button", { name: /育成鷹團點名/ }).click();
    const split = await page.locator("#checkinList").textContent();
    await page.selectOption("#eventSelect", "02");
    await page.getByRole("button", { name: /育成會點名/ }).click();
    const next = await page.locator("#checkinList").textContent();
    await browser.close();
    if (nursery.includes("A成人") || nursery.includes("B成人") || !nursery.includes("C成人")) throw new Error("nursery split failed");
    if (!split.includes("A成人") || !split.includes("B成人") || split.includes("C成人")) throw new Error("split list failed");
    if (!next.includes("A成人") || !next.includes("B成人")) throw new Error("next event restore failed");
  });

  await test("不同場地成人仍可陪同", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("a", "10", "媽媽", "成人", "育成會", "花叢", true, "育成會鷹"),
      person("c", "10", "孩子", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "10");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "媽媽", "育成鷹團活動");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "下午出席");
    await page.getByRole("button", { name: /育成鷹團點名/ }).click();
    await clickCard(page, "媽媽", "下午出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("目前沒有")) throw new Error(text);
  });

  await test("同家庭兩成人不同時段仍可陪同", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("dad", "11", "爸爸", "成人", "育成會", "花叢", true, "育成會鷹"),
      person("mom", "11", "媽媽", "成人", "育成會", "天空", true, "育成會鷹"),
      person("kid", "11", "孩子", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "11");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "爸爸", "育成鷹團活動");
    await clickCard(page, "媽媽", "母團活動");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "出席");
    await page.getByRole("button", { name: /育成鷹團點名/ }).click();
    await clickCard(page, "爸爸", "上午出席");
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "媽媽", "下午出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("目前沒有")) throw new Error(text);
  });

  await test("3名孩子分屬三團媽媽在育成仍成立", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("mom", "12", "媽媽", "成人", "育成會", "花叢"),
      person("ant", "12", "小蟻孩", "孩子", "小蟻", "小黑蟻"),
      person("bee", "12", "炫蜂孩", "孩子", "炫蜂", "虎頭蜂"),
      person("deer", "12", "奔鹿孩", "孩子", "奔鹿", "森林鹿"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    for (const [entry, child] of [["小蟻", "小蟻孩"], ["炫蜂", "炫蜂孩"], ["奔鹿", "奔鹿孩"]]) {
      await page.getByRole("button", { name: "現場點名" }).click();
      await page.getByRole("button", { name: new RegExp(`${entry}點名`) }).click();
      await clickCard(page, child, "出席");
    }
    await page.getByRole("button", { name: /育成會點名/ }).click();
    await clickCard(page, "媽媽", "出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("目前沒有")) throw new Error(text);
  });

  await test("育成鷹成人分流但未到仍產生異常", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("mom", "13", "媽媽", "成人", "育成會", "花叢", true, "育成會鷹"),
      person("kid", "13", "孩子", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "13");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "媽媽", "育成鷹團活動");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /小蟻點名/ }).click();
    await clickCard(page, "孩子", "下午出席");
    await page.getByRole("button", { name: "總覽" }).click();
    const text = await page.locator("#familyAlerts").textContent();
    await browser.close();
    if (!text.includes("家庭 13")) throw new Error(text);
  });

  await test("同家庭兩位育成鷹分開活動不互相覆蓋", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("dad", "14", "爸爸", "成人", "育成會", "花叢", true, "育成會鷹"),
      person("mom", "14", "媽媽", "成人", "育成會", "天空", true, "育成會鷹"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "14");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "爸爸", "育成鷹團活動");
    await clickCard(page, "媽媽", "母團活動");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /育成會點名/ }).click();
    const nursery = await page.locator("#checkinList").textContent();
    await page.getByRole("button", { name: /育成鷹團點名/ }).click();
    const split = await page.locator("#checkinList").textContent();
    await browser.close();
    if (!nursery.includes("媽媽") || nursery.includes("爸爸")) throw new Error("母團名單錯誤");
    if (!split.includes("爸爸") || split.includes("媽媽")) throw new Error("分流名單錯誤");
  });

  await test("下一年度升團換小隊只改基本資料即可", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("kid", "15", "孩子", "孩子", "翔鷹", "鷹團"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.getByRole("button", { name: /翔鷹點名/ }).click();
    const text = await page.locator("#checkinList").textContent();
    await browser.close();
    if (!text.includes("孩子")) throw new Error(text);
  });

  await test("會前請假但現場可用臨時出席補登", async () => {
    const seed = { currentEventId: "01", events: events(), members: [
      person("kid", "16", "請假孩", "孩子", "小蟻", "小黑蟻"),
    ], records: {}, rules: defaultRules() };
    const { browser, page } = await makePage(seed);
    await page.getByRole("button", { name: "家庭確認" }).click();
    await page.fill("#familySearch", "16");
    await page.getByRole("button", { name: "載入家庭" }).click();
    await clickCard(page, "請假孩", "請假");
    await page.getByRole("button", { name: "現場點名" }).click();
    await page.fill('input[name="familyId"]', "16");
    await page.fill('input[name="name"]', "請假孩");
    await page.getByRole("button", { name: "加入本場點名" }).click();
    const text = await page.locator("#checkinList").textContent();
    await browser.close();
    if (!text.includes("請假孩")) throw new Error(text);
  });

  return results;
}

function defaultRules() {
  return { "出席": 0, "全天出席": 0, "遲到": 0.5, "上午出席": 0.5, "下午出席": 0.5, "未到": 1, "請假": 1 };
}

const results = await run();
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
