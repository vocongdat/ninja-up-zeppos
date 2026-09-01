// utils/vibe.js — hmSetting wrapper, best-effort.
import { hmSetting } from "@zos/settings";

export function createVibe() {
  function vibrate(period) {
    try {
      hmSetting.startVibrate({ mode: hmSetting.vibrate_mode_periodic, period });
    } catch (e) { /* rung là phụ */ }
  }
  return {
    bounce() { vibrate(100); },
    death() { vibrate(400); },
    stop() {
      try { hmSetting.stopVibrate(); } catch (e) {}
    },
  };
}
