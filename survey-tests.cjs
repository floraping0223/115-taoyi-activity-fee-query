const assert = require('node:assert/strict');
require('./survey-rules.js');
const R = globalThis.SurveyRules;
function member(kind, plan, name='測試', extra={}) { return {kind,plan,name,...extra}; }
for (const [plan,child,adult] of [['full',250,450],['day1',100,300],['day2',50,250],['late',250,450],['leave',0,0]]) {
  assert.equal(R.calculateMember(member('child',plan),'16').camp,child);
  assert.equal(R.calculateMember(member('adult',plan),'16').camp,adult);
  assert.equal(R.calculateMember(member('free',plan),'16').camp,0);
}
assert.equal(R.calculateMember(member('adult','full','測試',{noDinner:true,noBreakfast:true,noStay:true}),'16').camp,200);
assert.equal(R.calculateMember(member('child','day1','測試',{noBreakfast:true,noStay:true}),'16').camp,100);
assert.equal(R.calculateMember(member('child','full','測試',{noDinner:true,noBreakfast:true,noStay:true}),'16').camp,0);
for (const [id,name] of [['8','小海豚'],['19','小蝴蝶'],['24','毛豆'],['45','石斑'],['45','雷龍'],['62','香葵']]) assert.equal(R.joiningFee(id,member('child','leave',name)),1000);
assert.equal(R.joiningFee('62',member('child','full','其他小孩')),0);
assert.equal(R.joiningFee('63',member('child','full')),1000);
assert.equal(R.joiningFee('63',member('adult','full')),0);
assert.equal(R.joiningFee('63',member('free','full')),0);
assert.equal(R.calculate('45',[member('child','full','石斑'),member('child','full','雷龍')],true,0).total,3500);
assert.equal(R.calculate('62',[member('child','full','香葵')],true,0).total,1750);
assert.equal(R.calculate('61',[],true,0).annual,1000);
assert.equal(R.calculate('62',[],true,0).annual,500);
assert.equal(R.calculate('44',[member('adult','full')],true,1).total,1800);
assert.equal(R.calculate('63',[],false,2).total,700);
console.log('費用測試通過：五種方案、免費、餐宿減免、六位重新入團、62/63 邊界、家庭年費、帳位加購。');
