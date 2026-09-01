// tests/game-page.test.js — Task 6: page/game.js adapter (loop, tap, pause, game over).
// Body theo brief Task 6 Step 1. Hai điểm do controller chỉ định:
//  - router lấy từ "@zos/router" và assert trực tiếp trên nó (bỏ helper router_pushes()).
//  - Nút VỀ MENU gọi router.back(); fake router ghi back() vào router.backCalls
//    (router.pushes chỉ nhận push/replace) — nên assert backCalls === 1.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry, registry } from "@zos/ui";
import { resetTimers, tick, intervalCount, pendingCount } from "@zos/timer";
import { resetStorage, localStorage } from "@zos/storage";
import { resetMedia, mediaLog } from "@zos/media";
import { resetVibro, vibroLog } from "@zos/settings";
import { router, resetRouter } from "@zos/router";

let captured;
globalThis.Page = (obj) => { captured = obj; };

beforeEach(() => {
  resetRegistry(); resetTimers(); resetStorage(); resetMedia(); resetVibro(); resetRouter();
  captured = undefined;
});

async function loadGame() {
  const url = new URL("../page/game.js", import.meta.url).href;
  await import(url + "?v=" + Math.random());
  return captured;
}

async function startGame() {
  const page = await loadGame();
  page.onInit();
  page.build();
  return page;
}

test("build creates the widget pool once, no timers yet", async () => {
  const page = await startGame();
  assert.ok(hmUI.live().length > 10, "pool built: " + hmUI.live().length);
  assert.equal(intervalCount(), 1, "game interval armed");
  assert.equal(page.state.phase, "playing");
});

test("tick advances physics: ninja falls when off plank", async () => {
  const page = await startGame();
  page.state.world.ninja.x = 0; // rơi tự do
  const y0 = page.state.world.ninja.y;
  tick(33);
  assert.ok(page.state.world.ninja.y > y0);
});

test("tap handler queues, next tick applies jump", async () => {
  const page = await startGame();
  const tapBtn = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "");
  assert.ok(tapBtn, "invisible fullscreen tap zone exists");
  tapBtn.props.click_func();
  assert.equal(page.state.tapQueued, true);
  tick(33);
  assert.equal(page.state.tapQueued, false);
  assert.equal(page.state.world.ninja.vy, -420);
});

test("death by falling renders game over overlay and stores record", async () => {
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449; // sát đáy
  page.state.world.ninja.vy = 300;
  page.state.world.alt = 500;     // điểm 62
  tick(33);
  assert.equal(page.state.phase, "over");
  assert.equal(localStorage.getItem("record"), "62");
  // Overlay là widget tạo SAU khi loop dừng — hợp lệ vì loop đã clear.
  const texts = hmUI.live().filter((w) => w.type === "TEXT").map((w) => w.props.text);
  assert.ok(texts.some((t) => t.includes("62")));
});

test("record is not overwritten by a worse score", async () => {
  localStorage.setItem("record", "999");
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449;
  page.state.world.ninja.vy = 300;
  tick(33);
  assert.equal(localStorage.getItem("record"), "999");
});

test("onPause stops the loop; onResume resumes into pause overlay", async () => {
  const page = await startGame();
  assert.equal(intervalCount(), 1);
  page.onPause();
  assert.equal(intervalCount(), 0);
  assert.equal(page.state.phase, "paused");
  page.onResume();
  // Vào pause overlay, không tự chơi tiếp
  assert.equal(intervalCount(), 0);
  assert.equal(page.state.phase, "paused");
  const texts = hmUI.live().filter((w) => w.type === "TEXT").map((w) => w.props.text);
  assert.ok(texts.some((t) => t.includes("Tạm dừng")));
});

test("pause overlay tap resumes the game", async () => {
  const page = await startGame();
  page.onPause();
  page.onResume();
  const resume = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "Chơi tiếp");
  resume.props.click_func();
  assert.equal(page.state.phase, "playing");
  assert.equal(intervalCount(), 1);
});

test("game over: PLAY AGAIN resets in-page, MENU pushes back", async () => {
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.vy = 300;
  page.state.world.ninja.y = 449;
  tick(33);
  const again = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "CHƠI LẠI");
  assert.ok(again, "replay button exists");
  again.props.click_func();
  assert.equal(page.state.phase, "playing");
  assert.ok(page.state.world.dead === false);
  assert.ok(intervalCount() === 1);
  // MENU button: toMenu() gọi router.back() — fake ghi vào backCalls, còn
  // pushes chỉ nhận push/replace nên phải giữ nguyên 0.
  const menu = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "VỀ MENU");
  menu.props.click_func();
  assert.equal(router.backCalls, 1, "VỀ MENU quay lại menu bằng router.back");
  assert.equal(router.pushes.length, 0, "không push trang mới (back chứ không phải push)");
});

test("no widgets created while frozen (teardown discipline)", async () => {
  const page = await startGame();
  page.onDestroy();
  assert.equal(intervalCount(), 0);
  registry.frozen = true;
  registry.frozenLabel = "destroyed";
  // Tick sau teardown: không được tạo widget mới
  const before = registry.createsWhileFrozen.length;
  tick(33);
  assert.equal(registry.createsWhileFrozen.length, before);
  registry.frozen = false;
});

test("sound: bounce sound on landing, death sound on death", async () => {
  const page = await startGame();
  page.state.world.ninja.vy = 1;
  tick(33);                       // chạm plank → bounce sound
  assert.ok(mediaLog.some((e) => e.method === "start" && e.file === "bounce.wav"));
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449;
  page.state.world.ninja.vy = 300;
  tick(33);
  assert.ok(mediaLog.some((e) => e.method === "start" && e.file === "death.wav"));
  assert.ok(vibroLog.some((e) => e.method === "start" && e.arg.period === 400));
});
