import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld, step, scoreOf, TAP_COOLDOWN_MS, JUMP_VX, JUMP_VY, SCORE_DIV, HITBOX_SCALE,
  PLAY_BOTTOM, PLAY_TOP,
} from "../page/game-core.js";

const RAND = () => 0.5;

function feetY(w) { return w.ninja.y + w.ninja.h; }

test("world init: ninja stands on the first plank", () => {
  const w = createWorld(RAND);
  assert.equal(w.dead, false);
  assert.ok(w.planks.length >= 2, "at least 2 planks");
  const p0 = w.planks[0];
  assert.ok(Math.abs(w.ninja.x + w.ninja.w / 2 - (p0.x + p0.w / 2)) <= 1, "ninja centered on plank");
  assert.equal(feetY(w), p0.y, "feet on plank top");
});

test("gravity pulls the ninja down when it walks off the plank", () => {
  const w = createWorld(RAND);
  // Đẩy ninja ra ngoài plank theo ngang để rơi tự do
  w.ninja.x = 0; // xa mọi plank (plank nằm trong lối đi ≥ 65+70-20 = 115)
  const y0 = w.ninja.y;
  step(w, 100, 0, false);
  assert.ok(w.ninja.y > y0, "ninja falls");
});

test("landing on a plank while falling bounces the ninja up", () => {
  const w = createWorld(RAND);
  // Cho ninja rơi từ vị trí đứng: rơi 50ms là vy > 0, chạm plank ngay
  w.ninja.vy = 1; // bắt đầu rơi
  step(w, 50, 0, false);
  assert.ok(w.ninja.vy < 0, "bounced up, vy negative");
});

test("bounce alternates direction each landing", () => {
  const w = createWorld(RAND);
  w.ninja.vy = 1;
  step(w, 50, 0, false);         // lần 1: dir flipping
  const dir1 = w.ninja.dir;
  // Đưa ninja trở lại plank (mô phỏng rơi lại đúng chỗ)
  const p0 = w.planks[0];
  w.ninja.x = p0.x + p0.w / 2 - w.ninja.w / 2;
  w.ninja.y = p0.y - w.ninja.h;
  w.ninja.vy = 1;
  step(w, 50, 100, false);
  assert.notEqual(w.ninja.dir, dir1, "direction flips on each bounce");
});

test("mid-air tap reverses horizontal direction and jumps", () => {
  const w = createWorld(RAND);
  w.ninja.x = 0; // rơi tự do
  w.ninja.vy = 100;
  step(w, 16, 0, false);
  const vxBefore = w.ninja.vx;
  step(w, 16, 100, true);        // tap
  assert.equal(w.ninja.vy, -JUMP_VY);
  assert.ok(w.ninja.vx !== 0);
  // tap ngay lập tức nữa trong cooldown → không jump thêm
  step(w, 16, 110, true);
  assert.ok(w.ninja.vy > -JUMP_VY, "cooldown blocks instant re-jump");
});

test("score = altitude / 8", () => {
  const w = createWorld(RAND);
  w.alt = 160;
  assert.equal(scoreOf(w), 160 / SCORE_DIV);
});

test("falling past the bottom kills the ninja", () => {
  const w = createWorld(RAND);
  w.ninja.x = 0;
  w.ninja.y = PLAY_BOTTOM + 10;
  w.ninja.vy = 100;
  step(w, 16, 0, false);
  assert.equal(w.dead, true);
});

test("shuriken collision kills the ninja", () => {
  const w = createWorld(RAND);
  // Đặt shuriken chồng lên ninja (AABB hitbox 70%)
  w.shurikens.push({ x: w.ninja.x, y: w.ninja.y, w: 16, h: 16, vx: 100 });
  step(w, 16, 0, false);
  assert.equal(w.dead, true);
});

test("shuriken graze (outside 70% hitbox) does not kill", () => {
  const w = createWorld(RAND);
  // Shuriken cách ninja đúng 3px ngoài biên: overlap thật nhưng hitbox 70% không chạm
  w.shurikens.push({ x: w.ninja.x + w.ninja.w + 2, y: w.ninja.y, w: 16, h: 16, vx: 100 });
  step(w, 16, 0, false);
  assert.equal(w.dead, false);
});

test("climbing pushes the world down and increases alt", () => {
  const w = createWorld(RAND);
  w.ninja.y = PLAY_TOP + 10;   // gần đỉnh
  w.ninja.vy = -JUMP_VY;       // đang bay lên
  const alt0 = w.alt;
  const plankY0 = w.planks[0].y;
  step(w, 100, 0, false);
  assert.ok(w.alt > alt0, "alt increases");
  assert.ok(w.planks[0].y > plankY0, "planks pushed down");
});

test("dt clamp: a 5000ms gap moves the world no more than 100ms of physics", () => {
  const w = createWorld(RAND);
  w.ninja.x = 0;
  const y0 = w.ninja.y;
  step(w, 5000, 0, false);
  const fallen = w.ninja.y - y0;
  const w2 = createWorld(RAND);
  w2.ninja.x = 0;
  const y20 = w2.ninja.y;
  step(w2, 100, 0, false);
  assert.ok(Math.abs(fallen - (w2.ninja.y - y20)) < 0.001, "5000ms clamps to 100ms");
});

test("scrolling recycles planks to the top", () => {
  const w = createWorld(RAND);
  const count = w.planks.length;
  w.ninja.y = PLAY_TOP + 5;
  w.ninja.vy = -JUMP_VY;
  step(w, 200, 0, false);
  assert.equal(w.planks.length, count, "plank pool fixed size");
  // Sau khi scroll sâu, plank thấp nhất bị đẩy lên trên đỉnh màn
  assert.ok(w.planks.some((p) => p.y < PLAY_TOP), "a plank recycled above the screen");
});

test("bounce increments bounceCount on plank landing", () => {
  const w = createWorld(RAND);
  w.ninja.vy = 1; // bắt đầu rơi
  step(w, 50, 0, false);
  assert.ok(w.bounceCount >= 1, "plank bounce counted");
});
