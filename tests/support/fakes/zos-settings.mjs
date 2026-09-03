// tests/support/fakes/zos-settings.mjs
export const vibroLog = [];
export function resetVibro() { vibroLog.length = 0; }
export const hmSetting = {
  vibrate_mode_no: 0, vibrate_mode_continuous: 1, vibrate_mode_periodic: 2,
  startVibrate(opt) { vibroLog.push({ method: "start", arg: opt }); return true; },
  stopVibrate() { vibroLog.push({ method: "stop" }); return true; },
};
