// page/draw.js — STUB for Task 6 TDD: page/game.js needs buildSprites()/apply()
// to exist, but the real renderer is Task 7. This stub builds a static pool
// (overlay MUST be a real array — page/game.js pushes overlay widgets into it
// and clearOverlay() deletes them) and makes apply() a no-op. Task 7 replaces
// this file wholesale; game.js must not need to change.
import { W, H, img, text, FONT, COLOR } from "./ui.js";
import { TOWER_X, TOWER_W, PLANK_W, PLANK_H, NINJA_W, NINJA_H, SHURIKEN_W, SHURIKEN_H } from "./game-core.js";

export function buildSprites() {
  const s = { overlay: [] };

  // Static backdrop only: enough widgets that "pool built" (> 10 live) holds
  // and the scene is not a black screen while Task 7 is pending. Pools mirror
  // Task 7's shape (2 bg + 2 towers + hud + 5 planks + 3 shurikens + ninja)
  // so the real renderer slots in without page/game.js changing.
  s.bg = [
    img({ x: 0, y: 0, w: W, h: H, src: "bg.png" }),
    img({ x: 0, y: H, w: W, h: H, src: "bg.png" }),
  ];
  s.towers = [
    img({ x: TOWER_X[0], y: 0, w: TOWER_W, h: H, src: "tower.png" }),
    img({ x: TOWER_X[1], y: 0, w: TOWER_W, h: H, src: "tower.png" }),
  ];
  s.hudBg = img({ x: 0, y: 0, w: W, h: 40, src: "hudbg.png" });
  s.hudText = text({ x: 8, y: 6, w: 200, size: FONT.section, color: COLOR.hud, text: "0 M" });
  s.planks = [];
  for (let i = 0; i < 5; i++) s.planks.push(img({ x: -100, y: -100, w: PLANK_W, h: PLANK_H, src: "plank.png" }));
  s.shurikens = [];
  for (let i = 0; i < 3; i++) s.shurikens.push(img({ x: -100, y: -100, w: SHURIKEN_W, h: SHURIKEN_H, src: "shuriken-a.png" }));
  s.ninja = img({ x: -100, y: -100, w: NINJA_W, h: NINJA_H, src: "ninja-a.png" });

  return s;
}

// apply() is a no-op in the stub: Task 7's real renderer takes over.
export function apply() {}
