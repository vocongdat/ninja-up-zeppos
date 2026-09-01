// page/draw.js — build sprite pool MỘT lần; apply() mỗi tick chỉ setProperty.
// KHÔNG BAO GIỜ createWidget/deleteWidget trong apply() — pool cố định, các
// slot thừa chỉ bị ẩn (VISIBLE=false) hoặc đẩy ra ngoài màn.
//
// Deviation so với draft brief (controller ruling 1): ninja là MỘT IMG duy
// nhất, đổi SOURCE giữa ninja-a/ninja-b theo world.bounceCount (core tăng mỗi
// lần nảy) — thay vì 2 IMG ninja tạo sẵn. Frame đổi bằng setProperty(SOURCE)
// nên không cần widget thứ hai.
//
// Nền: band 0 mặc định "bg-dusk.png". apply() đổi SOURCE sang bg-sunset/
// bg-night theo score band mốc 10/20 M (Task 8) trên cả 2 IMG nền, mỗi set
// một try riêng.
import { W, H, img, text, FONT, COLOR } from "./ui.js";
import {
  TOWER_X, TOWER_W, PLAY_TOP, NINJA_W, NINJA_H, SHURIKEN_W, SHURIKEN_H,
  PLANK_W, PLANK_H, scoreOf,
} from "./game-core.js";

const PLANK_POOL = 5;
const SHURIKEN_POOL = 3;
const SPIN_MS = 125; // shuriken spin 8Hz: chu kỳ 125ms chia 2 frame
const NINJA_FRAMES = ["ninja-a.png", "ninja-b.png"];
const SHURIKEN_FRAMES = ["shuriken-a.png", "shuriken-b.png"];
const OFFSCREEN = -100; // slot pool chưa dùng: đẩy ra ngoài màn

export function buildSprites() {
  const s = { overlay: [] }; // overlay là mảng thật: page/game.js push widget game over vào

  // Nền: 2 IMG chồng dọc cùng PNG cao H; scroll = đổi Y modulo H.
  s.bg = [
    img({ x: 0, y: 0, w: W, h: H, src: "bg-dusk.png" }),
    img({ x: 0, y: H, w: W, h: H, src: "bg-dusk.png" }),
  ];

  // Tháp giàn gỗ: 2 IMG full-height, tĩnh suốt ván.
  s.towers = [
    img({ x: TOWER_X[0], y: 0, w: TOWER_W, h: H, src: "tower.png" }),
    img({ x: TOWER_X[1], y: 0, w: TOWER_W, h: H, src: "tower.png" }),
  ];

  // HUD: dải nền 40px + text điểm (ninja không bao giờ bay vào dải này).
  s.hudBg = img({ x: 0, y: 0, w: W, h: PLAY_TOP, src: "hudbg.png" });
  s.hudText = text({ x: 8, y: 6, w: 200, size: FONT.section, color: COLOR.hud, text: "0 M" });

  // Pool plank: 5 slot cố định, slot không dùng nằm ngoài màn.
  s.planks = [];
  for (let i = 0; i < PLANK_POOL; i++) {
    s.planks.push(img({ x: OFFSCREEN, y: OFFSCREEN, w: PLANK_W, h: PLANK_H, src: "plank.png" }));
  }

  // Pool shuriken: 3 slot cố định + frame quay 8Hz đổi bằng SOURCE.
  s.shurikens = [];
  for (let i = 0; i < SHURIKEN_POOL; i++) {
    s.shurikens.push(img({ x: OFFSCREEN, y: OFFSCREEN, w: SHURIKEN_W, h: SHURIKEN_H, src: SHURIKEN_FRAMES[0] }));
  }

  // Ninja: 1 IMG, frame A/B đổi bằng SOURCE theo số lần nảy.
  s.ninja = img({ x: OFFSCREEN, y: OFFSCREEN, w: NINJA_W, h: NINJA_H, src: NINJA_FRAMES[0] });

  return s;
}

