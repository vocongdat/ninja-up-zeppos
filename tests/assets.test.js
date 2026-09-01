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

// Fix round 1 (review CRITICAL): test trước đây chỉ kiểm magic "RIFF" — nó đã
// bỏ qua lỗi ghi lệch offset fmt chunk (blockAlign ở 34 thay vì 32,
// bitsPerSample ở 35 thay vì 34) khiến blockAlign=0 / bitsPerSample=2049 và
// CoreAudio từ chối mọi WAV. Parse header từ bytes: PCM 8-bit 8kHz mono,
// data chunk đúng bằng phần còn lại của file.
test("wav headers parse as PCM 8-bit 8kHz mono with correct chunk sizes", () => {
  for (const f of ["bounce.wav", "death.wav", "music.wav"]) {
    const buf = readFileSync(join(root, "assets", f));
    assert.equal(buf.toString("ascii", 8, 12), "WAVE", f + " WAVE");
    assert.equal(buf.toString("ascii", 12, 16), "fmt ", f + " fmt chunk");
    assert.equal(buf.readUInt32LE(16), 16, f + " fmt chunk size = 16 (PCM)");
    assert.equal(buf.readUInt16LE(20), 1, f + " audio format = PCM");
    assert.equal(buf.readUInt16LE(22), 1, f + " channels = 1 (mono)");
    assert.equal(buf.readUInt32LE(24), 8000, f + " sample rate = 8000");
    assert.equal(buf.readUInt32LE(28), 8000, f + " byte rate = 8000 (8000 × 1 ch × 1 byte)");
    assert.equal(buf.readUInt16LE(32), 1, f + " block align = 1 byte");
    assert.equal(buf.readUInt16LE(34), 8, f + " bits per sample = 8");
    assert.equal(buf.toString("ascii", 36, 40), "data", f + " data chunk");
    assert.equal(buf.readUInt32LE(40), buf.length - 44, f + " data size = file size - 44");
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

// Fix round 1 (review IMPORTANT): ninja-a/ninja-b trước đây byte-identical
// (các rect chân phủ cùng một union pixel) → animation 2 frame là no-op.
// Hai file PNG phải khác nhau thật sự.
test("ninja-a.png and ninja-b.png are different frames", () => {
  const a = readFileSync(join(root, "assets", "ninja-a.png"));
  const b = readFileSync(join(root, "assets", "ninja-b.png"));
  assert.notEqual(a.length, 0);
  assert.notEqual(b.length, 0);
  assert.notEqual(Buffer.compare(a, b), 0, "ninja-a.png must differ from ninja-b.png");
});
