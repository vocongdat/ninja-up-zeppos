# Ninja Up — thiết kế game zig-zag cho Amazfit Bip 6

Ngày: 2026-09-01 · Repo: `~/Documents/Workspace/amafit-app/ninja-up` (mới, tách khỏi CampMate)

## 1. Mục tiêu

Game arcade endless-climber trên Zepp OS 3.0, tái hiện màn chơi Nokia của "Ninja Up":
ninja tự nảy chéo lên giữa **2 tháp giàn giáo**, né **shuriken** bay ngang, điểm là số
mét leo được. Điều khiển bằng **một chạm** — cổng vào duy nhất đáng tin trên cổ tay đeo.

Nguồn tham chiếu: ảnh Nokia TA-1235 / Nokia 106 do user cung cấp +
thegioididong.com/game-app/ninja-up-...-228862 (bản Android vẽ trampoline — **không
làm**, vì gesture vẽ khó trên màn 44mm; tap là cơ chế được chọn).

Không nằm trong phạm vi v1: vẽ trampoline, nhân vật sưu tầm, bảng vàng online, portrait
ninja phức tạp. V1 = một vòng lặp chơi hoàn chỉnh, mượt, có âm thanh.

## 2. Kiến trúc repo & tầng

```
ninja-up/
├── app.json                  # appId riêng, appType "app", target bip6, designWidth 390
├── package.json              # npm test = node --import ./tests/support/register.mjs --test
├── page/
│   ├── menu.js               # title + PLAY + kỷ lục + hướng dẫn 1 dòng
│   └── game.js               # gameplay BasePage: setInterval + setProperty adapter
├── page/ui.js                # palette riêng (không palette CampMate): W=390 H=450, màu nền game
│   ├── game-core.js          # PURE: physics, va chạm, spawn, điểm — không import @zos/*
│   └── draw.js               # buildSprites() (1 lần) + apply() (mỗi tick, chỉ setProperty)
├── utils/sound.js            # TonePlayer wrapper (best-effort, try/catch toàn bộ)
├── utils/vibe.js             # hmSetting.startVibrate/stopVibrate wrapper (best-effort)
├── setting/index.js          # mute SFX / nhạc, reset kỷ lục
├── assets/                   # sprites PNG 4-bit + WAV tiny
├── tests/                    # node:test + fakes (register.mjs + resolve-hook copy tinh thần CampMate)
└── docs/superpowers/         # specs + plans
```

Quy tắc tầng (giống CampMate): **`game-core.js` pure** — mọi input từ ngoài
(`Date.now()`, `Math.random()`) truyền vào qua tham số; không import `@zos/timer`,
`@zos/ui`, `@zos/media`. `page/game.js` là adapter duy nhất chạm Zeitgeber: interval,
widget, tap. Va chạm/spawn/điểm test được không cần device.

## 3. Gameplay

Hệ toạ độ: y=0 đỉnh màn, ninja leo lên = `alt` (px) tăng. Điểm hiển thị = `floor(alt/8)` + " M".

| Thành phần | Kích thước | Vị trí/giá trị khởi tạo |
|---|---|---|
| Tháp giàn giáo | 70px rộng, full-height | x≈65 và x≈255 (2 bên, chừa lối đi giữa ~90px) |
| Platform (bậc nảy) | ~54×6px | gắn mép trong tháp, khoảng dọc 90–130px ngẫu nhiên |
| Ninja | 28×36px | platform đầu tiên, giữa lối đi |
| Shuriken | 16×16px | bay ngang trong lối đi, tốc độ 60–140 px/s |
| HUD điểm | TEXT | thanh nền xanh dương trên đỉnh, "12 M" như ảnh Nokia |

- **Physics** (tick cố định 33ms, dt thực từ `Date.now()` để tốc độ ổn khi jitter):
  trọng lực 2200 px/s²; chạm platform khi rơi (vy>0) và chân ninja cắt mép platform
  (AABB, thu nhỏ hitbox 70% cho khoan dung); nảy = vy=−420, vx=±260 **đổi hướng về
  phía tháp kia**.
- **Chạm màn hình** (BUTTON full-screen trong suốt) = "bật chéo" ngay lập tức — kể cả
  khi đang giữa không trung (như bản Nokia: nhảy điều khiển được, không chỉ nảy thụ động).
- **Shuriken spawn**: phía trên đỉnh màn, mỗi 1.2–2.2s (càng cao càng dày), đi ngang
  qua lối đi; xoay giả = sprite 2 frame (X / +) đổi 8Hz.
- **Chết**: AABB với shuriken, hoặc rơi khỏi đáy màn. Không giới hạn thời gian.
- **Nền theo tầng cao**: 3 band (chiều → hoàng hôn → đêm sao), lặp lại khi leo tiếp.
  Crossfade 2 IMG chồng alpha. Mây trang trí scroll chậm hơn nền (parallax).

## 4. Render — widget di chuyển, không xoá/tạo

Build **một lần** ~16 widget trong `buildSprites()`: nền 2 IMG chồng, mây 3 IMG,
tháp 2 IMG, platform 4 IMG (pool), shuriken 2 IMG, ninja 2 IMG (2 frame chạy),
HUD 1 TEXT. Mỗi tick `apply(state)` chỉ `setProperty(X/Y/SOURCE…)`.

- Frame ninja: 2 PNG (chân trước sau), đổi mỗi lần nảy; frame shuriken đổi theo đồng hồ 8Hz.
- Nền scroll: 2 IMG cùng PNG cao 2×H, đổi Y modulo — không đổi SOURCE khi chỉ crossfade band.
- Fallback trung thực: nếu `setProperty(SOURCE)` không được hỗ trợ trên device, frame
  đứng yên — mất hiệu ứng quay, không mất logic. Ghi nhận trong device-QA checklist.
