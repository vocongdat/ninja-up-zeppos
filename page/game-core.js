// page/game-core.js — PURE physics: không import @zos/*; mọi input ngoài
// (thời gian, random) truyền vào qua tham số. page/game.js là adapter duy nhất.
export const GRAVITY_PX_S2 = 2200;
export const JUMP_VX = 260;
export const JUMP_VY = 420;
export const TAP_COOLDOWN_MS = 90;
export const PLANK_W = 54;
export const PLANK_H = 6;
export const PLANK_GAP_MIN = 90;
export const PLANK_GAP_MAX = 130;
export const NINJA_W = 28;
export const NINJA_H = 36;
export const SHURIKEN_W = 16;
export const SHURIKEN_H = 16;
export const SHURIKEN_SPEED_MIN = 60;
export const SHURIKEN_SPEED_MAX = 140;
export const SHURIKEN_INTERVAL_MIN_MS = 1200;
export const SHURIKEN_INTERVAL_MAX_MS = 2200;
export const SCORE_DIV = 8;
export const HITBOX_SCALE = 0.7;
export const TOWER_X = [65, 255];
export const TOWER_W = 70;
export const PLAY_TOP = 40;
export const PLAY_BOTTOM = 450;
export const PLAY_LEFT = TOWER_X[0] + TOWER_W;   // 135
export const PLAY_RIGHT = TOWER_X[1];            // 255
// Plank nhô 20px vào mỗi tháp cho đẹp, nhưng luôn trọn trong lối đi ± 20.
export const PLANK_X_MIN = PLAY_LEFT - 20;                 // 115
export const PLANK_X_MAX = PLAY_RIGHT + 20 - PLANK_W;      // 221

export function scoreOf(world) { return Math.floor(world.alt / SCORE_DIV); }

// Camera không tồn tại như một object: khi ninja bay lên quá PLAY_TOP + CAM_KEEP
// (điểm giữ), mọi vật thể bị đẩy xuống cùng lượng, alt tăng cùng lượng.
const CAM_KEEP = 60;

function randRange(rand, min, max) { return min + rand() * (max - min); }

// Sinh plank kế tiếp phía trên plank cao nhất hiện có.
function spawnPlank(world, rand) {
  const top = world.planks.reduce((m, p) => Math.min(m, p.y), Infinity);
  const y = top - randRange(rand, PLANK_GAP_MIN, PLANK_GAP_MAX);
  const x = Math.floor(randRange(rand, PLANK_X_MIN, PLANK_X_MAX));
  world.planks.push({ x, y, w: PLANK_W, h: PLANK_H });
}

export function createWorld(rand) {
  const world = {
    alt: 0, score: 0, dead: false, bounceCount: 0,
    ninja: { x: 0, y: 0, w: NINJA_W, h: NINJA_H, vx: 0, vy: 0, dir: 1, wantTapCooldownMs: 0 },
    planks: [], shurikens: [],
    nextShurikenMs: 0, lastTapMs: -Infinity,
    // rand được tiêm một lần lúc tạo world để step() vẫn là hàm thuần
    // (không đọc thời gian/random toàn cục).
    rand,
  };
  // Plank đầu: giữa lối đi, ở 2/3 dưới màn; ninja đứng trên nó.
  const p0 = {
    x: Math.floor((PLAY_LEFT + PLAY_RIGHT) / 2 - PLANK_W / 2),
    y: 320,
    w: PLANK_W, h: PLANK_H,
  };
  world.planks.push(p0);
  world.ninja.x = p0.x + p0.w / 2 - NINJA_W / 2;
  world.ninja.y = p0.y - NINJA_H;
  // Các plank phía trên theo đúng khoảng dọc ngẫu nhiên.
  for (let i = 0; i < 8; i++) spawnPlank(world, rand);
  world.nextShurikenMs = 1500;
  return world;
}

// Va chạm AABB với hitbox thu nhỏ HITBOX_SCALE quanh tâm.
function overlapsScaled(a, b, scale) {
  const aw = a.w * scale, ah = a.h * scale;
  const bw = b.w * scale, bh = b.h * scale;
  return (
    a.x + a.w / 2 - aw / 2 < b.x + b.w / 2 + bw / 2 &&
    a.x + a.w / 2 + aw / 2 > b.x + b.w / 2 - bw / 2 &&
    a.y + a.h / 2 - ah / 2 < b.y + b.h / 2 + bh / 2 &&
    a.y + a.h / 2 + ah / 2 > b.y + b.h / 2 - bh / 2
  );
}

