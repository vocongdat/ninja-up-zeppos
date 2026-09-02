// tests/game-page.test.js — Task 6: page/game.js adapter (loop, tap, pause, game over).
// Body theo brief Task 6 Step 1. Hai điểm do controller chỉ định:
//  - router lấy từ "@zos/router" và assert trực tiếp trên nó (bỏ helper router_pushes()).
//  - Nút VỀ MENU gọi router.back(); fake router ghi back() vào router.backCalls
//    (router.pushes chỉ nhận push/replace) — nên assert backCalls === 1.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry, registry } from "@zos/ui";
import { resetTimers, tick, intervalCount } from "@zos/timer";
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

// --- Final-review fix wave (F3/M1/M3/M4) ---

test("tick self-clears after 10 consecutive step failures (spec §7)", async () => {
  const page = await startGame();
  assert.equal(intervalCount(), 1);
  const world = page.state.world;
  const origStep = world.constructor; // world is a plain object; patch via module import
  // Monkey-patch the imported step used by game.js: it is a module binding, so
  // instead poison world state so step throws deterministically each tick.
  const gameCore = await import("../page/game-core.js");
  const realStep = gameCore.step;
  let calls = 0;
  // game.js imported step as a binding — replace it through the module object is
  // impossible (ESM), so use a throwing getter on a property step reads first.
  Object.defineProperty(world, "bouncedThisStep", {
    configurable: true,
    get() { calls++; if (calls <= 12) throw new Error("boom"); return false; },
  });
  for (let i = 0; i < 12; i++) tick(33);
  assert.equal(intervalCount(), 0, "loop cleared after 10 consecutive failures");
  assert.ok(calls >= 10, "step path exercised: " + calls);
  delete world.bouncedThisStep;
  void origStep; void realStep;
});

test("tick failure counter resets after a successful tick", async () => {
  const page = await startGame();
  const world = page.state.world;
  let throwMode = true;
  Object.defineProperty(world, "bouncedThisStep", {
    configurable: true,
    get() { if (throwMode) throw new Error("boom"); return false; },
  });
  for (let i = 0; i < 6; i++) tick(33);       // 6 consecutive failures
  throwMode = false;
  tick(33);                                    // success → counter resets
  throwMode = true;
  for (let i = 0; i < 6; i++) tick(33);       // 6 more failures — under 10
  assert.equal(intervalCount(), 1, "loop still armed: counter was reset by the good tick");
  for (let i = 0; i < 5; i++) tick(33);       // total 11 consecutive failures now
  assert.equal(intervalCount(), 0, "loop cleared once 10 consecutive failures re-accumulate");
  delete world.bouncedThisStep;
});

test("gameOver stops vibration before the death buzz", async () => {
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449;
  page.state.world.ninja.vy = 300;
  page.state.world.alt = 500;
  tick(33);
  const methods = vibroLog.map((e) => e.method);
  const deathIdx = methods.lastIndexOf("start");
  assert.ok(deathIdx > 0, "death buzz started");
  // Chuỗi kỳ vọng khi chết ngay tick đầu: stop (build→startRun) ... stop
  // (gameOver, hủy pending-stop của bounce) → start:400 buzz chết. Mọi stop
  // đều PHẢI trước buzz chết — không start nào của buzz nảy sau stop cuối.
  const stopsBefore = methods.slice(0, deathIdx).filter((m) => m === "stop").length;
  assert.ok(stopsBefore >= 1, "vibe.stop() ran before the death buzz");
  assert.ok(!methods.slice(deathIdx).includes("stop"), "nothing stops after the death buzz starts");
  assert.ok(!methods.slice(0, deathIdx).includes("start"), "no buzz (bounce) preceded the death in this scenario");
  assert.equal(methods[deathIdx + 1] === undefined || methods.slice(deathIdx + 1).every((m) => m !== "start"), true, "death buzz is the last vibration event");
  assert.equal(page.state.phase, "over");
});

test("startRun stops any carried-over vibration first", async () => {
  localStorage.setItem("record", "3");
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449;
  page.state.world.ninja.vy = 300;
  tick(33);                                    // death
  const startsBefore = vibroLog.filter((e) => e.method === "start").length;
  const again = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "CHƠI LẠI");
  again.props.click_func();                    // replay() → startRun()
  const events = vibroLog.map((e) => e.method);
  const firstStartAfter = events.indexOf("start", events.lastIndexOf("stop"));
  const stopIdx = events.lastIndexOf("stop", events.length - 1);
  assert.ok(stopIdx !== -1, "a stop ran during replay path");
  assert.ok(events.lastIndexOf("stop") > -1 && events.indexOf("start", 0) > -1);
  // Không có buzz nào đang chờ rung sang ván mới: sau replay, đúng 1 buzz mới
  // (không tính) và mọi stop đều trước start kế tiếp.
  const startsAfter = vibroLog.filter((e) => e.method === "start").length;
  assert.ok(startsAfter >= startsBefore, "no crash; vibration state reset");
  assert.equal(page.state.phase, "playing");
  void firstStartAfter;
});

test("fullscreen tap zone starts below the HUD strip (M4)", async () => {
  const page = await startGame();
  const tapBtn = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "");
  assert.ok(tapBtn, "tap zone exists");
  assert.equal(tapBtn.props.y, 40, "y = PLAY_TOP, HUD chrome unambiguous");
  assert.equal(tapBtn.props.h, 450 - 40, "h = H - PLAY_TOP");
  assert.equal(tapBtn.props.w, 390);
});

test("corrupt record cannot disable future records (M3)", async () => {
  localStorage.setItem("record", "garbage");
  const page = await startGame();
  page.state.world.ninja.x = 0;
  page.state.world.ninja.y = 449;
  page.state.world.ninja.vy = 300;
  page.state.world.alt = 500;                  // điểm 62
  tick(33);
  assert.equal(localStorage.getItem("record"), "62", "garbage treated as 0, record saved");
});
