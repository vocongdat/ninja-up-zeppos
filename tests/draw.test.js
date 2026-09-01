// tests/draw.test.js — Task 7: page/draw.js sprite pool + apply() renderer.
// Contract: buildSprites() builds the pool ONCE (apply never creates/deletes),
// apply() only setProperty. Points where this file deviates from the brief's
// draft test, per controller rulings:
//  - Ruling 1: ninja is ONE IMG whose SOURCE alternates (not 2 ninja IMGs).
//    The brief's arithmetic `2 + 5 + 3 + 2` also omitted the 2 tower IMGs and
//    the hudBg IMG that the corrected draft AND the committed Task 6 stub both
//    build, so the count here is written out term by term (see test below).
//  - Nền band 0 dùng "bg-dusk.png" làm src ban đầu (đổi SOURCE theo score band
//    là việc của Task 8 — không đụng ở đây).
//  - nowMs của apply() là tuỳ chọn: game.js luôn truyền, test có thể bỏ.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry, registry } from "@zos/ui";
import { buildSprites, apply } from "../page/draw.js";
import { createWorld } from "../page/game-core.js";
import { H } from "../page/ui.js";

beforeEach(() => { resetRegistry(); });

// Fake @zos/ui không expose liveByType trên default export — đếm từ live().
function liveByType() {
  const out = {};
  for (const w of hmUI.live()) out[w.type] = (out[w.type] || 0) + 1;
  return out;
}

test("buildSprites creates a fixed pool (bg2, towers2, hudBg+text, planks5, shuriken3, ninja1)", () => {
  const s = buildSprites();
  const types = liveByType();
  // Ninja là 1 IMG duy nhất đổi SOURCE (ruling 1) — không phải 2 IMG như brief gốc.
  // Tổng: bg 2 + towers 2 + hudBg 1 + planks 5 + shurikens 3 + ninja 1.
  assert.equal(types.IMG, 2 + 2 + 1 + 5 + 3 + 1, "bg 2 + towers 2 + hudBg 1 + planks 5 + shurikens 3 + ninja 1");
  assert.equal(types.TEXT, 1, "HUD text");
  // Key set mà page/game.js phụ thuộc; overlay là mảng thật để push widget game over.
  for (const key of ["bg", "towers", "planks", "shurikens", "ninja", "hudText", "overlay"]) {
    assert.ok(key in s, "pool has key " + key);
  }
  assert.ok(Array.isArray(s.overlay), "overlay is a real array");
  // Band 0 mặc định: bg-dusk.png (đổi SOURCE theo score band là việc của Task 8).
  // Đọc qua getProperty("SOURCE") — fake alias src tạo-lúc-tạo-widget → source.
  assert.equal(s.bg[0].getProperty("SOURCE"), "bg-dusk.png");
  assert.equal(s.bg[1].getProperty("SOURCE"), "bg-dusk.png");
});

test("apply positions planks and ninja from world state", () => {
  const s = buildSprites();
  const w = createWorld(() => 0.5);
  apply(s, w);
  // Plank đầu nằm đúng vị trí world (world.planks[0] là plank khởi đầu y=320).
  const p0 = w.planks[0];
  assert.equal(s.planks[0].getProperty("X"), Math.floor(p0.x));
  assert.equal(s.planks[0].getProperty("Y"), Math.floor(p0.y));
  // Ninja nằm đúng vị trí + frame theo bounceCount (0 lần nảy → frame A).
  assert.equal(s.ninja.getProperty("X"), Math.floor(w.ninja.x));
  assert.equal(s.ninja.getProperty("Y"), Math.floor(w.ninja.y));
  assert.equal(s.ninja.getProperty("SOURCE"), "ninja-a.png");
});

test("HUD text shows score in metres", () => {
  const s = buildSprites();
  const w = createWorld(() => 0.5);
  w.alt = 160;
  apply(s, w);
  assert.equal(s.hudText.getProperty("TEXT"), "20 M");
});

test("shuriken slots beyond live count are hidden", () => {
  const s = buildSprites();
  const w = createWorld(() => 0.5);
  w.shurikens.push({ x: 100, y: 100, w: 16, h: 16, vx: 60 });
  apply(s, w);
  assert.equal(s.shurikens[0].getProperty("VISIBLE"), true);
  assert.equal(s.shurikens[1].getProperty("VISIBLE"), false);
  assert.equal(s.shurikens[2].getProperty("VISIBLE"), false);
});

test("apply survives a dead bg widget and still renders the rest of the frame", () => {
  const s = buildSprites();
  const w = createWorld(() => 0.5);
  w.alt = 160; // điểm 20 M
  // Giết bg[0] như trên máy thật: widget đã bị xoá thì setProperty ném.
  hmUI.deleteWidget(s.bg[0]);
  // apply() trước đây để 2 lệnh setProperty("Y") nền ngoài try/catch — một widget
  // nền chết làm ném cả frame (HUD, plank, shuriken, ninja đều treo). Bắt buộc:
  // apply KHÔNG ném và phần còn lại của frame vẫn render.
  assert.doesNotThrow(() => apply(s, w));
  assert.equal(s.hudText.getProperty("TEXT"), "20 M", "HUD vẫn cập nhật");
  assert.equal(s.ninja.getProperty("X"), Math.floor(w.ninja.x), "ninja vẫn được đặt vị trí");
  // bg[1] còn sống vẫn nhận Y (scroll tiếp diễn với phần nền còn lại).
  assert.equal(s.bg[1].getProperty("Y"), Math.floor(H - (w.alt % H)));
});

test("shuriken frame flips at 8Hz via nowMs", () => {
  const s = buildSprites();
  const w = createWorld(() => 0.5);
  w.shurikens.push({ x: 100, y: 100, w: 16, h: 16, vx: 60 });
  apply(s, w, 0);
  const srcA = s.shurikens[0].getProperty("SOURCE");
  // 8Hz spin = chu kỳ 125ms chia 2 frame. Brief ghi 100ms nhưng chú thích của
  // chính brief chỉ "dùng 200ms" — 200ms rơi vào frame kế tiếp (chu kỳ 125ms).
  apply(s, w, 200);
  const srcB = s.shurikens[0].getProperty("SOURCE");
  assert.equal(srcA, "shuriken-a.png");
  assert.equal(srcB, "shuriken-b.png");
  assert.notEqual(srcA, srcB);
});
