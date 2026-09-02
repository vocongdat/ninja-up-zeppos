// tools/gen-assets.js — Task 8: sinh toàn bộ binary assets của Ninja Up bằng
// Node builtin thuần (zlib), KHÔNG npm install. Chạy: `node tools/gen-assets.js`.
// Output: assets/*.png (4-bit palette), assets/*.wav (PCM 8-bit 8kHz mono),
// icon.png (root — app.json tham chiếu "icon": "icon.png" ở root).
//
// Script PHẢI deterministic: mọi "ngẫu nhiên" đi qua LCG seed cố định
// (LCG32, hạt giống 0x5EED1A2F) — chạy lại cho ra byte-for-byte giống nhau.
//
// Màu dưới mirror page/ui.js COLOR (re-declare có chủ ý: ui.js import @zos/ui
// ở module top-level nên không thể require từ script Node thuần).
const COLOR = {
  tower: 0xd9a545,
  towerDark: 0x8a6a20,
  plank: 0xc08a2e,
  ninja: 0x3ddc84,
  shuriken: 0xcfd8dc,
  hudBg: 0x4fc3f7,
};

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(root, "assets");
const W = 390, H = 450;

// ---------- CRC32 (hand-rolled) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// ---------- PNG RGBA 8-bit encoder ----------
// Vì sao RGBA 8-bit chứ không phải 4-bit palette: máy đích Bip 6 render được
// chắc chắn RGBA (bản CampMate chạy tốt dùng RGBA 8-bit qua build), còn docs
// IMG widget khuyên "24-bit or 32-bit png with RGB or RGBA". 4-bit palette
// (colorType 3) là dạng doc không nhắc đến — và các .zab build trước nó bị
// màn đen trên máy thật. PNG ở đây tự encode tay (zlib builtin, không PIL):
// mỗi pixel 4 byte RGBA, alpha 255 đặc / 0 trong suốt, filter 0 (None).
function png(width, height, palette, alphaIndex, pixelRows) {
  const bpl = width * 4; // 8 bit/pixel × 4 kênh RGBA
  const raw = Buffer.alloc((bpl + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter 0 (None)
    const row = pixelRows[y];
    for (let x = 0; x < width; x++) {
      const c = palette[row[x] & 0xff] >>> 0;
      raw[p++] = (c >> 16) & 0xff;
      raw[p++] = (c >> 8) & 0xff;
      raw[p++] = c & 0xff;
      raw[p++] = alphaIndex !== null && row[x] === alphaIndex ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    // sRGB + gAMA để viewer chuẩn màu; device bỏ qua cũng chẳng sao.
    chunk("gAMA", (() => { const b = Buffer.alloc(4); b.writeUInt32BE(45455, 0); return b; })()),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat(parts);
}

// ---------- LCG seed cố định (deterministic) ----------
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function blank(width, height, fill) {
  return Array.from({ length: height }, () => new Array(width).fill(fill));
}
function rect(rows, x0, y0, w, h, idx) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= rows.length) continue;
    for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < rows[y].length) rows[y][x] = idx;
  }
}
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function mix(c1, c2, t) {
  return (
    ((lerp((c1 >> 16) & 0xff, (c2 >> 16) & 0xff, t) & 0xff) << 16) |
    ((lerp((c1 >> 8) & 0xff, (c2 >> 8) & 0xff, t) & 0xff) << 8) |
    lerp(c1 & 0xff, c2 & 0xff, t)
  ) >>> 0;
}

// ---------- Bg: gradient dọc + mây (dusk) / sao (night) ----------
const SKY = {
  dusk: { top: 0x7ec0ee, bot: 0xc8e6f9, cloud: 0xffffff, cloudShade: 0xe4f1fb },
  sunset: { top: 0xf2984c, bot: 0xffd9a0, cloud: 0xffe9c9, cloudShade: 0xf7b677 },
  night: { top: 0x10122b, bot: 0x232a4d, cloud: 0x2c3560, cloudShade: 0x1a2040 },
};

