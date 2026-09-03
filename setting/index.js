// setting/index.js — Cài đặt: mute SFX/nhạc nền, xoá kỷ lục.
// Re-render an toàn theo pattern menu.js: mọi widget đều qua keep(), render()
// xoá bộ cũ (try/catch cho widget đã chết) rồi vẽ lại từ dữ liệu mới nhất.
// Row toggle KHÔNG đọc this.state — luôn đọc lại storage, flip, ghi: hai lần
// bấm liên tiếp không thể mất trạng thái.
import hmUI from "@zos/ui";
import { localStorage } from "@zos/storage";
import { router } from "@zos/router";
import { W, fillBackground, button, pageChrome } from "../page/ui.js";

const SETTINGS_KEY = "settings";
const RECORD_KEY = "record";

// Xoá kỷ lục: dùng sentinel "0" thay vì removeItem(). Đối với người dùng thì
// kết quả như xoá (menu.js đọc Number("0") → 0 → hiện "Kỷ lục: 0 M"; game.js
// coi 0 là chưa có kỷ lục vì saveRecord chỉ ghi khi score > prev). Ghi đè an
// toàn hơn xoá thật: cùng API với mọi thứ khác trong repo (getItem/setItem),
// không phụ thuộc API_LEVEL, và idempotent khi bấm nhiều lần.
function clearRecord() {
  try { localStorage.setItem(RECORD_KEY, "0"); } catch (e) { /* phụ: bỏ qua */ }
}

// settings hỏng/không có → {}
// Fail-open ở đây (hiện "Bật") là chủ ý: page chỉ hiển thị, còn sound.js
// (Task 4) mới là nơi phát âm và nó fail-closed khi JSON hỏng.
// !Array.isArray: JSON "[]" parse thành array — gán prop lên array bị
// JSON.stringify bỏ đi, khiến toggle trở nên vô hiệu vĩnh viễn.
function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    return s && !Array.isArray(s) && typeof s === "object" ? s : {};
  } catch (e) { return {}; }
}

function writeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* phụ: bỏ qua */ }
}

Page({
  onInit() {
    this.state = { widgets: [] };
  },
  // keep(): track widget để re-render có thể xoá. pageChrome() trả về mảng
  // [title TEXT, back BUTTON "‹"] — flatten; fillBackground/button trả về đơn.
  keep(created) {
    const list = Array.isArray(created) ? created : [created];
    for (const w of list) this.state.widgets.push(w);
    return created;
  },
  render() {
    for (const w of this.state.widgets) {
      try { hmUI.deleteWidget(w); } catch (e) { /* widget đã chết — bỏ qua */ }
    }
    this.state.widgets = [];

    this.keep(fillBackground());
    this.keep(pageChrome("Cài đặt", () => router.back()));
    const s = readSettings();

    this.keep(button({
      x: 16, y: 90, w: W - 32, h: 56,
      text: "Âm thanh SFX: " + (s.muteSfx ? "Tắt" : "Bật"),
      onClick: () => {
        const cur = readSettings();
        cur.muteSfx = !cur.muteSfx;
        writeSettings(cur);
        this.render();
      },
    }));
    this.keep(button({
      x: 16, y: 160, w: W - 32, h: 56,
      text: "Nhạc nền: " + (s.muteMusic ? "Tắt" : "Bật"),
      onClick: () => {
        const cur = readSettings();
        cur.muteMusic = !cur.muteMusic;
        writeSettings(cur);
        this.render();
      },
    }));
    this.keep(button({
      x: 16, y: 230, w: W - 32, h: 56,
      text: "Xoá kỷ lục",
      onClick: () => {
        clearRecord();
        this.render();
      },
    }));
  },
  build() {
    this.render();
  },
  onResume() {
    this.render();
  },
});
