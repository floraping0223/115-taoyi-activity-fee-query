const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
function run(overrides={},stored=null,mailFail=false){
 const writes=[],files=[],mails=[];let state='';
 const family={getLastRow:()=>stored?2:1,getRange:(row,col)=>({getValues:()=>[[stored?(col===12?stored.requestId:col===1?stored.familyId:''):'']],getValue:()=>col===16?state:col===15?stored?.email:col===1?stored?.familyId:'',setValue:v=>state=v,setValues:r=>writes.push(['family',r])})};
 const detail={getLastRow:()=>1,getRange:()=>({getValues:()=>[['']],setValues:r=>writes.push(['members',r])})};
 const context={console,HtmlService:{XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>n==='分團名冊'?{getLastRow:()=>5,getRange:()=>({getDisplayValues:()=>[['16','0823135'],['34','1225954'],['45','1326620'],['62','721637']]})}:n==='家庭總表'?family:n==='年費申報'?{getLastRow:()=>1,getRange:()=>({getValues:()=>[['']],setValues:r=>writes.push(['annual',r])})}:detail}),flush(){}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:mail=>{if(mailFail)throw Error('mail fail');mails.push(mail);}},Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:()=>({})},DriveApp:{getFolderById:()=>({createFile:blob=>{files.push(blob);return{getUrl:()=> 'https://drive.google.com/file/d/test'};}})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('survey-backend.gs','utf8'),context);
 const p={requestId:'test-receipt',confirmed:true,familyId:'45',reporter:'測試',email:'test@example.com',portrait:'yes',members:[{name:'石斑',kind:'child',plan:'full'}],annualChoice:'collect',hasMembership:false,tents:99,attachment:{mime:'application/pdf',data:'dGVzdA=='},...overrides};
 const res=context.doPost({parameter:{payload:JSON.stringify(p)}}).html;
 return {res,writes,files,mails,state};
}
let t=run();assert(t.res.includes('"ok":true'));assert.equal(t.files.length,1);const row=t.writes.find(w=>w[0]==='family')[1][0];assert.equal(row[4],0);assert.equal(row[7],1000);assert.equal(row[12],'https://drive.google.com/file/d/test');
t=run({familyId:'44'});assert.equal(t.writes.find(w=>w[0]==='family')[1][0][4],1);
for(const p of [{confirmed:false},{attachment:null},{reporter:' '},{email:'invalid'},{members:[{name:'石斑',kind:'child',plan:'late',note:''}]}]){t=run(p);assert(t.res.includes('"ok":false'));assert.equal(t.writes.length,0);assert.equal(t.mails.length,0);}
t=run({}, {familyId:'45',requestId:'previous',email:'test@example.com'});assert(t.res.includes('此家庭編號已送出'));assert.equal(t.files.length,0);assert.equal(t.writes.length,0);assert.equal(t.mails.length,0);
t=run({portrait:'no',attachment:null});assert(t.res.includes('"ok":true'));assert.equal(t.files.length,0);
t=run({portrait:'no',attachment:null},null,true);assert(t.res.includes('"emailSent":false'));assert.equal(t.writes.length,3);
t=run({action:'capabilities',confirmed:false});assert(t.res.includes('"version":2'));assert(t.res.includes('"ok":true'));assert.equal(t.writes.length,0);
console.log('通過：每家庭限一次、必填驗證、同意書必附、拒絕者免附、固定帳位、自動年費、服務版本驗證。');

t=run({action:'familyStatus',confirmed:false},{familyId:'45',requestId:'previous',email:'test@example.com'});assert(t.res.includes('"submitted":true'));assert.equal(t.writes.length,0);assert.equal(t.mails.length,0);
t=run({action:'familyStatus',confirmed:false});assert(t.res.includes('"submitted":false'));assert.equal(t.writes.length,0);console.log('家庭狀態查詢通過：已填／未填回覆正確，查詢不寫入資料也不寄信。');

for(const choice of ['lifetime','card']){t=run({annualChoice:choice});assert(t.res.includes('"ok":true'));assert.equal(t.writes.find(w=>w[0]==='family')[1][0][7],0);const annual=t.writes.find(w=>w[0]==='annual')[1][0];assert.equal(annual[3],'待審核');assert(t.mails[0].body.includes('未計入預估總額'));}
t=run({annualChoice:'unknown'});assert(t.res.includes('請選擇116年費處理方式'));assert.equal(t.writes.length,0);
t=run({annualChoice:undefined});assert(t.res.includes('請選擇116年費處理方式'));assert.equal(t.writes.length,0);
t=run({familyId:'62',annualChoice:'collect'});assert.equal(t.writes.find(w=>w[0]==='family')[1][0][7],500);
console.log('年費三選項通過：一般代收1000/500、終身及信用卡待審核0預估、申報紀錄、Email標註、漏選或偽造選項擋下。');

t=run({familyId:'16'});assert.equal(t.writes.find(w=>w[0]==='family')[1][0][3],'0823135');assert(t.mails[0].body.includes('會員編號：0823135'));
t=run({action:'familyStatus',familyId:'16',confirmed:false});assert(t.res.includes('"memberNumber":"0823135"'));assert.equal(t.writes.length,0);
console.log('會員編號測試通過：原欄直接填實際編號、保留前導0、查詢及Email同步、不更動年費規則。');