// Mỗi call chỉ setProperty. nowMs tuỳ chọn (game.js luôn truyền Date.now());
// khi không có, lấy hiện tại — đủ cho test gọi apply(s, world) 2 tham số.
// world.bounceCount (core tăng ở cả nảy plank lẫn tap) chọn frame ninja.
export function apply(s, world, nowMs) {
  const ms = nowMs === undefined ? Date.now() : nowMs;

  // Nền scroll theo alt: Y = -(alt % H); IMG thứ hai nối tiếp phía dưới.
  // Mỗi IMG một try riêng: 1 nền chết không chặn nền còn lại.
  const off = world.alt % H;
  try { s.bg[0].setProperty("Y", Math.floor(-off)); } catch (e) {}
  try { s.bg[1].setProperty("Y", Math.floor(H - off)); } catch (e) {}

  // HUD điểm theo mét.
  try { s.hudText.setProperty("TEXT", scoreOf(world) + " M"); } catch (e) {}

  // Nền 3 band theo điểm (spec: chiều → hoàng hôn → đêm sao). Task 8.
  // KHÔNG guard getProperty để bỏ qua set trùng giá trị: setProperty với cùng
  // giá trị vô hại trên máy thật, pool chỉ 2 widget. Mỗi set một try riêng —
  // 1 nền chết không chặn nền còn lại đổi band (đúng pattern của 2 lệnh Y trên).
  const band = scoreOf(world) < 10 ? "bg-dusk.png" : scoreOf(world) < 20 ? "bg-sunset.png" : "bg-night.png";
  try { s.bg[0].setProperty("SOURCE", band); } catch (e) {}
  try { s.bg[1].setProperty("SOURCE", band); } catch (e) {}

  // Planks: 5 slot; world.planks có thể ít hơn pool (slot thừa ẩn).
  for (let i = 0; i < s.planks.length; i++) {
    const p = world.planks[i];
    const wgt = s.planks[i];
    try {
      if (p) {
        wgt.setProperty("X", Math.floor(p.x));
        wgt.setProperty("Y", Math.floor(p.y));
        // Slot còn ẩn (hoặc chưa từng set VISIBLE) → hiện lên, chỉ set 1 lần.
        if (wgt.getProperty("VISIBLE") !== true) wgt.setProperty("VISIBLE", true);
      } else if (wgt.getProperty("VISIBLE") !== false) {
        wgt.setProperty("VISIBLE", false);
      }
    } catch (e) { /* 1 widget chết không giết tick */ }
  }

  // Shurikens: 3 slot + frame quay 8Hz.
  const spinFrame = Math.floor(ms / SPIN_MS) % 2;
  for (let i = 0; i < s.shurikens.length; i++) {
    const sh = world.shurikens[i];
    const wgt = s.shurikens[i];
    try {
      if (sh) {
        wgt.setProperty("X", Math.floor(sh.x));
        wgt.setProperty("Y", Math.floor(sh.y));
        wgt.setProperty("SOURCE", SHURIKEN_FRAMES[spinFrame]);
        // Slot còn ẩn (hoặc chưa từng set VISIBLE) → hiện lên, chỉ set 1 lần.
        if (wgt.getProperty("VISIBLE") !== true) wgt.setProperty("VISIBLE", true);
      } else if (wgt.getProperty("VISIBLE") !== false) {
        wgt.setProperty("VISIBLE", false);
      }
    } catch (e) { /* 1 widget chết không giết tick */ }
  }

  // Ninja: vị trí + frame A/B theo bounceCount % 2.
  try {
    s.ninja.setProperty("X", Math.floor(world.ninja.x));
    s.ninja.setProperty("Y", Math.floor(world.ninja.y));
    s.ninja.setProperty("SOURCE", NINJA_FRAMES[(world.bounceCount || 0) % 2]);
  } catch (e) { /* 1 widget chết không giết tick */ }
}
