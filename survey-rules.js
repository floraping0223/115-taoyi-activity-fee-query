(function (root) {
  const plans = [
    { id: 'full', label: '正常出席', detail: '含晚餐、住宿、早餐', child: 250, adult: 450, dinner: true, breakfast: true, overnight: true },
    { id: 'day1', label: '第一天出席', detail: '13:00–20:30｜含晚餐、不住宿；請備註離校時間', child: 100, adult: 300, dinner: true, breakfast: false, overnight: false },
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
