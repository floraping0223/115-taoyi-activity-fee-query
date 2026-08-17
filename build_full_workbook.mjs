import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs");
const outputPath = path.join(outputDir, "115桃一親子團全年出勤管理系統範本.xlsx");

const colors = {
  header: "#24435C",
  subHeader: "#22706D",
  lightBlue: "#E8F2F7",
  lightGreen: "#E8F5EE",
  lightAmber: "#FFF1D6",
  lightRed: "#FDE8E6",
  line: "#D9E0EA",
};

const dataJs = await fs.readFile("data.js", "utf8");
const dataContext = { window: {} };
vm.createContext(dataContext);
vm.runInContext(dataJs, dataContext);
const people = dataContext.window.PEOPLE_DATA || [];
const children = people.filter((person) => person.role === "孩子" && person.group !== "未在團");
const missingCsv = await fs.readFile(path.join(outputDir, "待補資料.csv"), "utf8").catch(() => "");
const missingRows = parseCsv(missingCsv).slice(1).map((row) => [
  "待補/疑問",
  row[1] || "",
  row[2] || "",
  row[3] || "",
  row[4] || "",
  "待確認",
]);

const sheets = [
  {
    name: "人員基本資料",
    headers: ["人員ID", "家庭編號", "自然名", "屬性", "分團", "小隊", "所屬分團", "育成鷹資格", "啟用", "備註"],
    rows: people.map((person) => [
      person.id,
      person.familyId,
      person.name,
      person.role,
      person.group,
      person.squad,
      person.sourceGroup || "",
      person.eagleQualified ? "是" : "否",
      person.enabled === false ? "否" : "是",
      "",
    ]),
  },
  {
    name: "活動設定",
    headers: ["場次", "活動日期", "活動名稱", "會前確認開放", "現場點名開放", "育成鷹團分流", "狀態", "備註"],
    rows: Array.from({ length: 12 }, (_, index) => {
      const id = String(index + 1).padStart(2, "0");
      return [id, "", `${index + 8 <= 12 ? index + 8 : index - 4}月團集會`, index === 0 ? "是" : "否", index === 0 ? "是" : "否", "否", index === 0 ? "開放" : "尚未開放", ""];
    }),
  },
  {
    name: "會前回覆紀錄",
    headers: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "預計時段", "活動去向", "請假事由", "回覆時間"],
    rows: [],
  },
  {
    name: "現場點名紀錄",
    headers: ["場次", "人員ID", "家庭編號", "自然名", "屬性", "主要點名群組", "小隊", "現場狀態", "上午實到", "下午13:00實到", "遲到", "臨時出席", "備註", "點名人員", "更新時間"],
    rows: [],
  },
  {
    name: "分流設定",
    headers: ["場次", "分流名稱", "啟用", "資格規則", "主要點名群組", "備註"],
    rows: [["01", "老鷹單飛活動", "否", "成人屬育成會且所屬分團包含「鷹」", "育成鷹團", "依個人會前選擇分流；翔鷹團團隊留在翔鷹點名"]],
  },
  {
    name: "工作分配",
    headers: ["場次", "人員ID", "家庭編號", "自然名", "主要點名群組", "小隊", "預計時段", "支援團隊", "職務註記", "工作分配", "備註"],
    rows: [],
  },
  {
    name: "出勤規則",
    headers: ["狀態", "缺席權重", "適用對象", "備註"],
    rows: [
      ["出席", 0, "小孩", "正常全天"],
      ["遲到", 0.5, "小孩", ""],
      ["上午請假", 0.5, "小孩", "上午未到，下午實到"],
      ["下午請假", 0.5, "小孩", "上午實到，下午未到"],
      ["未到", 1, "小孩", "全天缺席"],
      ["請假", 1, "小孩", "可由管理者調整"],
    ],
  },
  {
    name: "當日總覽",
    headers: ["場次", "群組", "小隊", "預計出席", "上午實到", "下午實到", "遲到", "未到", "親子陪同異常"],
    rows: [["01", "小蟻", "小黑蟻", 0, 0, 0, 0, 0, 0]],
  },
  {
    name: "全年總表",
    headers: ["人員ID", "家庭編號", "自然名", "分團", "小隊", ...Array.from({ length: 12 }, (_, index) => `場次${String(index + 1).padStart(2, "0")}`), "正常", "遲到", "上午", "下午", "全天缺席", "累計缺席", "出席率"],
    rows: children.map((person) => [
      person.id,
      person.familyId,
      person.name,
      person.group,
      person.squad,
      ...Array(12).fill(""),
      0,
      0,
      0,
      0,
      0,
      0,
      "",
    ]),
  },
  {
    name: "欄位對照",
    headers: ["原始Excel欄位", "系統欄位", "處理方式", "備註"],
    rows: [
      ["家庭編號", "家庭編號", "直接匯入", "家庭串聯 Key"],
      ["自然名", "自然名", "直接匯入", ""],
      ["屬性（家長/小孩）", "屬性", "直接匯入/正規化", "成人、小孩"],
      ["所屬分團", "所屬分團", "直接匯入", "包含鷹則可選老鷹單飛活動"],
      ["所屬小隊", "小隊", "直接匯入", ""],
    ],
  },
  {
    name: "待補資料",
    headers: ["資料類型", "家庭編號", "自然名", "缺少欄位", "影響", "處理狀態"],
    rows: missingRows,
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const workbook = Workbook.create();
for (const spec of sheets) {
  const sheet = workbook.worksheets.add(spec.name);
  sheet.showGridLines = false;
  const data = [spec.headers, ...spec.rows];
  const range = sheet.getRangeByIndexes(0, 0, data.length, spec.headers.length);
  range.values = data;
  const header = sheet.getRangeByIndexes(0, 0, 1, spec.headers.length);
  header.format = {
    fill: colors.header,
    font: { bold: true, color: "#FFFFFF" },
  };
  range.format.borders = { preset: "inside", style: "thin", color: colors.line };
  sheet.freezePanes.freezeRows(1);
}

for (const sheetName of ["會前回覆紀錄", "現場點名紀錄", "工作分配"]) {
  workbook.worksheets.getItem(sheetName).getRange("A1:Z1").format.fill = colors.subHeader;
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const inspect = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 4000,
  tableMaxRows: 4,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);
console.log(outputPath);
