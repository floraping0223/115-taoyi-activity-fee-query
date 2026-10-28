// 貼到新試算表的「擴充功能 → Apps Script」，以網頁應用程式部署。
const SPREADSHEET_ID = '1KyD86bPLGgzlNSrtfjPw7tW2E4I2bdqe8dkM-7seGD0';
const UPLOAD_FOLDER_ID = '1yDYz3V15ZBeIo_qDwCpEGvpVb1WEo-Ol';
const WEBSITE_ORIGIN = 'https://floraping0223.github.io';
function cleanText_(value, max) {
  const text=String(value || '').trim();
  if (!text || text.length>max) throw new Error('資料不完整或超出長度限制');
  return text;
}
function cellText_(s) { return /^[=+@-]/.test(String(s)) ? "'"+s : s; }
function reply_(result) {
  const json=JSON.stringify(result).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><p>資料已處理，請返回調查表。</p><script>window.top.postMessage('+json+','+JSON.stringify(WEBSITE_ORIGIN)+');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function nextDataRow_(sheet) {
 const ids=sheet.getRange(2,1,Math.max(sheet.getLastRow()-1,1),1).getValues();
 for(let i=ids.length-1;i>=0;i--)if(String(ids[i][0]).trim())return i+3;
 return 2;
}
function mailReceipt_(sheet,row,nonce,email,family,reporter,portrait,members,r,tents) {
  const status=sheet.getRange(row,16).getValue();
  if(status==='已寄送')return {type:'surveyReceipt',requestId:nonce,ok:true,emailSent:true};
  const money=n=>'NT$ '+n.toLocaleString('zh-TW');
  const kind={child:'各團團員（小孩）',adult:'成人／非團員',free:'大班以下（免費）'};
  const lines=['115年11月入團儀典宿營調查','填表人自然名：'+reporter,'家庭編號：'+family,'肖像權授權：'+(portrait==='yes'?'我同意':'我不同意'),'收件編號：'+nonce,'',...r.people.flatMap(m=>[m.name+'｜'+kind[m.kind]+'｜'+SurveyRules.plans.find(p=>p.id===m.plan).label,'活動費 '+money(m.fees.camp)+'／入團費 '+money(m.fees.joining)+'／小計 '+money(m.fees.total),'餐宿調整：'+([m.noDinner&&'不用晚餐',m.noBreakfast&&'不用早餐',m.noStay&&'不住宿（不含車宿）'].filter(Boolean).join('、')||'依方案'),'備註：'+(m.note||'無'),'']),'活動費合計：'+money(r.camp),'入團費合計：'+money(r.joining),'116年家庭會員年費：'+money(r.annual),'露營帳位：'+tents+'帳，'+money(r.tentFee),'家庭應繳總額：'+money(r.total),'','本信為調查填寫紀錄，並非繳費完成證明。'];
  try {
    if(MailApp.getRemainingDailyQuota()<1)throw new Error('今日寄信額度已用完');
    MailApp.sendEmail({to:email,subject:'115年11月入團儀典宿營調查｜家庭'+family+'填寫紀錄',body:lines.join('\n'),name:'桃園親子一團'});
    sheet.getRange(row,16).setValue('已寄送');
    return {type:'surveyReceipt',requestId:nonce,ok:true,emailSent:true};
  } catch(error) {
    sheet.getRange(row,16).setValue('寄送失敗');
    return {type:'surveyReceipt',requestId:nonce,ok:true,emailSent:false};
  }
}
function doPost(e) {
  let nonce=''; let lock=LockService.getScriptLock();
  try {
    if (!e.parameter.payload || e.parameter.payload.length>100000) throw new Error('資料格式錯誤');
    const p=JSON.parse(e.parameter.payload);nonce=cleanText_(p.requestId,80);
    if (!/^[a-zA-Z0-9-]+$/.test(nonce)) throw new Error('收件編號錯誤');
    const family=cleanText_(p.familyId,8);if(!/^[1-9][0-9]*$/.test(family)) throw new Error('家庭編號錯誤');
    const reporter=cleanText_(p.reporter,50);
    const email=cleanText_(p.email,254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n,;]/.test(email))throw new Error('Email 格式錯誤');
    if(!['yes','no'].includes(p.portrait)) throw new Error('請選擇肖像權意願');
    if(!Array.isArray(p.members)||!p.members.length||p.members.length>30) throw new Error('成員數量錯誤');
    if(typeof p.hasMembership!=='boolean'||!Number.isInteger(p.tents)||p.tents<0||p.tents>99) throw new Error('額外費用欄位錯誤');
    const members=p.members.map(m=>{
      const name=cleanText_(m.name,50);const plan=SurveyRules.plans.find(x=>x.id===m.plan);
      if(!plan||!['child','adult','free'].includes(m.kind)) throw new Error('成員收費或出席選項錯誤');
      const note=String(m.note||'').trim(); if(note.length>200||(['day1','day2','late'].includes(m.plan)&&!note))throw new Error('請補充到校或離校時間');
      return {name,kind:m.kind,plan:m.plan,note,noDinner:plan.dinner&&m.kind!=='free'&&m.noDinner===true,noBreakfast:plan.breakfast&&m.kind!=='free'&&m.noBreakfast===true,noStay:plan.overnight&&m.kind!=='free'&&m.noStay===true};
    });
    if(new Set(members.map(m=>m.name)).size!==members.length) throw new Error('成員自然名重複');
    const r=SurveyRules.calculate(family,members,p.hasMembership,p.tents);
    lock.waitLock(20000);
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID), f=ss.getSheetByName('家庭總表'), d=ss.getSheetByName('成員明細');
    const receipts=f.getRange(2,12,Math.max(f.getLastRow()-1,1),1).getValues().flat();
    const previous=receipts.indexOf(nonce);
    if(previous>=0){
      const row=previous+2;
      if(String(f.getRange(row,15).getValue())!==email)throw new Error('收件編號與 Email 不一致');
      return reply_(mailReceipt_(f,row,nonce,email,family,reporter,p.portrait,members,r,p.tents));
    }
    const rows=r.people.map(m=>[nonce,family,cellText_(m.name),{child:'各團團員（小孩）',adult:'成人／非團員',free:'大班以下（免費）'}[m.kind],SurveyRules.plans.find(x=>x.id===m.plan).label,m.noDinner?'是':'否',m.noBreakfast?'是':'否',m.noStay?'是':'否',cellText_(m.note),m.fees.camp,m.fees.joining,m.fees.total]);
    // 同一收件編號重試時不重複寫入成員。
    const existing=d.getRange(2,1,Math.max(d.getLastRow()-1,1),1).getValues().flat();
    if(!existing.includes(nonce))d.getRange(nextDataRow_(d),1,rows.length,12).setValues(rows);
    const receiptRow=nextDataRow_(f);
    f.getRange(receiptRow,1,1,16).setValues([[family,cellText_(reporter),p.portrait==='yes'?'我同意':'我不同意',p.hasMembership?'有會員編號':'無會員編號',p.tents,r.camp,r.joining,r.annual,r.tentFee,r.total,new Date(),nonce,'','已收到',cellText_(email),'待寄送']]);
    SpreadsheetApp.flush();return reply_(mailReceipt_(f,receiptRow,nonce,email,family,reporter,p.portrait,members,r,p.tents));
  }catch(error){return reply_({type:'surveyReceipt',requestId:nonce,ok:false,message:String(error.message||'收件失敗')});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function doGet(){
 return HtmlService.createHtmlOutput(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:18px sans-serif;max-width:600px;margin:40px auto;padding:20px;line-height:1.8}input,button{font:inherit;padding:12px;max-width:100%;box-sizing:border-box}label{display:block;margin:20px 0}button{background:#176b87;color:white;border:0;border-radius:6px}</style><h1>家庭版肖像權同意書上傳</h1><p>上傳已簽署的 PDF、JPG 或 PNG，大小上限 10 MB。檔案將以家庭編號命名。</p><form id="f"><label>家庭編號 <input name="family" inputmode="numeric" pattern="[1-9][0-9]*" required></label><label>簽署檔案 <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required></label><button>上傳雲端</button></form><p id="s" role="status"></p><script>document.querySelector('#f').onsubmit=async function(e){e.preventDefault();const f=this.file.files[0],s=document.querySelector('#s'),b=this.querySelector('button');if(f.size>10*1024*1024){s.textContent='檔案不可超過10MB';return;}b.disabled=true;s.textContent='上傳中，請稍候';const reader=new FileReader();reader.onerror=()=>{s.textContent='無法讀取檔案';b.disabled=false};reader.onload=()=>google.script.run.withSuccessHandler(()=>{s.textContent='上傳完成，請返回調查表繼續填寫。';b.disabled=false}).withFailureHandler(err=>{s.textContent='上傳失敗：'+err.message;b.disabled=false}).uploadConsent({family:this.family.value,mime:f.type,data:reader.result.split(',')[1]});reader.readAsDataURL(f);};</script></html>`).setTitle('肖像權同意書上傳');
}
function uploadConsent(p){
 const family=cleanText_(p.family,8);if(!/^[1-9][0-9]*$/.test(family))throw new Error('家庭編號錯誤');
 const extensions={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'};
 if(!extensions[p.mime]||typeof p.data!=='string'||p.data.length>14000000)throw new Error('檔案格式或大小不符合');
 const bytes=Utilities.base64Decode(p.data);if(bytes.length>10*1024*1024||!bytes.length)throw new Error('檔案大小不符合');
 const file=DriveApp.getFolderById(UPLOAD_FOLDER_ID).createFile(Utilities.newBlob(bytes,p.mime,family+extensions[p.mime]));
 const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('家庭總表');
 const ids=sheet.getRange(2,1,Math.max(sheet.getLastRow()-1,1),1).getValues();
 for(let i=ids.length-1;i>=0;i--){if(String(ids[i][0])===family){sheet.getRange(i+2,13).setValue(file.getUrl());break;}}
 return {ok:true};
}
(function (root) {
  const plans = [
    { id: 'full', label: '正常出席', detail: '含晚餐、住宿、早餐', child: 250, adult: 450, dinner: true, breakfast: true, overnight: true },
    { id: 'day1', label: '第一天出席', detail: '13:00–20:30｜含晚餐、不住宿（不含車宿）；請備註離校時間', child: 100, adult: 300, dinner: true, breakfast: false, overnight: false },
    { id: 'day2', label: '第二天出席', detail: '06:00–11:30｜含早餐；請備註到校時間', child: 50, adult: 250, dinner: false, breakfast: true, overnight: false },
    { id: 'late', label: '第一天晚到、第二天出席', detail: '含晚餐、住宿、早餐；第二天 06:00–11:30，務必備註第一天到校時間', child: 250, adult: 450, dinner: true, breakfast: true, overnight: true },
    { id: 'leave', label: '請假', detail: '不收宿營活動費；入團費及家庭年費另計', child: 0, adult: 0, dinner: false, breakfast: false, overnight: false }
  ];
  const returning = { '8': ['小海豚'], '19': ['小蝴蝶'], '24': ['毛豆'], '45': ['石斑', '雷龍'], '62': ['香葵'] };
  function joiningFee(familyId, member) {
    if (member.kind !== 'child') return 0;
    return (returning[String(Number(familyId))]?.includes(member.name.trim()) || Number(familyId) > 62) ? 1000 : 0;
  }
  function calculateMember(member, familyId) {
    const plan = plans.find(p => p.id === member.plan);
    let camp = 0;
    if (plan && member.kind !== 'free') {
      camp = plan[member.kind === 'child' ? 'child' : 'adult'];
      if (plan.dinner && member.noDinner) camp -= 100;
      if (plan.breakfast && member.noBreakfast) camp -= 50;
      if (plan.overnight && member.noStay) camp -= 100;
      camp = Math.max(0, camp);
    }
    const joining = joiningFee(familyId, member);
    return { camp, joining, total: camp + joining };
  }
  function calculate(familyId, members, hasMembership, tents) {
    const people = members.map(m => ({ ...m, fees: calculateMember(m, familyId) }));
    const camp = people.reduce((s,m) => s + m.fees.camp, 0);
    const joining = people.reduce((s,m) => s + m.fees.joining, 0);
    const annual = hasMembership && Number(familyId) > 0 ? (Number(familyId) >= 62 ? 500 : 1000) : 0;
    const tentFee = Math.max(0, Number(tents) || 0) * 350;
    return { people, camp, joining, annual, tentFee, total: camp + joining + annual + tentFee };
  }
  root.SurveyRules = { plans, returning, joiningFee, calculateMember, calculate };
})(typeof window !== 'undefined' ? window : globalThis);

