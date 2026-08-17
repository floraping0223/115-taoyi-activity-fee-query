# 115桃一親子團全年出勤管理系統

這是一套給桃一親子團全年 12 次團集會使用的手機點名系統。

## 已完成內容

- 家庭會前確認
- 四團孩子預計出席名單
- 育成會預計出席與工作分配
- 育成鷹團分流預計出席與工作分配
- 小蟻、炫蜂、奔鹿、翔鷹、育成會固定點名入口
- 分流場次新增育成鷹團點名入口
- 育成上午/下午13:00實到紀錄
- 家庭成人陪同即時異常判斷
- 孩子全年 12 場缺席累計與出席率
- 出勤規則可調整
- Google Sheets 匯入範本與 Apps Script 同步後端

## 主要檔案

- `index.html`：手機前台。
- `styles.css`：介面樣式。
- `app.js`：前台流程、分流、點名、統計、同步。
- `data.js`：由 `115點名名單.xlsx` 匯入的人員資料。
- `google-apps-script.gs`：Google 試算表同步後端。
- `outputs/115桃一親子團全年出勤管理系統範本.xlsx`：可匯入 Google Sheets 的範本。
- `outputs/欄位對照與待補資料.md`：原始 Excel 欄位對照。
- `outputs/待補資料.csv`：待補/疑問資料。
- `規格逐點驗收.md`：1-23 點逐項驗收結果。
- `run_acceptance_tests.mjs`：自動驗收測試。

## 本機使用

直接開啟 `index.html` 即可操作。

本機資料存在瀏覽器 localStorage。正式使用時，請部署 `google-apps-script.gs`，再把 Web App URL 貼到頁面上方的 Apps Script URL 欄位，按「同步 Google」寫入試算表。

## 重新匯入名冊

原始檔位置：

`C:\Users\USER\Desktop\115點名名單.xlsx`

重新匯入時執行：

`import_roster_from_excel.py`

匯入後會更新：

- `data.js`
- `outputs/欄位對照與待補資料.md`
- `outputs/待補資料.csv`

## 驗收

已執行 `run_acceptance_tests.mjs`，16 項核心情境全部通過。