function bgPng(kind) {
  const k = SKY[kind];
  // Palette: sky top / sky mid / sky bot / cloud / cloud shade. Mỗi PNG ≤16 màu.
  const palette = [k.top, mix(k.top, k.bot, 0.5), k.bot, k.cloud, k.cloudShade];
  const rows = blank(W, H, 0);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const idx = t < 0.5 ? (t < 0.25 ? 0 : 1) : 2;
    for (let x = 0; x < W; x++) rows[y][x] = idx;
  }
  // Gradient 4 bậc đủ mượt ở scale này nhưng thêm 1 bậc mịn: chuyển màu dần
  // theo dải bằng cách mix — đơn giản hoá: dùng 3 palette index theo t.
  const rand = lcg(0x5EED1A2F);
  if (kind === "night") {
    // Sao: pixel 2×2 trắng, đặt deterministic qua LCG.
    const starIdx = palette.length;
    palette.push(0xffffff);
    for (let i = 0; i < 40; i++) {
      const x = 2 + Math.floor(rand() * (W - 6)) & ~1;
      const y = 4 + Math.floor(rand() * (H - 8)) & ~1;
      rect(rows, x, y, 2, 2, starIdx);
    }
  } else {
    // Mây: block bo góc 30×12, vài cụm mỗi bg.
    const cloudIdx = palette.length, shadeIdx = palette.length + 1;
    palette.push(k.cloud, k.cloudShade);
    for (let i = 0; i < 4; i++) {
      const cx = Math.floor(rand() * (W - 34));
      const cy = 60 + Math.floor(rand() * (H - 140));
      rect(rows, cx + 2, cy, 26, 12, cloudIdx);
      rect(rows, cx, cy + 2, 30, 8, cloudIdx);
      rect(rows, cx + 2, cy + 10, 26, 2, shadeIdx);
    }
  }
  return png(W, H, palette, null, rows);
}

// ---------- Tower: giàn gỗ 70×450, nền trong suốt ----------
function towerPng() {
  // idx 0 = transparent (tRNS), 1 = tower, 2 = towerDark.
  const palette = [0x000000, COLOR.tower, COLOR.towerDark];
  const rows = blank(70, 450, 0);
  for (let y = 0; y < 450; y++) {
    rect(rows, 0, y, 8, 1, 1);        // cột trái
    rect(rows, 62, y, 8, 1, 1);       // cột phải
    // Chữ X: chéo 4px lặp dọc mỗi 24px. Trên pixel y, vẽ 2 chéo của khung
    // [y0, y0+24): chéo xuống = x theo y-y0, chéo lên = x theo (y0+24)-y.
    const seg = y % 24, y0 = Math.floor(y / 24) * 24;
    const span = 62 - 8 - 4; // giữa 2 cột, chừa mép
    const downX = 8 + 2 + Math.floor((seg / 24) * span);
    const upX = 8 + 2 + Math.floor(((24 - seg) / 24) * span);
    rect(rows, downX, y, 4, 1, 2);
    rect(rows, upX, y, 4, 1, 2);
  }
  return png(70, 450, palette, 0, rows);
}

// ---------- Hudbg: 390×40 đặc ----------
function hudbgPng() {
  const rows = blank(W, 40, 1);
  return png(W, 40, [0x000000, COLOR.hudBg], null, rows);
}

// ---------- Plank: 54×6 gỗ + viền 1px ----------
function plankPng() {
  const palette = [0x000000, COLOR.plank, COLOR.towerDark];
  const rows = blank(54, 6, 1);
  for (let x = 0; x < 54; x++) { rows[0][x] = 2; rows[5][x] = 2; }
  for (let y = 0; y < 6; y++) { rows[y][0] = 2; rows[y][53] = 2; }
  // Vân gỗ: các đường ngang đứt quãng cố định cho trông "gỗ" (và thêm entropy
  // để IDAT không nén xuống sát 100 byte).
  for (const gy of [2, 4]) {
    for (let x = 2; x < 52; x++) if ((x * 7 + gy * 13) % 3 === 0) rows[gy][x] = 2;
    for (let x = 3; x < 52; x += 5) rows[gy][x] = 1;
  }
  return png(54, 6, palette, null, rows);
}

