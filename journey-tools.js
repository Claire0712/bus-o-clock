export const PLAN_IDS = ['regular', 'extra'];
export function timePlans(value = {}) {
  const regular = { walkMinutes:value.walkMinutes ?? 4, bufferMinutes:value.bufferMinutes ?? 2 };
  return structuredClone(value.timePresets ?? { regular, extra:{walkMinutes:Math.min(180,regular.walkMinutes+2),bufferMinutes:Math.min(180,regular.bufferMinutes+1)} });
}
export function arrivalDay(eta, now) {
  const date = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  return date(eta) !== date(now);
}
export function recommendationReason(state, commute) {
  if (!state?.recommended || !['wait','leave-now'].includes(state.status)) return null;
  return { key:state.skippedCount > 0 ? 'reasonSkipped' : 'reasonFits', values:{walk:commute.walkMinutes,buffer:commute.bufferMinutes},
    firstEta:state.departures[0]?.eta, chosenEta:state.recommended.eta };
}
