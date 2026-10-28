const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const data={requestId:'test-receipt-1',familyId:'45',reporter:'測試',email:'test@example.com',portrait:'yes',hasMembership:true,tents:0,members:[{name:'石斑',kind:'child',plan:'full',noStay:true,note:'離校'},{name:'雷龍',kind:'child',plan:'full'}]};
function setup(fail=false,prior=false){
 const writes=[],mails=[];let status=prior?'已寄送':'';
 const family={getLastRow:()=>prior?2:1,getRange:(row,col)=>({getValues:()=>col===12?[[prior?data.requestId:'']]:[['']],getValue:()=>col===16?status:col===15?data.email:'',setValue:s=>{status=s;},setValues:r=>writes.push(['family',r])})};
 const details={getLastRow:()=>1,getRange:()=>({getValues:()=>[['']],setValues:r=>writes.push(['members',r])})};
 const context={console,HtmlService:{XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>name==='家庭總表'?family:details}),flush(){}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:mail=>{if(fail)throw new Error('測試寄送失敗');mails.push(mail);}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('survey-backend.gs','utf8'),context);return{context,writes,mails,getStatus:()=>status};
}
let t=setup(),res=t.context.doPost({parameter:{payload:JSON.stringify(data)}});
assert(res.html.includes('"emailSent":true'));assert.equal(t.mails.length,1);assert.equal(t.mails[0].to,'test@example.com');assert(t.mails[0].body.includes('不住宿（不含車宿）'));assert(t.mails[0].body.includes('3,400'));assert.equal(t.getStatus(),'已寄送');assert.equal(t.writes.find(w=>w[0]==='family')[1][0][14],data.email);
t=setup(true);res=t.context.doPost({parameter:{payload:JSON.stringify(data)}});assert(res.html.includes('"ok":true'));assert(res.html.includes('"emailSent":false'));assert.equal(t.getStatus(),'寄送失敗');
t=setup(false,true);res=t.context.doPost({parameter:{payload:JSON.stringify(data)}});assert(res.html.includes('"emailSent":true'));assert.equal(t.mails.length,0);assert.equal(t.writes.length,0);
t=setup();res=t.context.doPost({parameter:{payload:JSON.stringify({...data,email:'a@example.com,b@example.com'})}});assert(res.html.includes('"ok":false'));assert.equal(t.writes.length,0);assert.equal(t.mails.length,0);
console.log('Email 模擬測試通過：收件者、完整紀錄、車宿備註、寄送成功／失敗、重試不重寄、拒絕多收件者。');