// ---------- Shuriken 16×16: frame A = X, frame B = + ----------
function shurikenPng(cross) {
  const palette = [0x000000, COLOR.shuriken, 0x8a959e];
  const rows = blank(16, 16, 0);
  for (let i = 2; i < 14; i++) {
    if (cross) { // X: 2 thanh chéo
      rows[i][i] = 1; rows[i][15 - i] = 1;
    } else {     // +: 2 thanh thẳng
      rows[i][7] = 1; rows[i][8] = 1; rows[7][i] = 1; rows[8][i] = 1;
    }
  }
  rect(rows, 6, 6, 4, 4, 2); // tâm đậm 4×4
  return png(16, 16, palette, 0, rows);
}

// ---------- Ninja 28×36: đầu tròn, thân, chân A/B khác nhau ----------
function ninjaPng(frame) {
  // 0 transparent, 1 ninja, 2 khăn đen, 3 ninja tối (viền).
  const palette = [0x000000, COLOR.ninja, 0x101014, mix(COLOR.ninja, 0x000000, 0.35)];
  const rows = blank(28, 36, 0);
  // Đầu tròn 12px: tâm (14, 9), bán kính 6.
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 28; x++) {
      const dx = x - 13.5, dy = y - 8;
      if (dx * dx + dy * dy <= 36) rows[y][x] = 1;
    }
  }
  // Khăn đen: dải ngang qua đầu (trên trán) + 2 dải bay sau đầu.
  rect(rows, 6, 9, 16, 3, 2);
  rect(rows, 2, 10, 4, 2, 2);
  rect(rows, 22, 10, 4, 2, 2);
  // Thân 14×16: từ y=14 đến 30, căn giữa.
  rect(rows, 7, 14, 14, 16, 1);
  // Chân: 2 pose THẬT SỰ khác nhau (fix round 1 — bản trước 2 frame trùng nhau
  // vì các rect leg phủ cùng một vùng pixel). Frame A: chân trái duỗi dài tới
  // y=34, chân phải co ngắn; frame B: ngược lại (trái co, phải duỗi dài) —
  // union pixel của 2 frame khác nhau ở cả 2 bên.
  if (frame === 0) {
    rect(rows, 7, 30, 5, 5, 1);   // chân trái duỗi (y 30..34)
    rect(rows, 17, 32, 4, 3, 1);  // chân phải co (y 32..34)
  } else {
    rect(rows, 7, 32, 5, 3, 1);   // chân trái co (y 32..34)
    rect(rows, 17, 30, 4, 5, 1);  // chân phải duỗi (y 30..34)
  }
  return png(28, 36, palette, 0, rows);
}

// ---------- Icon 96×96: nền tròn xanh + chữ N trắng ----------
function iconPng() {
  // 0 transparent, 1 xanh nền, 2 trắng, 3 xanh đậm viền.
  const palette = [0x000000, 0x2e7d32, 0xffffff, 0x1b5e20];
  const rows = blank(96, 96, 0);
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const dx = x - 47.5, dy = y - 47.5, r = Math.sqrt(dx * dx + dy * dy);
      if (r <= 45) rows[y][x] = r > 42 ? 3 : 1;
    }
  }
  // Chữ "N" trắng: 2 cột dọc + đường chéo, khung 12..84 × 20..76.
  rect(rows, 30, 28, 8, 40, 2);  // cột trái
  rect(rows, 58, 28, 8, 40, 2);  // cột phải
  for (let i = 0; i < 34; i++) rect(rows, 36 + i, 30 + i, 6, 6, 2); // chéo
  return png(96, 96, palette, 0, rows);
}

