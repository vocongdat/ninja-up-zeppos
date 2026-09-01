import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry } from "@zos/ui";
import { W, H, TICK_MS, TAP, COLOR, fillBackground, text, button, img, pageChrome } from "../page/ui.js";

beforeEach(() => { resetRegistry(); });

test("constants match the spec geometry", () => {
  assert.equal(W, 390);
  assert.equal(H, 450);
  assert.equal(TICK_MS, 33);
  assert.equal(TAP, 44);
  assert.ok(COLOR.tower && COLOR.ninja && COLOR.shuriken && COLOR.hudBg);
});

test("img() creates an IMG widget with src", () => {
  img({ x: 10, y: 20, w: 28, h: 36, src: "ninja.png" });
  const live = hmUI.live();
  assert.equal(live.length, 1);
  assert.equal(live[0].type, "IMG");
  assert.equal(live[0].props.src, "ninja.png");
});

test("fillBackground + text + button record widgets", () => {
  fillBackground();
  const t = text({ x: 0, y: 8, w: 390, size: 18, text: "Ninja Up" });
  const b = button({ x: 0, y: 200, w: 390, h: 44, text: "PLAY", onClick: () => {} });
  assert.equal(hmUI.live().length, 3);
  assert.equal(t.props.text, "Ninja Up");
  assert.equal(b.type, "BUTTON");
});

test("pageChrome returns [title] or [title, back]", () => {
  assert.equal(pageChrome("Ninja Up").length, 1);
  const two = pageChrome("Game", () => {});
  assert.equal(two.length, 2);
  assert.equal(two[1].type, "BUTTON");
});
