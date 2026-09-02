// tests/vibe.test.js — utils/vibe.js: buzz có thời lượng, tự dừng.
// Final-review finding F3: startVibrate({mode: periodic, period}) không bao giờ
// tự tắt — buzz lặp suốt ván. Giờ bounce/death tự hẹn stopVibrate sau đúng
// period; vibe.stop() hủy timeout đang chờ + stopVibrate() (idempotent).
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetVibro, vibroLog, hmSetting } from "@zos/settings";
import { resetTimers, tick, pendingCount } from "@zos/timer";
import { createVibe } from "../utils/vibe.js";

beforeEach(() => { resetVibro(); resetTimers(); });

const starts = () => vibroLog.filter((e) => e.method === "start");
const stops = () => vibroLog.filter((e) => e.method === "stop");

test("bounce vibrates 100ms periodic", () => {
  const v = createVibe();
  v.bounce();
  assert.equal(vibroLog[0].method, "start");
  assert.equal(vibroLog[0].arg.period, 100);
});

// Pin arg chế độ rung: periodic là điều kiện tải đúng trên máy thật — period
// không meaning nếu mode rơi về no/continuous (device-QA item của spec §9).
test("startVibrate is called with mode periodic", () => {
  const v = createVibe();
  v.bounce();
  assert.equal(vibroLog[0].arg.mode, hmSetting.vibrate_mode_periodic);
  v.death();
  assert.equal(starts()[1].arg.mode, hmSetting.vibrate_mode_periodic);
});

test("death vibrates 400ms", () => {
  const v = createVibe();
  v.death();
  assert.equal(vibroLog[0].arg.period, 400);
});

test("bounce schedules a 100ms stop; the buzz does not outlive it", () => {
  const v = createVibe();
  v.bounce();
  assert.equal(pendingCount(), 1, "one pending stop timeout");
  assert.equal(stops().length, 0);
  tick();
  assert.equal(stops().length, 1, "stopVibrate fired after the buzz window");
});

test("death schedules a 400ms stop", () => {
  const v = createVibe();
  v.death();
  assert.equal(pendingCount(), 1);
  tick();
  assert.equal(stops().length, 1);
});

test("stop clears the pending stop-timeout and stops now", () => {
  const v = createVibe();
  v.bounce();
  v.stop();
  assert.equal(stops().length, 1, "stopVibrate called immediately");
  const after = vibroLog.length;
  tick();
  assert.equal(vibroLog.length, after, "pending timeout cleared: no second stopVibrate fires");
  assert.equal(pendingCount(), 0);
});

test("stop is idempotent and safe with nothing pending", () => {
  const v = createVibe();
  v.stop();
  v.stop();
  assert.equal(stops().length, 2, "each stop() calls stopVibrate (harmless)");
  assert.equal(pendingCount(), 0);
});

test("death after bounce without intermediate stop still ends its own buzz", () => {
  const v = createVibe();
  v.bounce();                       // start#1 (100ms) + pending stop
  v.death();                        // start#2 (400ms); pending bounce-stop phải bị hủy
  assert.equal(starts().length, 2);
  assert.equal(pendingCount(), 1, "only the death stop is pending");
  tick();
  assert.equal(stops().length, 1, "exactly one stop fired — the death's own");
  assert.equal(pendingCount(), 0);
});

test("bounce after death does not shorten the death buzz either", () => {
  const v = createVibe();
  v.death();
  v.bounce();
  assert.equal(pendingCount(), 1, "death stop replaced by bounce stop");
  tick();
  assert.equal(stops().length, 1);
});

test("hmSetting throwing never propagates", () => {
  const orig = hmSetting.startVibrate;
  hmSetting.startVibrate = () => { throw new Error("no vibro"); };
  const v = createVibe();
  v.bounce();
  assert.equal(pendingCount(), 0, "failed start must not leave a stop pending");
  hmSetting.startVibrate = orig;
  hmSetting.stopVibrate = () => { throw new Error("no vibro"); };
  try {
    assert.doesNotThrow(() => v.stop());
    assert.doesNotThrow(() => v.bounce());
  } finally {
    hmSetting.stopVibrate = () => { vibroLog.push({ method: "stop" }); return true; };
  }
});