// ---------- WAV PCM 8-bit 8kHz mono ----------
function wav(samples) {
  const data = Buffer.from(samples);
  const buf = Buffer.alloc(44 + data.length);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);      // fmt chunk size
  buf.writeUInt16LE(1, 20);       // PCM
  buf.writeUInt16LE(1, 22);       // mono
  buf.writeUInt32LE(8000, 24);    // sample rate
  buf.writeUInt32LE(8000, 28);    // byte rate = sampleRate × channels × 1 byte
  buf.writeUInt16LE(1, 32);       // block align = channels × bytes/sample = 1
  buf.writeUInt16LE(8, 34);       // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  return buf;
}
const RATE = 8000;
// PCM 8-bit là unsigned: 128 = im lặng.
function synth(durMs, fn) {
  const n = Math.round((durMs / 1000) * RATE);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = fn(t, i / n);
    out[i] = Math.max(0, Math.min(255, Math.round(128 + v * 127)));
  }
  return out;
}
// Sine sweep f0→f1 với fade-out tuyến tính từ t=fadeStart.
function sweep(durMs, f0, f1, fadeStart, gain = 0.9) {
  return synth(durMs, (t, prog) => {
    const f = f0 + (f1 - f0) * prog;
    const env = prog < fadeStart ? 1 : 1 - (prog - fadeStart) / (1 - fadeStart);
    return Math.sin(2 * Math.PI * f * t) * gain * env;
  });
}
// Music: 8 note pentatonic 120 BPM (mỗi note 300ms), sine + decay envelope.
function music() {
  const PENTA = [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440]; // G4 A4 C5 D5 E5 D5 C5 A4
  const NOTE_MS = 300; // 8 note × 300ms = 2.4s
  const chunks = PENTA.map((f, i) =>
    synth(NOTE_MS, (t, prog) => {
      const decay = Math.exp(-3.5 * prog);
      const second = i % 2 === 1 ? Math.sin(2 * Math.PI * f * 2 * t) * 0.15 : 0;
      return (Math.sin(2 * Math.PI * f * t) + second) * 0.55 * decay;
    })
  );
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  chunks.reduce((off, c) => (out.set(c, off), off + c.length), 0);
  return out;
}

// ---------- Sinh tất cả ----------
mkdirSync(ASSETS, { recursive: true });
const files = {
  "assets/bg-dusk.png": bgPng("dusk"),
  "assets/bg-sunset.png": bgPng("sunset"),
  "assets/bg-night.png": bgPng("night"),
  "assets/tower.png": towerPng(),
  "assets/hudbg.png": hudbgPng(),
  "assets/plank.png": plankPng(),
  "assets/shuriken-a.png": shurikenPng(true),
  "assets/shuriken-b.png": shurikenPng(false),
  "assets/ninja-a.png": ninjaPng(0),
  "assets/ninja-b.png": ninjaPng(1),
  "assets/bounce.wav": wav(sweep(150, 660, 880, 0.55)),
  "assets/death.wav": wav(sweep(300, 220, 60, 0.45)),
  "assets/music.wav": wav(music()),
  "icon.png": iconPng(),
};
for (const [rel, buf] of Object.entries(files)) {
  writeFileSync(join(root, rel), buf);
  console.log(rel.padEnd(24) + buf.length + " bytes");
}

// ---------- Mirror sang assets/bip6/ và assets/bip6-2/ ----------
// zpm 3.4.2 đóng gói asset device CHỈ từ assets/<target>/ (mỗi target một thư
// mục), KHÔNG đọc assets/ gốc. Nếu chỉ sinh assets/ mà quên mirror, .zab ships
// bản cũ của thư mục target — đây chính là nguyên nhân màn hình đen còn sót
// sau 2 vòng fix trước (bản 4-bit palette cũ vẫn nằm trong assets/bip6*/).
for (const target of ["bip6", "bip6-2"]) {
  for (const [rel, buf] of Object.entries(files)) {
    writeFileSync(join(root, "assets", target, rel.replace(/^assets\//, "")), buf);
  }
  console.log(`assets/${target}/ mirrored (${Object.keys(files).length} files)`);
}
