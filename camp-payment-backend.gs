// 獨立的宿營繳費查詢程式。請建立另一個 Apps Script 專案部署，勿覆蓋宿營調查收件程式。
const PAYMENT_SHEET_ID='1KyD86bPLGgzlNSrtfjPw7tW2E4I2bdqe8dkM-7seGD0';
const PAYMENT_ORIGIN='https://floraping0223.github.io';
const PAYMENT_BANK={bank:'LINE Bank（824 連線商業銀行）',account:'111003642280',holder:'楊吳孟徽'};
function paymentTable_(name){
 const sheet=SpreadsheetApp.openById(PAYMENT_SHEET_ID).getSheetByName(name);
 if(!sheet)throw Error('尚未設定收件表，請洽明鏡');
 const grid=sheet.getDataRange().getValues(),display=sheet.getDataRange().getDisplayValues();
 const headers=grid[0].map(String);
 return {sheet,rows:grid.slice(1).map((row,i)=>{const obj={};headers.forEach((h,j)=>{if(h)obj[h]=row[j];});obj._display=display[i+1]||[];return obj;})};
}
function paymentFamily_(s){const v=String(s||'').trim();if(!/^\d{1,3}$/.test(v)||Number(v)<1||Number(v)>82||Number(v)===75)throw Error('請輸入1–82的家庭編號（不含75）');return String(Number(v));}
function paymentAmount_(v){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;}
function paymentHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value)).map(n=>('0'+((n+256)%256).toString(16)).slice(-2)).join('');}
function paymentLookup_(id){
 const originals=paymentTable_('家庭總表').rows.filter(r=>String(Number(r['家庭編號']))===id);
 if(!originals.length)return{state:'not_submitted',familyId:id,message:'尚未填寫宿營調查，請先完成調查表。'};
 if(originals.length!==1)return{state:'pending',familyId:id,message:'資料待主辦單位核對，請暫勿匯款。'};
 const original=originals[0],receipt=String(original['收件編號']||'');
 const review=paymentTable_('宿營收費審核').rows.find(r=>String(Number(r['家庭編號']))===id);
 if(!review||review['審核狀態']!=='已確認'||!receipt||String(review['已核對收件編號'])!==receipt)return{state:'pending',familyId:id,message:'資料審核中，請暫勿匯款。'};
 const fields=['核定活動費','核定入團費','核定家庭年費','核定帳位費'];
 const amounts=fields.map(k=>review[k]);
 if(!amounts.every(paymentAmount_))return{state:'pending',familyId:id,message:'核定費用尚待確認，請暫勿匯款。'};
 const total=amounts.reduce((a,b)=>a+b,0),note=String(review['公開調整說明']||'').trim();
 if(!Number.isSafeInteger(total)||(total!==Number(original['應繳總額'])&&!note))return{state:'pending',familyId:id,message:'調整說明尚待確認，請暫勿匯款。'};
 const members=paymentTable_('成員明細').rows.filter(r=>String(Number(r['家庭編號']))===id&&String(r['收件編號'])===receipt).map(r=>({name:String(r['自然名']||''),group:String(r['本人分團']||''),plan:String(r['出席方式']||''),arrangements:[r['不用晚餐']==='是'?'不用晚餐':'',r['不用早餐']==='是'?'不用早餐':'',r['不住宿']==='是'?'不住宿（不含車宿）':''].filter(Boolean).join('、')||'依出席方案',note:String(r._display[8]||'')}));
 if(!members.length)return{state:'pending',familyId:id,message:'成員資料尚待確認，請暫勿匯款。'};
 const version=paymentHash_({id,receipt,amounts,note});
 const reported=paymentTable_('宿營匯款回報').rows.some(r=>String(Number(r['家庭編號']))===id);
 return{state:'approved',familyId:id,items:fields.map((label,i)=>({label,amount:amounts[i]})),total,note,members,receipt,version,bank:PAYMENT_BANK,reported};
}
function paymentReply_(nonce,data){
 const json=JSON.stringify({type:'campPaymentReceipt',requestId:nonce,...data}).replace(/</g,'\\u003c');
 return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><p>查詢已完成，請返回宿營繳費頁。</p><script>window.top.postMessage('+json+','+JSON.stringify(PAYMENT_ORIGIN)+');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e){
 let nonce='',lock;
 try{
  if(!e.parameter.payload||e.parameter.payload.length>12000)throw Error('資料格式錯誤');
  const p=JSON.parse(e.parameter.payload);nonce=String(p.requestId||'');if(!/^[a-zA-Z0-9-]{8,80}$/.test(nonce))throw Error('回報編號錯誤');
  if(p.action==='capabilities')return paymentReply_(nonce,{ok:true,service:'campPayment',version:1});
  const family=paymentFamily_(p.familyId);
  if(p.action==='lookup')return paymentReply_(nonce,{ok:true,result:paymentLookup_(family)});
  if(p.action!=='report')throw Error('不支援此操作');
  lock=LockService.getScriptLock();lock.waitLock(20000);
  const current=paymentLookup_(family);if(current.state!=='approved')throw Error('此家庭尚未完成審核，請暫勿匯款');
  if(String(p.version)!==current.version)throw Error('核定金額已更新，請重新查詢後再回報');
  const table=paymentTable_('宿營匯款回報');
  if(table.rows.some(r=>String(r['回報編號'])===nonce&&String(Number(r['家庭編號']))===family))return paymentReply_(nonce,{ok:true,alreadyReported:true});
  if(current.reported)return paymentReply_(nonce,{ok:true,alreadyReported:true});
  const actual=Number(p.amount);if(!Number.isSafeInteger(actual)||actual<=0)throw Error('匯款金額須為大於0的整數');
  if(!/^\d{5}$/.test(String(p.lastFive)))throw Error('請填寫轉帳後五碼');
  const date=String(p.date||'');const parsed=new Date(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date>Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd'))throw Error('匯款日期不正確或晚於今天');
  if(current.total===0)throw Error('核定金額為0，不需匯款');
  table.sheet.appendRow([new Date(),Number(family),date,actual,"'"+String(p.lastFive),current.total,current.receipt,current.version,nonce,'待對帳']);
  SpreadsheetApp.flush();return paymentReply_(nonce,{ok:true,alreadyReported:false});
 }catch(error){return paymentReply_(nonce,{ok:false,message:String(error.message||'查詢失敗，請稍後再試')});}
 finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function doGet(){return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><h1>宿營繳費查詢服務</h1><p>請由宿營繳費查詢頁輸入家庭編號。</p>');}
