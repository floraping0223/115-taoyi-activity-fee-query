const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const html=fs.readFileSync('camp-payment.html','utf8').replace('<script src="camp-payment-config.js?v=1"></script>','<script>window.CAMP_PAYMENT_CONFIG={backendUrl:"https://script.google.com/macros/s/CAMPTEST/exec"};</script>');fs.writeFileSync('camp-payment-test-preview.html',html);
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),p=await b.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));let sent;
 await p.route('https://script.google.com/**',async route=>{
  const data=JSON.parse(new URLSearchParams(route.request().postData()).get('payload'));let reply={type:'campPaymentReceipt',requestId:data.requestId,ok:true};
  if(data.action==='lookup')reply.result=data.familyId==='16'?{state:'approved',familyId:'16',items:[{label:'核定活動費',amount:950},{label:'核定入團費',amount:0},{label:'核定家庭年費',amount:1000},{label:'核定帳位費',amount:0}],total:1950,note:'',members:[{name:'測試成員',group:'奔鹿團',plan:'正常出席',arrangements:'依出席方案',note:'18:30到校'}],receipt:'test',version:'testversion',bank:{bank:'LINE Bank',account:'111003642280',holder:'楊吳孟徽'},reported:false}:{state:data.familyId==='45'?'pending':'not_submitted',familyId:data.familyId,message:data.familyId==='45'?'資料審核中，請暫勿匯款。':'尚未填寫宿營調查，請先完成調查表。'};
  else {sent=data;reply.alreadyReported=false;}
  await route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><script>window.top.postMessage('+JSON.stringify(reply)+',"*")</script>'});
 });
 await p.goto('file:///C:/Users/USER/Documents/528/camp-payment-test-preview.html');
 async function lookup(id){await p.locator('#paymentFamily').fill(id);await p.locator('#lookupButton').click();await p.waitForFunction(()=>!document.querySelector('#lookupButton').disabled);}
 await lookup('45');assert(!(await p.locator('#approvedPanel').isVisible()));assert.equal(await p.locator('#bankAccount').innerText(),'');console.log('pendingStatus='+await p.locator('#paymentStatus').innerText());assert((await p.locator('#paymentStatus').innerText()).includes('審核中'));
 await lookup('1');assert(!(await p.locator('#approvedPanel').isVisible()));assert((await p.locator('#paymentStatus').innerText()).includes('尚未填寫'));
 await lookup('16');assert(await p.locator('#approvedPanel').isVisible());assert((await p.locator('#approvedTotal').innerText()).includes('1,950'));assert.equal(await p.locator('#bankAccount').innerText(),'111003642280');
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'camp-payment-mobile.png',fullPage:true});
 await p.locator('#reportLastFive').fill('00123');await p.locator('#reportButton').click();await p.waitForFunction(()=>document.querySelector('#reportResult').textContent.includes('已送出'));assert.equal(sent.lastFive,'00123');assert.equal(sent.amount,1950);assert(!(await p.locator('#paymentReport').isVisible()));
 await p.locator('#paymentFamily').fill('45');assert(!(await p.locator('#approvedPanel').isVisible()));assert.equal(await p.locator('#bankAccount').innerText(),'');assert.deepEqual(errors,[]);
 await b.close();console.log('通過：待審核隱藏帳號與金額、未填表提醒、核定明細、手機版、後五碼、回報成功、切換家庭立即清空。僅使用模擬服務。');
})().catch(e=>{console.error(e);process.exit(1)});

