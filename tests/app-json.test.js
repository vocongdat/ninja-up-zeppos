// tests/app-json.test.js — app.json must register setting/index as a DEVICE page.
//
// Final-review finding F1: `setting/index.js` is a device page (imports Page,
// hmUI, router, @zos/storage) but app.json declared it under `module.setting`
// — the phone-side AppSettingsPage slot. On-device that meant: the watch bundle
// had no settings page at all (menu's "Cài đặt" router.push was dead), while the
// phone-side bundle would crash importing @zos/ui. Fix: list it in
// `module.page.pages` and drop `module.setting` entirely (nothing phone-side is
// implemented). These tests pin that shape so the regression cannot return.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8"));

test("setting/index is registered as a device page", () => {
  const pages = appJson.targets.bip6.module.page.pages;
  assert.ok(Array.isArray(pages), "module.page.pages is a list");
  assert.ok(pages.includes("page/menu"), "menu page registered");
  assert.ok(pages.includes("page/game"), "game page registered");
  assert.ok(pages.includes("setting/index"), "settings page registered on-device");
});

test("module.setting (phone-side AppSettingsPage slot) is gone", () => {
  const mod = appJson.targets.bip6.module;
  assert.equal(mod.setting, undefined, "no phone-side setting bundle is declared");
  // The device permission that the settings page relies on stays declared.
  assert.ok(appJson.permissions.includes("device:os.local_storage"));
});
