// page/game.js — adapter duy nhất chạm Zeitgeber: setInterval + setProperty + tap.
// Logic game nằm hết ở game-core.js (pure); file này KHÔNG chứa physics.
import hmUI from "@zos/ui";
import { router } from "@zos/router";
import { setInterval, clearInterval } from "@zos/timer";
import { localStorage } from "@zos/storage";
import { createWorld, step, scoreOf, PLAY_TOP } from "./game-core.js";
import { W, H, TICK_MS, COLOR, FONT, fillBackground, text, button } from "./ui.js";
import { buildSprites, apply } from "./draw.js";
import { createSound } from "../utils/sound.js";
import { createVibe } from "../utils/vibe.js";

const RECORD_KEY = "record";

Page(
  (function () {
    // sound/vibe giữ module-level qua IIFE: chúng là thiết bị, không phải state ván.
    let sound = null, vibe = null;

    return {
      state: { world: null, timer: null, phase: "playing", tapQueued: false, lastTickMs: 0, sprites: null, failStreak: 0 },

      onInit() {
        this.state.world = null;
        this.state.phase = "playing";
        this.state.tapQueued = false;
        sound = createSound();
        vibe = createVibe();
      },

      build() {
        fillBackground();
        this.state.sprites = buildSprites();   // 1 lần, gồm cả HUD + nền 2 IMG + tháp + planks + shurikens + ninja
        this.mountTapZone();
        this.mountMenuButton();
        this.startRun();
      },

      // Vùng chạm full-screen trong suốt: cổng vào duy nhất của người chơi.
      // Handler KHÔNG đụng physics — chỉ đặt cờ, tick kế tiếp tiêu thụ.
      // Bắt đầu tại y = PLAY_TOP: dải HUD 40px trên cùng là chrome (nút VỀ
      // MENU nằm đó, không bị tap zone dưới lấn).
      mountTapZone() {
        button({
          x: 0, y: PLAY_TOP, w: W, h: H - PLAY_TOP,
          text: "",
          onClick: () => { this.state.tapQueued = true; },
        });
      },

      // Nút VỀ MENU là chrome cố định của page (tạo 1 lần trong build, KHÔNG
      // nằm trong overlay): nó phải sống sót qua replay() — test contract
      // "PLAY AGAIN resets in-page, MENU pushes back" tìm thấy nó sau khi
      // chơi lại. Tạo SAU tap zone để nằm trên nó (clickable trên máy thật)
      // trong dải HUD 40px — nơi ninja không bao giờ bay vào.
      mountMenuButton() {
        button({
          x: W - 78, y: 5, w: 70, h: 30, text: "VỀ MENU", size: FONT.small,
          onClick: () => this.toMenu(),
        });
      },

      // Một ván mới: reset world + widgets về vị trí đầu (KHÔNG push page mới).
      // vibe.stop() TRƯỚC TIÊN: buzz chết của ván trước không được trôi sang
      // ván mới (kể cả qua replay()).
      startRun() {
        vibe.stop();
        this.state.world = createWorld(Math.random);
        this.state.tapQueued = false;
        this.state.failStreak = 0;
        this.state.lastTickMs = Date.now();
        apply(this.state.sprites, this.state.world, this.state.lastTickMs);
        sound.startMusic();
        this.armLoop();
      },

      armLoop() {
        this.clearLoop();
        this.state.timer = setInterval(() => this.tick(), TICK_MS);
      },

      clearLoop() {
        if (this.state.timer !== null) {
          try { clearInterval(this.state.timer); } catch (e) {}
          this.state.timer = null;
        }
      },

      tick() {
        if (this.state.phase !== "playing") return;
        const now = Date.now();
        const rawDt = now - this.state.lastTickMs;
        // dt = Date.now() - lastTickMs, sàn 1 frame: setInterval trên máy thật
        // có thể bắn sớm/jitter, còn harness đồng hồ ảo kéo tick(33) mà
        // Date.now() gần như không trôi — mỗi lần bắn interval được coi là
        // tối thiểu đúng 1 frame. Physics vẫn mượt vì core tự kẹp trần 100ms.
        const dt = rawDt < TICK_MS ? TICK_MS : rawDt;
        this.state.lastTickMs = now;
        const world = this.state.world;
        const wantTap = this.state.tapQueued;
        this.state.tapQueued = false;
        // Spec §7: 10 tick lỗi liên tiếp (step hoặc apply ném) → tự clearLoop
        // (chết êm thay vì treo pin); một tick thành công reset bộ đếm.
        let failed = false;
        try {
          step(world, dt, now, wantTap);
        } catch (e) { failed = true; /* core không được ném */ }
        // world.bouncedThisStep là STICKY (core set, không tự clear): đọc xong
        // phải xoá ngay, nếu không mọi tick sau đều kêu lại âm/rung. Đọc qua
        // try riêng: getter chết cũng chỉ là 1 tick lỗi, không giết tick.
        try {
          if (world.bouncedThisStep) {
            world.bouncedThisStep = false;
            sound.bounce();
            vibe.bounce();
          }
        } catch (e) { failed = true; }
        try {
          apply(this.state.sprites, world, now);
        } catch (e) { failed = true; /* 1 widget chết không giết tick */ }
        this.state.failStreak = failed ? this.state.failStreak + 1 : 0;
        if (this.state.failStreak >= 10) {
          this.clearLoop();
          this.state.failStreak = 0;
          return;
        }
        if (world.dead) this.gameOver();
      },

      gameOver() {
        this.clearLoop();
        sound.stopMusic();
        // vibe.stop() TRƯỚC vibe.death(): hủy pending-stop của buzz nảy (100ms)
        // — nếu không nó bắn giữa buzz chết và cắt buzz 400ms sớm.
        vibe.stop();
        sound.death();
        vibe.death();
        this.state.phase = "over";
        this.saveRecord();
        this.renderGameOver();
      },

      saveRecord() {
        const score = scoreOf(this.state.world);
        try {
          const raw = localStorage.getItem(RECORD_KEY);
          // Mirror menu.js readRecord: giá trị hỏng/không dương coi như 0 —
          // kỷ lục hỏng không được phép vô hiệu hóa các kỷ lục sau này.
          const n = raw === null ? 0 : Number(raw);
          const prev = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
          if (score > prev) localStorage.setItem(RECORD_KEY, String(score));
        } catch (e) { /* kỷ lục là phụ, không giết game over */ }
      },

      renderGameOver() {
        const score = scoreOf(this.state.world);
        const raw = localStorage.getItem(RECORD_KEY);
        const record = raw === null ? 0 : Number(raw);
        const isRecord = score >= record && score > 0;
        this.overlay(text({ x: 0, y: 150, w: W, size: FONT.display, align: "center", text: score + " M" }));
        this.overlay(text({
          x: 0, y: 220, w: W, size: FONT.section, align: "center",
          color: isRecord ? COLOR.accent : COLOR.sub,
          text: isRecord ? "KỶ LỤC MỚI!" : "Kỷ lục: " + record + " M",
        }));
        this.overlay(button({
          x: 45, y: 280, w: 300, h: 56, text: "CHƠI LẠI", size: FONT.title,
          normalColor: COLOR.accent, pressColor: COLOR.cardPress, textColor: 0x062b18,
          onClick: () => this.replay(),
        }));
        this.overlay(button({ x: 45, y: 350, w: 300, h: 44, text: "VỀ MENU", onClick: () => this.toMenu() }));
      },

      replay() {
        // Xoá overlay (các widget overlay đã track) rồi startRun lại trong cùng page.
        this.clearOverlay();
        this.state.phase = "playing";
        this.startRun();
      },

      toMenu() {
        this.clearLoop();
        vibe.stop();
        sound.stopMusic();
        router.back();
      },

      onPause() {
        // Issue 02 bug class: push() không destroy page — loop phải dừng ở đây.
        this.clearLoop();
        vibe.stop();
        sound.stopMusic();
        if (this.state.phase === "playing") {
          this.state.phase = "paused";
          this.renderPause();
        }
      },

      onResume() {
        // Không tự chơi tiếp: hiện pause overlay, đợi tap "Chơi tiếp".
        if (this.state.phase === "paused") this.renderPause();
      },

      renderPause() {
        this.overlay(text({ x: 0, y: 160, w: W, size: FONT.title, align: "center", text: "Tạm dừng" }));
        this.overlay(button({
          x: 45, y: 220, w: 300, h: 56, text: "Chơi tiếp", size: FONT.title,
          onClick: () => this.resumeGame(),
        }));
        this.overlay(button({ x: 45, y: 290, w: 300, h: 44, text: "VỀ MENU", onClick: () => this.toMenu() }));
      },

      resumeGame() {
        this.clearOverlay();
        this.state.phase = "playing";
        this.state.lastTickMs = Date.now();
        this.armLoop();
      },

      overlay(widget) {
        this.state.sprites.overlay.push(widget);
        return widget;
      },

      clearOverlay() {
        // Widgets overlay được push vào sprites.overlay; xoá từng cái một.
        for (const w of this.state.sprites.overlay) {
          try { hmUI.deleteWidget(w); } catch (e) {}
        }
        this.state.sprites.overlay.length = 0;
      },

      onDestroy() {
        this.clearLoop();
        vibe.stop();
        sound.stopMusic();
        sound.release();
      },
    };
  })()
);
