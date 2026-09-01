// page/menu.js — màn hình chính: title, PLAY, kỷ lục, hướng dẫn, cài đặt.
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
  onInit() {},
  build() {
    fillBackground();
    text({ x: 0, y: 60, w: W, size: FONT.display, align: "center", text: "Ninja Up" });
    text({
      x: 0, y: 130, w: W, size: FONT.section, color: COLOR.sub, align: "center",
      text: "Kỷ lục: " + readRecord() + " M",
    });
    button({
      x: 45, y: 190, w: 300, h: 64, text: "PLAY", size: FONT.title,
      normalColor: COLOR.accent, pressColor: COLOR.cardPress, textColor: 0x062b18,
      onClick: () => router.push({ page: "page/game" }),
    });
    text({
      x: 0, y: 280, w: W, size: FONT.small, color: COLOR.sub, align: "center",
      text: "Chạm để bật chéo · né shuriken",
    });
    button({
      x: 45, y: 330, w: 300, h: 44, text: "Cài đặt",
      onClick: () => router.push({ page: "setting/index" }),
    });
  },
  onResume() {},
});
