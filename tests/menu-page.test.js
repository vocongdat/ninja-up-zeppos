import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import hmUI, { resetRegistry } from "@zos/ui";
import { backing, resetStorage, localStorage } from "@zos/storage";
import { router, resetRouter } from "@zos/router";

let captured;
globalThis.Page = (obj) => { captured = obj; };

beforeEach(() => { resetRegistry(); resetStorage(); resetRouter(); captured = undefined; });

async function loadMenu() {
  const url = new URL("../page/menu.js", import.meta.url).href;
  await import(url + "?v=" + Math.random());
  return captured;
}

test("menu renders title, PLAY, record, hint", async () => {
  localStorage.setItem("record", "42");
  const page = await loadMenu();
  page.onInit(); page.build();
  const texts = hmUI.live().filter((w) => w.type === "TEXT").map((w) => w.props.text);
  assert.ok(texts.includes("Ninja Up"));
  assert.ok(texts.some((t) => t.includes("42")), "record shown: " + texts.join("|"));
  assert.ok(texts.some((t) => t.includes("Chạm")), "hint shown");
  const buttons = hmUI.live().filter((w) => w.type === "BUTTON");
  assert.ok(buttons.some((b) => b.props.text === "PLAY"));
});

test("no record yet: shows 0, does not crash", async () => {
  const page = await loadMenu();
  page.onInit(); page.build();
  const texts = hmUI.live().filter((w) => w.type === "TEXT").map((w) => w.props.text);
  assert.ok(texts.some((t) => t.includes("0")));
});

test("PLAY pushes page/game", async () => {
  const page = await loadMenu();
  page.onInit(); page.build();
  const play = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "PLAY");
  play.props.click_func();
  assert.equal(router.pushes.length, 1);
  assert.equal(router.pushes[0].page, "page/game");
});

test("settings button pushes setting/index", async () => {
  const page = await loadMenu();
  page.onInit(); page.build();
  const btn = hmUI.live().find((w) => w.type === "BUTTON" && w.props.text === "Cài đặt");
  btn.props.click_func();
  assert.equal(router.pushes[0].page, "setting/index");
});
