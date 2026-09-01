// tests/assets.test.js — Task 8: kiểm binary assets sinh bởi tools/gen-assets.js.
// Chỉ dùng node builtin (node:test / node:assert / node:fs / node:path /
// node:url): file này đọc file thật từ đĩa, KHÔNG cần fake @zos/*. Harness
// resolver của register.mjs chỉ chặn bare import @zos/* nên giữ builtin thuần
// để bộ test chạy ở mọi môi trường.
//
// Deviation so với brief (controller ruling 3): icon.png nằm ở ROOT repo vì
// app.json tham chiếu "icon": "icon.png" ở root — chỉ riêng đường dẫn của
// icon.png được đổi; danh sách `need` giữ nguyên như brief.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("all sprite PNGs exist and have PNG signature", () => {
  const need = ["bg-dusk.png", "bg-sunset.png", "bg-night.png", "tower.png", "hudbg.png", "plank.png", "shuriken-a.png", "shuriken-b.png", "ninja-a.png", "ninja-b.png", "icon.png"];
  for (const f of need) {
    const p = f === "icon.png" ? join(root, f) : join(root, "assets", f);
    const buf = readFileSync(p);
    assert.ok(buf.length > 100, f + " non-empty");
    assert.deepEqual([...buf.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], f + " PNG signature");
  }
});

test("wav files exist with RIFF header", () => {
  for (const f of ["bounce.wav", "death.wav", "music.wav"]) {
    const buf = readFileSync(join(root, "assets", f));
    assert.ok(buf.length > 1000, f + " non-empty");
    assert.equal(buf.slice(0, 4).toString("ascii"), "RIFF", f + " RIFF");
  }
});

// Bổ sung (additive, không thay 2 test của brief): đọc IHDR kiểm kích thước +
// color type 3 (palette 4-bit) đúng như hợp đồng mà page/draw.js phụ thuộc.
// IHDR nằm sau 8 byte signature + 4 byte length + 4 byte type → offset 16.
test("PNG IHDR declares the sizes draw.js builds widgets for", () => {
  const dims = {
    "assets/bg-dusk.png": [390, 450],
    "assets/bg-sunset.png": [390, 450],
    "assets/bg-night.png": [390, 450],
    "assets/tower.png": [70, 450],
    "assets/hudbg.png": [390, 40],
    "assets/plank.png": [54, 6],
    "assets/shuriken-a.png": [16, 16],
    "assets/shuriken-b.png": [16, 16],
    "assets/ninja-a.png": [28, 36],
    "assets/ninja-b.png": [28, 36],
    "icon.png": [96, 96],
  };
  for (const [f, [w, h]] of Object.entries(dims)) {
    const buf = readFileSync(join(root, f));
    assert.equal(buf.readUInt32BE(16), w, f + " width");
    assert.equal(buf.readUInt32BE(20), h, f + " height");
    assert.equal(buf[25], 3, f + " color type = indexed palette");
    assert.equal(buf[24], 4, f + " bit depth = 4");
  }
});
