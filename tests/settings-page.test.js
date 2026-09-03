import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry } from "@zos/ui";
import { resetStorage, localStorage } from "@zos/storage";
import { router, resetRouter } from "@zos/router";

let captured;
globalThis.Page = (obj) => { captured = obj; };

beforeEach(() => { resetRegistry(); resetStorage(); resetRouter(); captured = undefined; });

async function loadSettings() {
  const url = new URL("../setting/index.js", import.meta.url).href;
  await import(url + "?v=" + Math.random());
  return captured;
}

function findRow(fragment) {
  return hmUI.live().find((w) => w.type === "BUTTON" && w.props.text.includes(fragment));
}

test("renders three rows and back", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  const texts = hmUI.live().filter((w) => w.type === "TEXT" || w.type === "BUTTON").map((w) => w.props.text);
  assert.ok(texts.some((t) => t.includes("SFX")));
  assert.ok(texts.some((t) => t.includes("Nhạc")));
  assert.ok(texts.some((t) => t.includes("kỷ lục")));
  assert.ok(hmUI.live().some((w) => w.type === "BUTTON" && w.props.text === "‹"));
});

test("rows show Bật for both toggles when nothing stored", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  assert.equal(findRow("SFX").props.text, "Âm thanh SFX: Bật");
  assert.equal(findRow("Nhạc").props.text, "Nhạc nền: Bật");
  assert.equal(findRow("kỷ lục").props.text, "Xoá kỷ lục");
});

test("tapping SFX row flips muteSfx and persists", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  const row = findRow("SFX");
  row.props.click_func();
  const s = JSON.parse(localStorage.getItem("settings"));
  assert.equal(s.muteSfx, true);
  row.props.click_func();
  assert.equal(JSON.parse(localStorage.getItem("settings")).muteSfx, false);
});

test("tapping music row flips muteMusic and persists", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  const row = findRow("Nhạc");
  row.props.click_func();
  const s = JSON.parse(localStorage.getItem("settings"));
  assert.equal(s.muteMusic, true);
  // Rapid second tap: flips the value freshly read from storage, never a cached copy.
  row.props.click_func();
  assert.equal(JSON.parse(localStorage.getItem("settings")).muteMusic, false);
});

test("toggling reads fresh storage so two toggles never lose state", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  localStorage.setItem("settings", JSON.stringify({ muteSfx: true, muteMusic: false }));
  findRow("SFX").props.click_func();
  findRow("SFX").props.click_func();
  const s = JSON.parse(localStorage.getItem("settings"));
  assert.equal(s.muteSfx, true, "two taps on top of muteSfx:true must land back on true");
  assert.equal(s.muteMusic, false, "music flag untouched by SFX taps");
});

test("row text updates after toggle", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  findRow("SFX").props.click_func();
  assert.equal(findRow("SFX").props.text, "Âm thanh SFX: Tắt");
  findRow("Nhạc").props.click_func();
  assert.equal(findRow("Nhạc").props.text, "Nhạc nền: Tắt");
  assert.equal(hmUI.live().filter((w) => w.type === "BUTTON").length, 4, "no widget duplication on re-render (3 rows + back)");
});

test("clear record removes key and row survives re-render", async () => {
  localStorage.setItem("record", "77");
  const page = await loadSettings();
  page.onInit(); page.build();
  const row = findRow("kỷ lục");
  row.props.click_func();
  assert.equal(localStorage.getItem("record"), "0", "record cleared to sentinel 0 (fake storage has no removeItem; menu/game both read 0 as no record)");
  assert.equal(findRow("kỷ lục").props.text, "Xoá kỷ lục", "rows rebuilt after clear");
  assert.equal(hmUI.live().filter((w) => w.type === "BUTTON").length, 4);
});

test("pageChrome back button calls router.back only", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  const back = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "‹");
  back.props.click_func();
  assert.equal(router.backCalls, 1);
  assert.equal(router.pushes.length, 0);
});

test("corrupt settings JSON still builds and first toggle writes valid JSON", async () => {
  localStorage.setItem("settings", "{not json");
  const page = await loadSettings();
  page.onInit(); page.build();
  assert.ok(findRow("SFX"), "page built despite corrupt settings");
  findRow("SFX").props.click_func();
  const raw = localStorage.getItem("settings");
  const s = JSON.parse(raw);
  assert.equal(s.muteSfx, true, "first toggle works from corrupt start: " + raw);
  // Corrupt start falls back to {} defaults, so muteMusic is simply absent
  // (undefined === falsy, which is exactly what sound.js's !!s.muteMusic reads).
  assert.ok(!("muteMusic" in s), "untouched flag stays absent-falsy, not materialised: " + raw);
  assert.ok(!Array.isArray(s) && s && typeof s === "object", "stored value is a plain object: " + raw);
});

test("settings stored as a JSON array does not make toggles inert", async () => {
  localStorage.setItem("settings", "[]");
  const page = await loadSettings();
  page.onInit(); page.build();
  assert.ok(findRow("SFX"), "page built with array settings");
  findRow("SFX").props.click_func();
  const raw = localStorage.getItem("settings");
  const s = JSON.parse(raw);
  assert.ok(!Array.isArray(s), "stored value must be a plain object, not an array: " + raw);
  assert.equal(s.muteSfx, true, "toggle persisted on a plain object: " + raw);
});

test("corrupt record value still builds and clear record still works", async () => {
  localStorage.setItem("record", "not-a-number");
  const page = await loadSettings();
  page.onInit(); page.build();
  findRow("kỷ lục").props.click_func();
  assert.equal(localStorage.getItem("record"), "0", "corrupt record overwritten by clear");
});

test("onResume re-renders without duplicating widgets and reflects storage edits", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  const before = hmUI.live().length;
  localStorage.setItem("settings", JSON.stringify({ muteSfx: true, muteMusic: true }));
  page.onResume();
  assert.equal(hmUI.live().length, before, "no duplicate widgets after resume");
  assert.equal(findRow("SFX").props.text, "Âm thanh SFX: Tắt");
  assert.equal(findRow("Nhạc").props.text, "Nhạc nền: Tắt");
});

test("failed settings write keeps page alive and never kills the row", async () => {
  const page = await loadSettings();
  page.onInit(); page.build();
  localStorage.setItem("record", "7"); // something to clear later
  // Simulate a full store by monkey-patching setItem to throw, like backing.failWrites does.
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("storage full"); };
  try {
    assert.doesNotThrow(() => findRow("SFX").props.click_func());
  } finally {
    localStorage.setItem = original;
  }
  assert.equal(findRow("SFX").props.text, "Âm thanh SFX: Bật", "unchanged text when write failed");
});
