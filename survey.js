(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const rules = window.SurveyRules;
  const money = n => `NT$ ${n.toLocaleString('zh-TW')}`;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kinds = {child:'各團團員（小孩）', adult:'成人／非團員', free:'大班以下（免費）'};
  let family = '';
  let members = [];
  let nextId = 1;
  const normalize = s => /^\d+$/.test(s.trim()) && Number(s) > 0 && Number.isSafeInteger(Number(s)) ? String(Number(s)) : '';
  function newMember(name = '', kind = '') {
    return {id: nextId++, name, kind, plan:'', note:'', noDinner:false, noBreakfast:false, noStay:false};
  }
  function result() { return rules.calculate(family, members, $('#hasMembership').checked, $('#tents').value); }
  function updateSummary() {
    const r = result();
    $('#summary').innerHTML = `<div class="summary-people">${r.people.map(m => `<div class="summary-line"><span>${escape(m.name || '未填自然名')} · ${escape(rules.plans.find(p => p.id === m.plan)?.label || '尚未選擇出席方式')}</span><span>${money(m.fees.total)}</span></div>`).join('') || '<p class="hint">請先帶入或新增家庭成員。</p>'}</div><div class="summary-list"><div class="summary-line"><span>宿營活動費</span><strong>${money(r.camp)}</strong></div><div class="summary-line"><span>入團費（逐人計算）</span><strong>${money(r.joining)}</strong></div><div class="summary-line"><span>116 年家庭會員年費</span><strong>${money(r.annual)}</strong></div><div class="summary-line"><span>露營帳位加購 · ${escape($('#tents').value || '0')} 帳</span><strong>${money(r.tentFee)}</strong></div></div><div class="grand-total"><span>家庭應繳總額</span><strong>${money(r.total)}</strong></div>`;
  }
  function updateCard(card, member) {
    const plan = rules.plans.find(p => p.id === member.plan);
    card.querySelector('.member-title').textContent = member.name || '新增成員';
    card.querySelector('.plan-detail').textContent = plan ? `${plan.detail}${member.kind === 'free' ? '｜大班以下免費' : member.kind ? `｜方案金額 ${money(plan[member.kind === 'child' ? 'child' : 'adult'])}` : ''}` : '請選擇這位成員的出席方式。';
    const note = card.querySelector('[data-field=note]');
    note.required = ['day1','day2','late'].includes(member.plan);
    card.querySelector('.note-label').textContent = member.plan === 'day1' ? '離校時間（必填）' : member.plan === 'late' ? '第一天到校時間（必填）' : member.plan === 'day2' ? '第二天到校時間（必填）' : '備註（選填）';
    [['noDinner','dinner'],['noBreakfast','breakfast'],['noStay','overnight']].forEach(([field, availability]) => {
      const input = card.querySelector(`[data-field=${field}]`);
      input.disabled = !plan?.[availability] || member.kind === 'free';
      input.parentElement.hidden = input.disabled;
      if (input.disabled) { input.checked = false; member[field] = false; }
    });
    const fees = rules.calculateMember(member, family);
    card.querySelector('.member-total').textContent = `活動費 ${money(fees.camp)} ＋ 入團費 ${money(fees.joining)} ＝ 小計 ${money(fees.total)}`;
  }
  function renderMembers() {
    $('#members').innerHTML = members.map(m => `<article class="member-card" data-id="${m.id}"><div class="member-head"><strong class="member-title"></strong><button class="remove" type="button" data-remove="${m.id}">移除此成員</button></div><div class="member-fields"><label>自然名<input data-field="name" value="${escape(m.name)}" maxlength="50" required></label><label>收費身分<select data-field="kind" required><option value="">請確認身分</option>${Object.entries(kinds).map(([k,v]) => `<option value="${k}" ${m.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="plan-field">出席方式<select data-field="plan" required><option value="">請選擇出席方式</option>${rules.plans.map(p => `<option value="${p.id}" ${m.plan === p.id ? 'selected' : ''}>${p.label}${m.kind === 'free' ? '（免費）' : `（團員 $${p.child}／成人 $${p.adult}）`}</option>`).join('')}</select></label></div><p class="plan-detail"></p><div class="adjustments"><label class="check-row"><input type="checkbox" data-field="noDinner" ${m.noDinner ? 'checked' : ''}>不用晚餐 −$100</label><label class="check-row"><input type="checkbox" data-field="noBreakfast" ${m.noBreakfast ? 'checked' : ''}>不用早餐 −$50</label><label class="check-row"><input type="checkbox" data-field="noStay" ${m.noStay ? 'checked' : ''}>不住宿 −$100</label></div><div class="member-fields"><label class="plan-field"><span class="note-label"></span><input data-field="note" value="${escape(m.note)}" maxlength="200" placeholder="請填寫時間或其他補充說明"></label></div><p class="member-total"></p></article>`).join('');
    members.forEach(m => updateCard($(`[data-id="${m.id}"]`), m));
    updateSummary();
  }
  function loadFamily() {
    const id = normalize($('#familyId').value);
    if (!id) { $('#familyStatus').textContent = '請輸入有效的家庭編號數字。'; $('#familyId').focus(); return; }
    if (family === id && members.length) { $('#familyStatus').textContent = `目前填寫家庭 ${id}，已保留你的選項。`; return; }
    family = id;
    $('#familyId').value = id;
    const seen = new Set();
    const roster = (window.PEOPLE_DATA || []).filter(p => normalize(String(p.familyId)) === id && p.enabled !== false).filter(p => { const key = `${p.name}|${p.role}`; if (seen.has(key)) return false; seen.add(key); return true; });
    members = roster.map(p => newMember(p.name, p.role === '成人' ? 'adult' : /小蟻|炫蜂|奔鹿|翔鷹/.test(`${p.group} ${p.sourceGroup}`) ? 'child' : ''));
    if (!members.length) members.push(newMember());
    $('#tents').value = ['44','53','81','14','57'].includes(id) ? '1' : '0';
    $('#confirmed').checked = false;
    $('#familyStatus').textContent = roster.length ? `家庭 ${id}：已帶入 ${roster.length} 位成員，請確認收費身分；大班以下請改選免費。` : `家庭 ${id} 尚無名冊資料，請自行新增並填寫所有家庭成員。`;
    $('#uploadFilename').textContent = `上傳檔案請命名為：${id}（保留原副檔名）`;
    renderMembers();
  }
  $('#loadFamily').addEventListener('click', loadFamily);
  $('#familyId').addEventListener('input', () => {
    if (normalize($('#familyId').value) !== family) {
      family = ''; members = []; $('#tents').value = '0'; $('#confirmed').checked = false;
      $('#familyStatus').textContent = '家庭編號已變更，請按「帶入成員」重新確認名冊。';
      $('#uploadFilename').textContent = ''; renderMembers();
    }
  });
  $('#addMember').addEventListener('click', () => {
    if (!family) loadFamily();
    if (!family) return;
    members.push(newMember()); $('#confirmed').checked = false; renderMembers();
    $('#members').lastElementChild.querySelector('input').focus();
  });
  $('#members').addEventListener('input', event => {
    const card = event.target.closest('.member-card');
    const field = event.target.dataset.field;
    if (!card || !field) return;
    const m = members.find(m => m.id === Number(card.dataset.id));
    m[field] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    $('#confirmed').checked = false;
    updateCard(card,m); updateSummary();
  });
  $('#members').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    members = members.filter(m => m.id !== Number(button.dataset.remove));
    $('#confirmed').checked = false; renderMembers();
  });
  ['#hasMembership','#tents'].forEach(s => $(s).addEventListener('input', () => { $('#confirmed').checked = false; updateSummary(); }));
  document.querySelectorAll('[name=portrait]').forEach(input => input.addEventListener('change', () => {
    $('#consentFiles').hidden = input.value !== 'yes'; $('#confirmed').checked = false;
  }));
  const config = window.SURVEY_CONFIG || {};
  if(config.backendUrl && !config.portraitUploadUrl)config.portraitUploadUrl=config.backendUrl;
  [['範例','portraitExampleUrl'],['空白表格','portraitBlankUrl'],['上傳雲端','portraitUploadUrl']].forEach(([label,key], i) => {
    let url;
    try { url = new URL(config[key], location.href); } catch {}
    const element = document.createElement(config[key] && (url?.protocol === 'https:' || url?.origin === location.origin) ? 'a' : 'span');
    element.textContent = `${i+1}. ${label}${element.tagName === 'SPAN' ? '（連結待提供）' : ' ↗'}`;
    if (element.tagName === 'A') { element.href = url.href; element.target = '_blank'; element.rel = 'noopener'; } else element.className = 'pending';
    $('#documentLinks').append(element);
  });
  let lastSubmission = null;
  async function sendToCloud(p) {
    const endpoint = config.backendUrl;
    if (!endpoint) return;
    const encoded = JSON.stringify(p);
    if (!lastSubmission || lastSubmission.encoded !== encoded) lastSubmission = {encoded, requestId:crypto.randomUUID()};
    p.requestId = lastSubmission.requestId;
    const button = $('#surveyForm button[type=submit]'); button.disabled = true;
    $('#saveStatus').textContent = '正在送交主辦單位，請保持此頁開啟。';
    const iframe=document.createElement('iframe'); iframe.name='receipt-'+p.requestId; iframe.hidden=true; document.body.append(iframe);
    const form=document.createElement('form'); form.method='POST'; form.action=endpoint; form.target=iframe.name; form.hidden=true;
    const field=document.createElement('input'); field.name='payload';field.value=JSON.stringify(p);form.append(field);document.body.append(form);
    let timer;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',received);button.disabled=false;form.remove();iframe.remove();};
    const received=event=>{
      let origin;try{origin=new URL(event.origin);}catch{return;}
      if (!(origin.hostname === 'script.google.com' || origin.hostname.endsWith('.googleusercontent.com')))return;
      const reply=event.data;if(reply?.type!=='surveyReceipt'||reply.requestId!==p.requestId)return;
      cleanup();$('#saveStatus').textContent=reply.ok?'已送出成功，收件編號：'+p.requestId:'收件失敗：'+(reply.message||'請稍後再試');
    };
    window.addEventListener('message',received);
    timer=setTimeout(()=>{cleanup();$('#saveStatus').textContent='尚未確認送達，請稍後重新送出，系統會沿用收件編號避免重複。';},45000);
    form.submit();
  }
  if(config.backendUrl){
    $('#surveyForm button[type=submit]').textContent='送出調查並下載副本';
    $('#saveStatus').textContent='確認明細後送出，系統顯示收件編號才代表送交成功。';
    if(!config.portraitUploadUrl)config.portraitUploadUrl=config.backendUrl;
  }
  $('#surveyForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!family || normalize($('#familyId').value) !== family) { $('#saveStatus').textContent = '請先按「帶入成員」確認家庭編號。'; $('#loadFamily').focus(); return; }
    if (!members.length) { $('#saveStatus').textContent = '請至少填寫一位家庭成員。'; $('#addMember').focus(); return; }
    if (!$('#reporter').value.trim() || members.some(m => !m.name.trim() || (['day1','day2','late'].includes(m.plan) && !m.note.trim()))) { $('#saveStatus').textContent = '自然名及必要的到校／離校時間不可只填空白。'; return; }
    const names = members.map(m => m.name.trim());
    if (new Set(names).size !== names.length) { $('#saveStatus').textContent = '家庭成員自然名重複，請確認名冊。'; return; }
    const r = result();
    const portrait = document.querySelector('[name=portrait]:checked')?.value;
    const lines = ['115年11月入團儀典宿營調查',`填表人自然名：${$('#reporter').value.trim()}`,`家庭編號：${family}`,`肖像權授權：${portrait === 'yes' ? '我同意' : '我不同意'}`,'',...r.people.flatMap(m => [`${m.name.trim()}｜${kinds[m.kind]}｜${rules.plans.find(p => p.id === m.plan).label}`,`  活動費 ${money(m.fees.camp)}／入團費 ${money(m.fees.joining)}／小計 ${money(m.fees.total)}`,`  餐宿調整：${[m.noDinner && '不用晚餐', m.noBreakfast && '不用早餐', m.noStay && '不住宿'].filter(Boolean).join('、') || '依方案'}`,`  備註：${m.note.trim() || '無'}`]),'',`活動費合計：${money(r.camp)}`,`入團費合計：${money(r.joining)}`,`116年家庭會員年費：${money(r.annual)}`,`露營帳位：${$('#tents').value} 帳，${money(r.tentFee)}`,`家庭應繳總額：${money(r.total)}`,'','此檔案為填寫結果留存，尚未送交主辦單位。'];
    const blob = new Blob(['\ufeff'+lines.join('\r\n')], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `115年11月宿營調查_家庭${family}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url),10000);
    $('#saveStatus').textContent = '已下載填寫結果。尚未設定雲端收件，請依主辦單位通知繳交。';
    if(config.backendUrl)sendToCloud({familyId:family,reporter:$('#reporter').value.trim(),portrait,members,hasMembership:$('#hasMembership').checked,tents:Number($('#tents').value)});
  });
  renderMembers();
})();

