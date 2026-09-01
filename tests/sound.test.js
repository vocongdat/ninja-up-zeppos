// tests/sound.test.js
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetMedia, mediaLog, TonePlayer } from "@zos/media";
import { backing, resetStorage, localStorage } from "@zos/storage";
import { createSound } from "../utils/sound.js";

beforeEach(() => { resetMedia(); resetStorage(); });

test("bounce plays through the shared TonePlayer", () => {
  const s = createSound();
  s.bounce();
  const methods = mediaLog.map((e) => e.method);
  assert.ok(methods.includes("prepare") && methods.includes("start"));
  const prep = mediaLog.find((e) => e.method === "prepare");
  assert.equal(prep.file, "bounce.wav");
});

test("death plays death.wav", () => {
  const s = createSound();
  s.death();
  assert.ok(mediaLog.some((e) => e.method === "prepare" && e.file === "death.wav"));
});

test("music start/stop", () => {
  const s = createSound();
  s.startMusic();
  assert.ok(mediaLog.some((e) => e.method === "prepare" && e.file === "music.wav"));
  assert.ok(mediaLog.some((e) => e.method === "start"));
  s.stopMusic();
  assert.ok(mediaLog.some((e) => e.method === "stop"));
});

test("muteSfx silences bounce and death but not music", () => {
  localStorage.setItem("settings", JSON.stringify({ muteSfx: true, muteMusic: false }));
  const s = createSound();
  s.bounce();
  s.death();
  assert.equal(mediaLog.length, 0);
  s.startMusic();
  assert.ok(mediaLog.some((e) => e.method === "start"));
});

test("muteMusic silences music but not bounce", () => {
  localStorage.setItem("settings", JSON.stringify({ muteSfx: false, muteMusic: true }));
  const s = createSound();
  s.startMusic();
  assert.equal(mediaLog.length, 0);
  s.bounce();
  assert.ok(mediaLog.some((e) => e.method === "start"));
});

test("TonePlayer throwing never propagates", () => {
  const orig = {
    prepare: TonePlayer.prototype.prepare,
    start: TonePlayer.prototype.start,
    stop: TonePlayer.prototype.stop,
    release: TonePlayer.prototype.release,
  };
  const boom = () => { throw new Error("no audio"); };
  try {
    const s = createSound();
    // prepare ném lỗi (sau một stop sạch)
    TonePlayer.prototype.prepare = boom;
    s.bounce();
    // start ném lỗi (prepare thành công)
    TonePlayer.prototype.prepare = orig.prepare;
    TonePlayer.prototype.start = boom;
    s.death();
    // stop ném lỗi (cả trong play lẫn stopMusic)
    TonePlayer.prototype.start = orig.start;
    TonePlayer.prototype.stop = boom;
    s.startMusic();
    s.stopMusic();
    // release ném lỗi
    TonePlayer.prototype.stop = orig.stop;
    TonePlayer.prototype.release = boom;
    s.release();
    assert.ok(true, "no throw is the contract");
  } finally {
    TonePlayer.prototype.prepare = orig.prepare;
    TonePlayer.prototype.start = orig.start;
    TonePlayer.prototype.stop = orig.stop;
    TonePlayer.prototype.release = orig.release;
  }
});

test("malformed settings JSON never throws and never plays", () => {
  localStorage.setItem("settings", "{not json");
  const s = createSound();
  s.bounce();
  assert.equal(mediaLog.length, 0);
});
