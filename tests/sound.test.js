// tests/sound.test.js — utils/sound.js: SFX player + dedicated music player.
// Final-review finding F2: trước đây MỌI âm đi qua MỘT TonePlayer dùng chung
// (play = stop→prepare→start), nên cú nảy đầu tiên chắc chắn xảy ra ≤1 tick sau
// startMusic() đã supersede nhạc nền. Giờ nhạc có player riêng + tự tái lập
// bằng setTimeout theo MUSIC_LOOP_MS (music.wav dài đúng 2.4s).
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetMedia, mediaLog, TonePlayer } from "@zos/media";
import { backing, resetStorage, localStorage } from "@zos/storage";
import { resetTimers, tick, pendingCount, pendingIds } from "@zos/timer";
import { MUSIC_LOOP_MS, createSound } from "../utils/sound.js";

beforeEach(() => { resetMedia(); resetStorage(); resetTimers(); });

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

test("startMusic schedules a restart after MUSIC_LOOP_MS = 2400", () => {
  const s = createSound();
  s.startMusic();
  assert.equal(pendingCount(), 1, "one pending restart timeout");
  // Behaviour over ids: after the fake drains pending timeouts, the music
  // player starts again (no real time, no wav parsing — the loop is the
  // MUSIC_LOOP_MS constant, not the file).
  assert.equal(MUSIC_LOOP_MS, 2400);
  const startsBefore = mediaLog.filter((e) => e.method === "start" && e.file === "music.wav").length;
  tick();                                     // bắn timeout đang chờ
  const startsAfter = mediaLog.filter((e) => e.method === "start" && e.file === "music.wav").length;
  assert.equal(startsAfter, startsBefore + 1, "music player started again after the loop duration");
  assert.equal(pendingCount(), 1, "each fired restart schedules the next one");
});

test("bounce does NOT stop the music player (dedicated instances)", () => {
  const s = createSound();
  s.startMusic();
  const stopsBefore = mediaLog.filter((e) => e.method === "stop" && e.file === "music.wav").length;
  const startsBefore = mediaLog.filter((e) => e.method === "start" && e.file === "music.wav").length;
  s.bounce();
  s.bounce();
  s.bounce();
  const stopsAfter = mediaLog.filter((e) => e.method === "stop" && e.file === "music.wav").length;
  assert.equal(stopsAfter, stopsBefore, "bounce never stops music.wav");
  // Music start-count keeps growing across bounces (restart timeouts still fire).
  tick();
  const startsAfter = mediaLog.filter((e) => e.method === "start" && e.file === "music.wav").length;
  assert.ok(startsAfter >= startsBefore, "music loop survives bounces");
});

test("bounce and death never prepare the same file as music (separate players)", () => {
  const s = createSound();
  s.startMusic();
  const count = () => mediaLog.filter((e) => e.file === "music.wav").length;
  const before = count();
  s.bounce();
  s.death();
  assert.equal(count(), before, "no SFX event touches the music player");
});

test("stopMusic clears the scheduled restart and stops the player", () => {
  const s = createSound();
  s.startMusic();
  assert.equal(pendingCount(), 1);
  s.stopMusic();
  assert.equal(pendingCount(), 0, "pending restart cleared");
  assert.ok(mediaLog.some((e) => e.method === "stop" && e.file === "music.wav"), "music player stopped");
  const eventsAfter = mediaLog.length;
  tick();                                     // không còn timeout nào để bắn
  assert.equal(mediaLog.length, eventsAfter, "no restart fires after stopMusic");
});

test("release clears the scheduled restart too", () => {
  const s = createSound();
  s.startMusic();
  s.release();
  assert.equal(pendingCount(), 0, "no timeout survives release");
});

test("stopMusic is safe to call twice and with no music ever started", () => {
  const s = createSound();
  s.stopMusic();                              // chưa start: không ném
  s.startMusic();
  s.stopMusic();
  s.stopMusic();
  assert.equal(pendingCount(), 0);
});

test("muteMusic gates the whole loop (no start, no scheduled restart)", () => {
  localStorage.setItem("settings", JSON.stringify({ muteSfx: false, muteMusic: true }));
  const s = createSound();
  s.startMusic();
  assert.equal(mediaLog.length, 0, "nothing played");
  assert.equal(pendingCount(), 0, "no restart scheduled");
  tick();
  assert.equal(mediaLog.length, 0);
});

test("muteSfx silences bounce and death but not music", () => {
  localStorage.setItem("settings", JSON.stringify({ muteSfx: true, muteMusic: false }));
  const s = createSound();
  s.bounce();
  s.death();
  assert.equal(mediaLog.length, 0);
  s.startMusic();
  assert.ok(mediaLog.some((e) => e.method === "start"));
  assert.equal(pendingCount(), 1);
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
    s.startMusic();                           // play + schedule đều phải nuốt lỗi
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

test("restart timeout throwing never propagates and stops the loop", () => {
  const s = createSound();
  s.startMusic();
  TonePlayer.prototype.stop = () => { throw new Error("boom"); };
  const origStart = TonePlayer.prototype.start;
  TonePlayer.prototype.start = () => { throw new Error("boom"); };
  try {
    assert.doesNotThrow(() => tick(), "a failing restart must not kill the caller");
  } finally {
    TonePlayer.prototype.stop = origStart === undefined ? TonePlayer.prototype.stop : () => {};
    TonePlayer.prototype.stop = () => {};
    TonePlayer.prototype.start = origStart;
  }
});

test("malformed settings JSON never throws and never plays", () => {
  localStorage.setItem("settings", "{not json");
  const s = createSound();
  s.bounce();
  assert.equal(mediaLog.length, 0);
});
