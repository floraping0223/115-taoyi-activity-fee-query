(() => {
'use strict';
const $=s=>document.querySelector(s),money=n=>'NT$ '+Number(n).toLocaleString('zh-TW');
const endpoint=window.CAMP_PAYMENT_CONFIG?.backendUrl||'';
let current=null,lookupSequence=0,lastReport=null;
function status(text){$('#paymentStatus').hidden=false;$('#paymentStatus').textContent=text;}
function clearResult(){current=null;$('#approvedPanel').hidden=true;['#bankName','#bankAccount','#bankHolder','#approvedFamily','#approvedTotal','#reportResult','#reportNotice'].forEach(s=>$(s).textContent='');$('#feeItems').replaceChildren();$('#memberPlans').replaceChildren();$('#paymentReport').reset();}
function rpc(payload){return new Promise((resolve,reject)=>{
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)){reject(Error('繳費查詢尚未啟用，請等候主辦單位通知。'));return;}
 const nonce=payload.requestId||crypto.randomUUID(),iframe=document.createElement('iframe'),form=document.createElement('form'),input=document.createElement('input');
 iframe.name='camp-payment-'+nonce;iframe.hidden=true;form.hidden=true;form.method='POST';form.action=endpoint;form.target=iframe.name;input.name='payload';input.value=JSON.stringify({...payload,requestId:nonce});form.append(input);document.body.append(iframe,form);
 let timer;const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);form.remove();iframe.remove();};
 const receive=e=>{let origin;try{origin=new URL(e.origin);}catch{return;}
 if(!(origin.hostname==='script.google.com'||origin.hostname.endsWith('.googleusercontent.com')))return;
 if(e.data?.type!=='campPaymentReceipt'||e.data.requestId!==nonce)return;cleanup();e.data.ok?resolve(e.data):reject(Error(e.data.message||'查詢失敗，請稍後再試'));};
 window.addEventListener('message',receive);timer=setTimeout(()=>{cleanup();reject(Error('尚未收到服務回覆，請稍後再試。'));},30000);form.submit();
});}
function render(result){
 clearResult();
 if(result.state!=='approved'){status(result.message||'資料審核中，請暫勿匯款。');return;}
 if(!Number.isSafeInteger(result.total)||result.total<0||!Array.isArray(result.items)||result.items.some(i=>!Number.isSafeInteger(i.amount)||i.amount<0)||result.items.reduce((s,i)=>s+i.amount,0)!==result.total){status('核定資料需確認，請洽明鏡。');return;}
 current=result;$('#paymentStatus').hidden=true;$('#approvedPanel').hidden=false;$('#approvedFamily').textContent=result.familyId;$('#approvedTotal').textContent=money(result.total);
 for(const item of result.items){const row=document.createElement('div');row.className='fee-row';const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=item.label;amount.textContent=money(item.amount);row.append(label,amount);$('#feeItems').append(row);}
 $('#adjustmentNote').hidden=!result.note;$('#adjustmentNote').textContent='核定調整說明：'+(result.note||'');
 for(const person of result.members||[]){const article=document.createElement('article');article.className='member-plan';const title=document.createElement('strong'),plan=document.createElement('p'),note=document.createElement('p');title.textContent=person.name+(person.group?' · '+person.group:'');plan.textContent=person.plan+'｜'+person.arrangements;note.textContent='到離校／補充說明：'+(person.note||'無');article.append(title,plan,note);$('#memberPlans').append(article);}
 $('#bankPanel').hidden=result.total===0;
 if(result.total>0){$('#bankName').textContent=result.bank.bank;$('#bankAccount').textContent=result.bank.account;$('#bankHolder').textContent=result.bank.holder;}
 $('#reportFamily').value=result.familyId;$('#reportAmount').value=result.total||'';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=n=>parts.find(p=>p.type===n).value;const today=part('year')+'-'+part('month')+'-'+part('day');$('#reportDate').value=today;$('#reportDate').max=today;
 $('#paymentReport').hidden=result.reported||result.total===0;$('#reportButton').disabled=false;
 $('#reportNotice').textContent=result.total===0?'核定金額為0元，不需匯款。':result.reported?'本家庭已回報匯款，主辦單位對帳中。回報不代表已確認入帳；如需修正請洽明鏡。':'請填實際匯款資料。送出後由主辦單位核對入帳。';
}
$('#paymentFamily').addEventListener('input',()=>{lookupSequence++;clearResult();$('#paymentStatus').hidden=true;$('#lookupButton').disabled=!endpoint;});
$('#paymentLookup').addEventListener('submit',async e=>{
 e.preventDefault();if(!$('#paymentLookup').reportValidity())return;
 const raw=$('#paymentFamily').value.trim(),id=String(Number(raw));
 if(!/^\d{1,3}$/.test(raw)||Number(id)<1||Number(id)>82||id==='75'){clearResult();status('請輸入1–82的家庭編號（不含75）。');return;}
 const seq=++lookupSequence;clearResult();$('#paymentFamily').value=id;$('#lookupButton').disabled=true;status('正在查詢審核狀態…');
 try{const reply=await rpc({action:'lookup',familyId:id});if(seq===lookupSequence)render(reply.result);}catch(error){if(seq===lookupSequence){clearResult();status(error.message);}}finally{if(seq===lookupSequence)$('#lookupButton').disabled=false;}
});
$('#paymentReport').addEventListener('submit',async e=>{
 e.preventDefault();if(!current||current.state!=='approved'||!$('#paymentReport').reportValidity())return;
 const record=current,payload={action:'report',familyId:record.familyId,version:record.version,date:$('#reportDate').value,amount:Number($('#reportAmount').value),lastFive:$('#reportLastFive').value.trim()};
 if(!Number.isSafeInteger(payload.amount)||payload.amount<=0||!/^\d{5}$/.test(payload.lastFive)){$('#reportResult').textContent='請確認匯款金額與轉帳後五碼。';return;}
 const key=JSON.stringify(payload);if(!lastReport||lastReport.key!==key)lastReport={key,id:crypto.randomUUID()};payload.requestId=lastReport.id;
 $('#reportButton').disabled=true;$('#reportResult').textContent='正在送出匯款回報…';
 try{const reply=await rpc(payload);if(current!==record)return;$('#paymentReport').hidden=true;$('#reportResult').textContent=reply.alreadyReported?'本家庭已有匯款回報，請洽明鏡確認，無須重複送出。':'匯款回報已送出，待主辦單位對帳確認。';$('#reportNotice').textContent='回報完成不代表已確認入帳。';}
 catch(error){if(current===record){$('#reportResult').textContent=error.message;$('#reportButton').disabled=false;}}
});
if(!endpoint){$('#lookupButton').disabled=true;status('繳費查詢尚未啟用，請等候主辦單位完成設定。');}
})();
