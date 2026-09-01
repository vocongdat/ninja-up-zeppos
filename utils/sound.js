// utils/sound.js — TonePlayer wrapper, best-effort: mọi lỗi nuốt.
// Một instance dùng chung (docs Zepp: instance mới huỷ instance cũ) —
// chuỗi stop → prepare → start cho mỗi âm.
import { TonePlayer } from "@zos/media";
import { localStorage } from "@zos/storage";

const KEY = "settings";

function readSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function createSound() {
  let player = null;
  function ensure() {
    if (player === null) player = new TonePlayer();
    return player;
  }
  // Chuỗi chuẩn cho 1 âm: stop cũ → prepare file → start.
  function play(file) {
    try {
      const p = ensure();
      p.stop();
      if (!p.prepare({ file })) return;
      p.start();
    } catch (e) { /* âm là phụ: không bao giờ giết game loop */ }
  }
  function muted(kind) {
    const s = readSettings();
    return kind === "sfx" ? !!s.muteSfx : !!s.muteMusic;
  }
  return {
    bounce() { if (!muted("sfx")) play("bounce.wav"); },
    death() { if (!muted("sfx")) play("death.wav"); },
    startMusic() { if (!muted("music")) play("music.wav"); },
    stopMusic() {
      try { if (player) player.stop(); } catch (e) {}
    },
    release() {
      try { if (player) player.release(); } catch (e) {}
      player = null;
    },
  };
}
