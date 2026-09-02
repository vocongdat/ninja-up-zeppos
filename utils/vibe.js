// utils/vibe.js — hmSetting wrapper, best-effort.
// Final-review finding F3: startVibrate({mode: periodic, period}) KHÔNG tự tắt —
// buzz lặp vô hạn suốt ván. Mỗi buzz giờ tự hẹn stopVibrate() sau đúng period
// (@zos/timer setTimeout); timeout id đang chờ được giữ ở stopTimerId, và
// stop() hủy nó trước khi gọi stopVibrate() — nhờ vậy death() sau bounce()
// (mà không cần stop() trung gian) không bị pending-stop của cú nảy cắt sớm
// buzz chết: death() tự gọi stop() nội bộ trước khi startbuzz 400ms.
import { hmSetting } from "@zos/settings";
import { setTimeout as zSetTimeout, clearTimeout as zClearTimeout } from "@zos/timer";

export function createVibe() {
  let stopTimerId = null; // timeout hẹn stopVibrate của buzz đang chạy (hoặc null)

  // Hủy pending-stop của buzz TRƯỚC: nếu không, stop-delayed của buzz cũ sẽ
  // bắn giữa buzz mới và cắt nó sớm. (death() gọi cancelPending() trước start.)
  function cancelPending() {
    if (stopTimerId === null) return;
    try { zClearTimeout(stopTimerId); } catch (e) { /* id đã chết — bỏ qua */ }
    stopTimerId = null;
  }
  function stopNow() {
    try { hmSetting.stopVibrate(); } catch (e) { /* rung là phụ */ }
  }
  // Buzz: start periodic + hẹn tự stop sau đúng period. Nếu startVibrate ném,
  // không để lại pending-stop (không có gì đang rung để stop).
  function buzz(period) {
    cancelPending();
    let started = false;
    try {
      hmSetting.startVibrate({ mode: hmSetting.vibrate_mode_periodic, period });
      started = true;
    } catch (e) { started = false; }
    if (!started) return;
    try {
      stopTimerId = zSetTimeout(() => {
        stopTimerId = null;
        stopNow();
      }, period);
    } catch (e) { stopTimerId = null; }
  }
  return {
    bounce() { buzz(100); },
    death() { buzz(400); },
    stop() {
      cancelPending();
      stopNow();
    },
  };
}
