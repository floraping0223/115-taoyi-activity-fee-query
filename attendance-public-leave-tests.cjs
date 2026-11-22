const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const backend = vm.createContext({});
vm.runInContext(fs.readFileSync('google-apps-script.gs', 'utf8'), backend);
const frontend = vm.createContext({ state: { rules: {} }, DEFAULT_RULES: {} });
const source = fs.readFileSync('attendance/app.js', 'utf8');
for (const name of ['annualStatus', 'recordWeight', 'updateAnnualCounts', 'attendancePeriods', 'normalizePartialLeaveStatus', 'isMorningLeave', 'isAfternoonLeave']) {
  const start = source.indexOf(`function ${name}(`);
  let end = source.indexOf('\nfunction ', start + 1);
  if (end < 0) end = source.length;
  vm.runInContext(source.slice(start, end), frontend);
}

const cases = [
  ['上午', '上午請假', false, true, 0, 0.5],
  ['下午', '下午請假', true, false, 0, 0.5],
  ['上午', '未到', false, false, 0.5, 0.5],
  ['下午', '未到', false, false, 0.5, 0.5],
  ['上午', '下午請假', true, false, 0.5, 0.5],
  ['下午', '上午請假', false, true, 0.5, 0.5],
  ['上午', '出席', true, true, 0, 0.5],
  ['全天', '未到', false, false, 0, 1],
];
for (const [leave, status, am, pm, absence, publicLeave] of cases) {
  const record = { publicLeavePeriod: leave, status, am, pm, expected: '全天出席' };
  const a = backend.annualStatus_(record);
  const b = frontend.annualStatus(record);
  assert.equal(a, b);
  assert.equal(backend.recordWeight_(a, {}), absence);
  assert.equal(frontend.recordWeight(b), absence);
  for (const [context, fn] of [[backend, 'updateAnnualCounts_'], [frontend, 'updateAnnualCounts']]) {
    const counts = { normal: 0, late: 0, morning: 0, afternoon: 0, absent: 0, publicLeave: 0 };
    context[fn](counts, a);
    assert.equal(counts.publicLeave, publicLeave);
  }
}
assert.equal(backend.annualStatus_({ expected: '公假', status: '未到' }), '公假');
const record = backend.mergeCheckinIntoRecord_({}, { publicLeavePeriod: '上午', status: '上午請假', period: '全場', am: false, pm: true });
backend.mergeCheckinIntoRecord_(record, { publicLeavePeriod: '', status: '上午請假', period: '全場', am: false, pm: true });
assert.equal(record.publicLeavePeriod, '上午');
console.log('Passed: 8 half/full-day cases, frontend/backend parity, full-day compatibility, retained manual leave.');