export function step(world, dtMs, nowMs, wantTap) {
  if (world.dead) return;
  const dt = Math.max(0, Math.min(100, dtMs)) / 1000;
  const ninja = world.ninja;
  // Random source: từ world.rand (tiêm khi createWorld), fallback tham số.
  const rand = world.rand;

  // 1. Tích phân bán ẩn (semi-implicit Euler).
  const prevBottom = ninja.y + ninja.h;
  ninja.vy += GRAVITY_PX_S2 * dt;
  ninja.x += ninja.vx * dt;
  ninja.y += ninja.vy * dt;
  const newBottom = ninja.y + ninja.h;

  // Tường vô hình hai bên lối đi: chạm mép thì đổi hướng ngang.
  if (ninja.x < PLAY_LEFT) { ninja.x = PLAY_LEFT; ninja.vx = Math.abs(ninja.vx); }
  if (ninja.x + ninja.w > PLAY_RIGHT) { ninja.x = PLAY_RIGHT - ninja.w; ninja.vx = -Math.abs(ninja.vx); }

  // 2. Tap giữa không trung: one-shot jump + đổi hướng, cooldown. Áp Sau tích
  // phân để xung nhảy giữ nguyên vy = -JUMP_VY tới frame sau (không bị gravité
  // của frame này ăn vào), và vẫn ưu tiên hơn việc đáp plank cùng frame.
  if (wantTap && nowMs - world.lastTapMs >= TAP_COOLDOWN_MS) {
    world.lastTapMs = nowMs;
    ninja.dir = -ninja.dir;
    ninja.vx = ninja.dir * JUMP_VX;
    ninja.vy = -JUMP_VY;
    world.bounceCount += 1;
  }

  // 3. Plank: chỉ bắt khi đi xuống và chân cắt mép trên plank.
  if (ninja.vy > 0) {
    for (const p of world.planks) {
      const horizOverlap = ninja.x < p.x + p.w && ninja.x + ninja.w > p.x;
      const crossed = prevBottom <= p.y && newBottom >= p.y;
      if (horizOverlap && crossed) {
        ninja.y = p.y - ninja.h;
        ninja.dir = -ninja.dir;
        ninja.vx = ninja.dir * JUMP_VX;
        ninja.vy = -JUMP_VY;
        world.bouncedThisStep = true;   // adapter đọc để phát âm thanh + rung
        world.bounceCount += 1;
        break;
      }
    }
  }

  // 4. Camera: ninja quá cao thì đẩy thế giới xuống, alt tăng.
  if (ninja.y < PLAY_TOP + CAM_KEEP && ninja.vy < 0) {
    const push = (PLAY_TOP + CAM_KEEP) - ninja.y;
    ninja.y += push;
    for (const p of world.planks) p.y += push;
    for (const s of world.shurikens) s.y += push;
    world.alt += push;
  }

  // 5. Shuriken: di chuyển ngang, rời màn thì xoá; spawn theo đồng hồ alt.
  for (let i = world.shurikens.length - 1; i >= 0; i--) {
    const s = world.shurikens[i];
    s.x += s.vx * dt;
    if (s.x < -SHURIKEN_W - 4 || s.x > 390 + 4) world.shurikens.splice(i, 1);
  }
  world.nextShurikenMs -= dtMs;
  if (world.nextShurikenMs <= 0) {
    const fromLeft = rand() < 0.5;
    const speed = randRange(rand, SHURIKEN_SPEED_MIN, SHURIKEN_SPEED_MAX);
    world.shurikens.push({
      x: fromLeft ? -SHURIKEN_W : 390,
      y: randRange(rand, PLAY_TOP + 20, PLAY_TOP + 200),
      w: SHURIKEN_W, h: SHURIKEN_H, vx: fromLeft ? speed : -speed,
    });
    world.nextShurikenMs = randRange(rand, SHURIKEN_INTERVAL_MIN_MS, SHURIKEN_INTERVAL_MAX_MS);
  }

  // 6. Plank rơi khỏi đáy → sinh plank mới trên đỉnh (pool không đổi số lượng).
  for (let i = world.planks.length - 1; i >= 0; i--) {
    if (world.planks[i].y > PLAY_BOTTOM + 40) {
      world.planks.splice(i, 1);
      spawnPlank(world, rand);
    }
  }

  // 7. Chết: rơi khỏi đáy hoặc trúng shuriken (hitbox 70%).
  if (ninja.y > PLAY_BOTTOM) { world.dead = true; return; }
  for (const s of world.shurikens) {
    if (overlapsScaled(ninja, s, HITBOX_SCALE)) { world.dead = true; return; }
  }

  world.score = scoreOf(world);
}