- **Không bao giờ** createWidget/deleteWidget trong game loop (bài học GC/flicker từ
  CampMate: camp.js tick chỉ setProperty).

## 5. Âm thanh & haptic (best-effort)

- `utils/sound.js` bọc `TonePlayer` từ `@zos/media`: `bounce.wav` (60ms), `death.wav`
  (300ms), nhạc nền loop 8-note ~5s WAV tiny (không streaming — TonePlayer chỉ hợp
  âm ngắn; nếu nhạc nền bị giới hạn, chấp nhận giảm xuống chỉ SFX, ghi nhận QA).
- `utils/vibe.js` bọc `hmSetting.startVibrate`/`stopVibrate` (từ `@zos/settings`):
  nảy = period ngắn 100ms, chết = 400ms; stopVibrate() trong onPause/onDestroy.
- **Mọi call đều try/catch**: lỗi âm/rung không bao giờ được làm rơi game loop.
- Settings mute riêng SFX/nhạc (localStorage), mặc định bật cả hai.

## 6. Luồng màn hình & dữ liệu

`menu.js` (title, PLAY, "Kỷ lục: N M", dòng hướng dẫn "Chạm để bật chéo") →
`router.push("page/game")` → chơi → chết → overlay Game Over (điểm, kỷ lục mới?,
"Chạm để chơi lại" + nút "Về menu") → chơi lại push lại page/game.

Kỷ lục: `localStorage` key `record`, kiểu number; ghi khi chết nếu phá kỷ lục.
Settings: key `settings` JSON `{ muteSfx, muteMusic }` — đọc mỗi lần play sound
(đơn giản, không cần cache).

## 7. Xử lý lỗi & vòng đời

- `setInterval` 33ms lưu handle; **onPause và onDestroy đều clear** (bài học Issue 02
  + camp.js: push() không destroy page). Resume: render() lại vị trí từ state (không
  dựa vào widget tự nhớ).
- Game chạy nền khi ẩn? Không — vào onPause là **pause game** (state giữ nguyên),
  onResume hiện overlay "Tạm dừng — chạm để chơi tiếp". Không chơi ngầm ăn pin.
- Mỗi tick bọc try/catch: một widget lỗi (deleted, v.v.) không giết cả loop; nếu lỗi
  lặp, tự clear interval (chết êm, không treo pin).
- Tap trước khi build xong / sau khi teardown: guarded bằng cờ `running`.

## 8. Testing (node:test + fakes)

Copy tinh thần harness CampMate: `tests/support/register.mjs` + `resolve-hook.mjs`
map `@zos/ui`, `@zos/timer`, `@zos/media`, `@zos/settings`, `@zos/storage`,
`@zeppos/zml` về fakes; `globalThis.Page` capture.

- **game-core (pure, ~15 test)**: trọng lực tích phân, va chạm platform (đi xuống vs
  đi lên không nảy), đổi hướng nảy, AABB shuriken, spawn cách quãng đúng công thức,
  alt→điểm, chết rơi đáy, hitbox 70%.
- **page (~12 test)**: menu render + kỷ lục đọc từ store; start game tạo đúng số
  widget pool; tick(ms) đẩy physics (nền scroll, ninja rơi); tap đổi hướng vy/vx
  (kiểm qua vị trí sau tick); va chạm → Game Over + ghi kỷ lục; onPause clear
  interval (pendingCount==0), onResume không tự chơi tiếp (overlay pause); mọi
  setProperty sau teardown không crash (frozen registry của fake).
- Mục tiêu ≥25 test xanh trước mỗi commit; TDD đỏ→xanh theo tầng như CampMate.

## 9. Device QA (sau khi simulator pass — user thực hiện)

- FPS thực tế trên Bip 6 (nếu 30fps giật → giảm vòng lặp còn 20fps/50ms — chỉ đổi 1 hằng).
- setProperty(SOURCE) có đổi frame không (fallback: đứng yên, chấp nhận).
- TonePlayer trên firmware thật (fallback: bỏ nhạc nền, giữ SFX; nếu cả SFX không
  được — bỏ âm, giữ rung).
- startVibrate mode/period chấp nhận được không.
- PNG 4-bit palette hiển thị đúng màu; 3 band nền chuyển mượt.
- Loa nhỏ giữa tay đông: đo mức volume mặc định.

## 10. Rủi ro & phương án dự phòng

| Rủi ro | Phương án |
|---|---|
| 30fps không đạt trên device | Giảm còn 20fps (TICK_MS 50), không đổi kiến trúc |
| setProperty(SOURCE) không chạy | Frame đứng yên — chỉ mất hiệu ứng, không mất gameplay |
| TonePlayer không phát WAV nhỏ | Bỏ nhạc nền; nếu SFX cũng không: bỏ âm giữ rung |
| hmSetting khác API giữa các firmware | vibe.js bọc try/catch + probe 1 lần lúc build |
| PNG sprites tốn quá nhiều RAM | Giảm xuống FILL_RECT ghép cho tháp (giàn giáo là hình học) |
| Người chơi tap liên tục bay quá nhanh | Cooldown 90ms giữa 2 lần bật chéo |

## 11. Mở sau v1 (không làm bây giờ)

Vẽ trampoline (bản Android), nhân vật sưu tầm, bảng vàng nhiều máy qua điện thoại,
power-up, portrait ninja nhiều frame.
