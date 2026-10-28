const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const reviewHeaders=['家庭編號','填表人／回覆狀態','審核狀態','原活動費','原入團費','原家庭年費','原帳位費','原預估總額','核定活動費','核定入團費','核定家庭年費','核定帳位費','核定應繳總額','公開調整說明','目前收件編號','已核對收件編號','內部審核備註','核定調整差額','公開檢查'];
function setup(changes={}){
 const source=[['家庭編號','應繳總額','收件編號'],[16,1950,'receipt-current']];
 const review=[reviewHeaders,[16,'明鏡','已確認',950,0,1000,0,1950,950,0,1000,0,1950,'','receipt-current','receipt-current','內部秘密',0,'可查詢']];
 if(changes.review)Object.entries(changes.review).forEach(([k,v])=>review[1][reviewHeaders.indexOf(k)]=v);
 const reports=[['回報時間','家庭編號','匯款日期','實際匯款金額','轉帳後五碼','核定應繳總額','對應收件編號','核定版本','回報編號','對帳狀態']];
 const grids={'家庭總表':source,'宿營收費審核':review,'成員明細':[['收件編號','家庭編號','自然名','收費身分','出席方式','不用晚餐','不用早餐','不住宿','到校／離校備註','活動費','入團費','個人小計','本人分團'],['receipt-current',16,'明鏡','成人','正常出席','否','否','否','',450,0,450,'育成會']],'宿營匯款回報':reports};
 const c={console,SpreadsheetApp:{openById:()=>({getSheetByName:name=>({getDataRange:()=>({getValues:()=>grids[name],getDisplayValues:()=>grids[name].map(r=>r.map(v=>v==null?'':String(v)))}),appendRow:r=>grids[name].push(r)})}),flush(){}},Utilities:{DigestAlgorithm:{SHA_256:1},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],formatDate:()=> '2026-10-29'},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},HtmlService:{XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this}})}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('camp-payment-backend.gs','utf8'),c);return{c,reports,review};
}
let t=setup(),r=t.c.paymentLookup_('16');assert.equal(r.state,'approved');assert.equal(r.total,1950);assert.equal(r.bank.account,'111003642280');assert(!JSON.stringify(r).includes('內部秘密'));
for(const change of [{'審核狀態':'待審核'},{'已核對收件編號':'old'},{'核定活動費':''},{'核定活動費':'950'},{'核定活動費':-1},{'核定活動費':900}]){const x=setup({review:change}).c.paymentLookup_('16');assert.equal(x.state,'pending');assert.equal(x.bank,undefined);assert.equal(x.total,undefined);}
assert.equal(t.c.paymentLookup_('45').state,'not_submitted');
t=setup({review:{'核定活動費':900,'公開調整說明':'已確認不用早餐'}});assert.equal(t.c.paymentLookup_('16').total,1900);
t=setup();r=t.c.paymentLookup_('16');const payload={requestId:'report-test-001',action:'report',familyId:'16',version:r.version,date:'2026-10-29',amount:1950,lastFive:'00123'};
const call=p=>t.c.doPost({parameter:{payload:JSON.stringify(p)}}).html;
assert(call({...payload,version:'old'}).includes('核定金額已更新'));assert.equal(t.reports.length,1);
assert(call({...payload,lastFive:'123'}).includes('請填寫轉帳後五碼'));assert.equal(t.reports.length,1);
assert(call({...payload,date:'2026-02-30'}).includes('匯款日期不正確'));assert.equal(t.reports.length,1);
assert(call(payload).includes('"ok":true'));assert.equal(t.reports.length,2);assert.equal(t.reports[1][4],"'00123");
assert(call(payload).includes('"alreadyReported":true'));assert.equal(t.reports.length,2);
assert(call({...payload,requestId:'report-test-002'}).includes('"alreadyReported":true'));assert.equal(t.reports.length,2);
t=setup({review:{'核定活動費':0,'核定入團費':0,'核定家庭年費':0,'核定帳位費':0,'公開調整說明':'核定免收'}});assert.equal(t.c.paymentLookup_('16').total,0);
console.log('通過：審核閘門、金額完整性、收件版本核對、調整說明、未填家庭、匯款回報、重試防重複、後五碼前導0、核定0元。未操作真實資料。');
