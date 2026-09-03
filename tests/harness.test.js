import test from "node:test";
import assert from "node:assert/strict";
import hmUI, { registry, resetRegistry } from "@zos/ui";
import { resetTimers, setInterval, clearInterval, tick, intervalCount } from "@zos/timer";
import { backing, resetStorage, localStorage } from "@zos/storage";
import { router, resetRouter } from "@zos/router";
import { TonePlayer, resetMedia, mediaLog } from "@zos/media";
import { hmSetting, resetVibro, vibroLog } from "@zos/settings";

test("ui fake applies X/Y/SOURCE", () => {
  resetRegistry();
  const w = hmUI.createWidget(hmUI.widget.IMG, { x: 0, y: 0, src: "a.png" });
  w.setProperty(hmUI.prop.X, 10);
  w.setProperty(hmUI.prop.SOURCE, "b.png");
  assert.equal(w.getProperty(hmUI.prop.X), 10);
  assert.equal(w.getProperty(hmUI.prop.SOURCE), "b.png");
});

test("timer fake tick(ms) fires intervals by period", () => {
  resetTimers();
  let n = 0;
  const id = setInterval(() => n++, 33);
  tick(99);
  assert.equal(n, 3);
  clearInterval(id);
  tick(99);
  assert.equal(n, 3);
  assert.equal(intervalCount(), 0);
});

test("storage fake roundtrip + failWrites", () => {
  resetStorage();
  localStorage.setItem("k", "v");
  assert.equal(localStorage.getItem("k"), "v");
  resetStorage();
  assert.equal(localStorage.getItem("k"), null);
  backing.failWrites = true;
  assert.throws(() => localStorage.setItem("k", "v"));
  backing.failWrites = false;
});

test("router, media, settings fakes log calls", () => {
  resetRouter(); resetMedia(); resetVibro();
  router.push({ page: "page/game" });
  assert.equal(router.pushes.length, 1);
  const p = new TonePlayer();
  p.prepare({ file: "bounce.wav" }); p.start();
  assert.deepEqual(mediaLog.map((e) => e.method), ["prepare", "start"]);
  hmSetting.startVibrate({ mode: hmSetting.vibrate_mode_periodic, period: 100 });
  assert.equal(vibroLog.length, 1);
});
