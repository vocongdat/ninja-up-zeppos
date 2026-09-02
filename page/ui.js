// page/ui.js — palette + widget helpers riêng của Ninja Up.
import hmUI from "@zos/ui";

export const W = 390;
export const H = 450;
// Game tick 33ms ≈ 30fps. Hằng ở đây để device-QA giảm còn 50 chỉ đổi 1 chỗ.
export const TICK_MS = 33;
export const TAP = 44;

export const COLOR = {
  bg: 0x0d1117,
  tower: 0xd9a545,     // vàng giàn giáo
  towerDark: 0x8a6a20, // màu tối của giàn
  plank: 0xc08a2e,
  ninja: 0x3ddc84,     // xanh lá như ảnh Nokia
  shuriken: 0xcfd8dc,
  hud: 0xffffff,
  hudBg: 0x4fc3f7,     // thanh điểm nền xanh như ảnh Nokia
  text: 0xffffff,
  sub: 0x9ca3af,
  accent: 0x3ddc84,
  danger: 0xa9442a,
  card: 0x1a2230,
  cardPress: 0x243044,
  border: 0x2a3441,
};

export const FONT = { display: 48, title: 22, section: 18, body: 16, small: 14 };

const ALIGN = { left: hmUI.align.LEFT, center: hmUI.align.CENTER_H, right: hmUI.align.RIGHT };

export function fillBackground() {
  return hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: COLOR.bg });
}

export function text(opts) {
  const size = opts.size;
  return hmUI.createWidget(hmUI.widget.TEXT, {
    x: opts.x, y: opts.y,
    w: opts.w === undefined ? W - opts.x : opts.w,
    h: opts.h === undefined ? size + 12 : opts.h,
    color: opts.color === undefined ? COLOR.text : opts.color,
    text_size: size,
    align_h: ALIGN[opts.align] === undefined ? hmUI.align.LEFT : ALIGN[opts.align],
    align_v: hmUI.align.CENTER_V,
    text_style: hmUI.text_style.NONE,
    text: opts.text,
  });
}

export function button(opts) {
  return hmUI.createWidget(hmUI.widget.BUTTON, {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    radius: opts.radius === undefined ? 16 : opts.radius,
    normal_color: opts.normalColor === undefined ? COLOR.card : opts.normalColor,
    press_color: opts.pressColor === undefined ? COLOR.cardPress : opts.pressColor,
    text: opts.text, text_size: opts.size === undefined ? FONT.body : opts.size,
    color: opts.textColor === undefined ? COLOR.text : opts.textColor,
    click_func: opts.onClick,
  });
}

export function img(opts) {
  return hmUI.createWidget(hmUI.widget.IMG, {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    src: opts.src, auto_scale: opts.autoScale === undefined ? true : opts.autoScale,
  });
}

export function backButton(onClick) {
  return button({ x: 16, y: 6, w: 52, h: TAP, text: "‹", onClick });
}

export function pageChrome(title, onBack) {
  const out = [text({ x: 0, y: 8, w: W, size: FONT.title, align: "center", text: title })];
  if (onBack !== undefined) out.push(backButton(onBack));
  return out;
}
