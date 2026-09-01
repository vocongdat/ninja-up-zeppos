// tests/vibe.test.js
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetVibro, vibroLog, hmSetting } from "@zos/settings";
import { createVibe } from "../utils/vibe.js";

beforeEach(() => { resetVibro(); });

test("bounce vibrates 100ms periodic", () => {
  const v = createVibe();
  v.bounce();
  assert.equal(vibroLog[0].method, "start");
  assert.equal(vibroLog[0].arg.period, 100);
});

test("death vibrates 400ms", () => {
  const v = createVibe();
  v.death();
  assert.equal(vibroLog[0].arg.period, 400);
});

test("stop calls stopVibrate", () => {
  const v = createVibe();
  v.stop();
  assert.equal(vibroLog[0].method, "stop");
});

test("hmSetting throwing never propagates", () => {
  const orig = hmSetting.startVibrate;
  hmSetting.startVibrate = () => { throw new Error("no vibro"); };
  const v = createVibe();
  v.bounce();
  hmSetting.startVibrate = orig;
  assert.ok(true);
});
