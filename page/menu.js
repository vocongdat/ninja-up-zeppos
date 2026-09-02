// page/menu.js — màn hình chính: title, PLAY, kỷ lục, hướng dẫn, cài đặt.
// Re-render an toàn: mọi widget tạo ra đều được track qua keep(), onResume()
// xoá bộ cũ rồi vẽ lại để kỷ lục mới (sau khi chơi xong) hiển thị đúng.
import hmUI from "@zos/ui";
import { localStorage } from "@zos/storage";
import { router } from "@zos/router";
import { W, COLOR, FONT, fillBackground, text, button } from "./ui.js";

function readRecord() {
  try {
    const raw = localStorage.getItem("record");
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (e) { return 0; }
}

Page({
  onInit() {
    this.state = { widgets: [] };
  },
  // keep(): track widget để có thể xoá khi re-render. pageChrome() trả về một
  // mảng, nên flatten — fillBackground/text/button trả về widget đơn.
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
    this.keep(text({ x: 0, y: 60, w: W, size: FONT.display, align: "center", text: "Ninja Up" }));
    this.keep(text({
      x: 0, y: 130, w: W, size: FONT.section, color: COLOR.sub, align: "center",
      text: "Kỷ lục: " + readRecord() + " M",
    }));
    this.keep(button({
      x: 45, y: 190, w: 300, h: 64, text: "PLAY", size: FONT.title,
      normalColor: COLOR.accent, pressColor: COLOR.cardPress, textColor: 0x062b18,
      onClick: () => router.push({ page: "page/game" }),
    }));
    this.keep(text({
      x: 0, y: 280, w: W, size: FONT.small, color: COLOR.sub, align: "center",
      text: "Chạm để bật chéo · né shuriken",
    }));
    this.keep(button({
      x: 45, y: 330, w: 300, h: 44, text: "Cài đặt",
      onClick: () => router.push({ page: "setting/index" }),
    }));
  },
  build() {
    this.render();
  },
  onResume() {
    this.render();
  },
});
