// utils/sound.js — TonePlayer wrapper, best-effort: mọi lỗi nuốt.
// HAI instance riêng (final-review finding F2): SFX dùng chung một player với
// chuỗi stop → prepare → start cho mỗi âm; nhạc nền có player RIÊNG vì
// TonePlayer không có chế độ loop — một player dùng chung sẽ để cú nảy đầu tiên
// (chắc chắn xảy ra ≤1 tick sau startMusic) supersede music.wav.
//
// Loop mô phỏng: phát music.wav rồi tự đặt lại bằng setTimeout(MUSIC_LOOP_MS)
// — music.wav dài đúng 2.4s, hằng số ở đây thay vì parse WAV lúc chạy. Mỗi lần
// restart được try/catch và lưu timeout id; stopMusic()/release() hủy nó.
import { TonePlayer } from "@zos/media";
import { localStorage } from "@zos/storage";
import { setTimeout as zSetTimeout, clearTimeout as zClearTimeout } from "@zos/timer";

const KEY = "settings";

// music.wav = 8kHz 8-bit mono, 19200 bytes data → đúng 2400ms (đã kiểm header).
export const MUSIC_LOOP_MS = 2400;

// Trả về object settings, hoặc null khi đọc/parse hỏng (fail closed: câm).
function readSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return null; }
}

export function createSound() {
  let sfx = null;          // player cho bounce/death (chuỗi stop→prepare→start)
  let music = null;        // player riêng cho music.wav
  let musicTimerId = null; // timeout tái lập nhạc đang chờ (hoặc null)

  function ensure(p) {
    if (p === null) p = new TonePlayer();
    return p;
  }
  // Chuỗi chuẩn cho 1 âm: stop cũ → prepare file → start.
  function play(p, file) {
    try {
      p = ensure(p);
      p.stop();
      if (!p.prepare({ file })) return p;
      p.start();
    } catch (e) { /* âm là phụ: không bao giờ giết game loop */ }
    return p;
  }
  function muted(kind) {
    const s = readSettings();
    if (s === null) return true; // settings hỏng → câm hẳn, không phát gì
    return kind === "sfx" ? !!s.muteSfx : !!s.muteMusic;
  }
  // Đặt lại nhạc sau đúng một vòng MUSIC_LOOP_MS. Không stack: một timeout
  // duy nhất được giữ ở musicTimerId bất cứ lúc nào.
  function scheduleRestart() {
    clearRestart();
    try {
      musicTimerId = zSetTimeout(() => {
        musicTimerId = null;
        try {
          music = ensure(music);
          music.stop();
          if (music.prepare({ file: "music.wav" })) music.start();
        } catch (e) { /* vòng tiếp theo bỏ lỡ — vẫn không giết ai */ }
        scheduleRestart();               // tái lập vô hạn cho tới stopMusic/release
      }, MUSIC_LOOP_MS);
    } catch (e) { musicTimerId = null; }
  }
  function clearRestart() {
    if (musicTimerId === null) return;
    try { zClearTimeout(musicTimerId); } catch (e) { /* id đã chết — bỏ qua */ }
    musicTimerId = null;
  }
  return {
    bounce() { if (!muted("sfx")) sfx = play(sfx, "bounce.wav"); },
    death() { if (!muted("sfx")) sfx = play(sfx, "death.wav"); },
    startMusic() {
      if (muted("music")) { clearRestart(); return; }
      music = play(music, "music.wav");
      scheduleRestart();
    },
    stopMusic() {
      clearRestart();
      try { if (music) music.stop(); } catch (e) {}
    },
    release() {
      clearRestart();
      try { if (sfx) sfx.release(); } catch (e) {}
      sfx = null;
      try { if (music) music.release(); } catch (e) {}
      music = null;
    },
  };
}
