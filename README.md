# Ninja Up

Game leo vô tận "Ninja Up" cho **Amazfit Bip 6** (Zepp OS 3.0): ninja nảy chéo giữa 2
tháp giàn giáo, né shuriken bay ngang, điểm là số mét leo được. Chạm màn hình để bật
chéo ngay giữa không trung; menu có kỷ lục và trang Cài đặt (mute SFX/nhạc nền, xoá
kỷ lục).

## Cấu trúc repo

- `page/game-core.js` — physics thuần (không import `@zos/*`): trọng lực, va chạm
  plank/shuriken, camera, spawn, điểm. `page/game.js` là adapter duy nhất chạm
  Zeitgeber (setInterval + setProperty + tap).
- `page/draw.js` — pool widget dựng **một lần**, mỗi tick chỉ `setProperty`
  (không createWidget/deleteWidget trong game loop).
- `page/menu.js`, `setting/index.js` — menu chính + Cài đặt (device pages, đăng ký
  trong `app.json` → `module.page.pages`).
- `utils/sound.js` — TonePlayer: SFX dùng chung 1 player (stop→prepare→start), nhạc
  nền player riêng + tự tái lập qua `MUSIC_LOOP_MS` (music.wav dài 2.4s).
- `utils/vibe.js` — hmSetting: buzz 100/400ms có hẹn `stopVibrate` đúng chu kỳ.
- `tests/` — node:test + fakes cho `@zos/ui`, `@zos/timer`, `@zos/media`,
  `@zos/settings`, `@zos/storage`, `@zos/router` (đồng hồ ảo, registry widget, log
  media/vibro). `tools/gen-assets.js` sinh toàn bộ PNG/WAV bằng Node builtin.
- Thiết kế chi tiết: `docs/superpowers/specs/2026-09-01-ninja-up-design.md`, kế hoạch
  triển khai: `docs/superpowers/plans/2026-09-01-ninja-up.md`.

## Chạy test

```
npm test
```

## Build gói cài đặt (.zab)

```
NODE_OPTIONS="--require ./zeus.config.cjs" npx zeus build --png2vg false
```

> **Bắt buộc `--png2vg false`:** mặc định zeus-cli 1.9.3 đổi MỌI `.png` trong
> `assets/` sang định dạng TGA-L8 nội bộ (byte đầu `2e 01`, palette HOMS). Màn
> hình Bip 6 đen thui khi chạy gói build mặc định — nguyên nhân nghiêm trọng
> nhất là IMG không render được ảnh đã đổi format; bản CampMate chạy tốt trên
> cùng máy đích đo được gửi PNG thuần (magic `89 50 4e 47`) nguyên vẹn qua
> build. `--png2vg false` giữ PNG nguyên bản. Kiểm tra sau build:
> `xxd -l 4 -p <zab-giải-nén>/assets/ninja-a.png` phải in `89504e47`.

> **Chỉ sửa assets/ là CHƯA đủ:** zpm 3.4.2 đóng gói asset device CHỈ từ
> `assets/<target>/` (`assets/bip6/`, `assets/bip6-2/`), KHÔNG đọc `assets/`
> gốc. `tools/gen-assets.js` mirror tự động — chạy lại nó sau khi sửa asset,
> không copy tay. Đừng quên: build có thể reuse asset cũ từ thư mục target nếu
> mirror bị bỏ qua — triệu chứng là .zab mới vẫn chứa PNG bd=4/ct=3 cũ dù repo
> đã đổi RGBA. Kiểm tra định dạng trong .zab:
> `xxd -l 1 -s 24 -p <png>` = `08` (bit depth 8) và `xxd -l 1 -s 25 -p <png>` =
> `06` (color type RGBA).

> **Lỗi zeus-cli 1.9.3 (module-alias bug):** zeus-cli đóng gói bản
> `zeppos-app-utils` riêng trong `private-modules/` và định tuyến qua
> `_moduleAliases` trong package.json của chính nó, nhưng `module-alias/register`
> chỉ đọc package.json gần nhất với tiến trình (package.json của project), nên
> alias không được đăng ký. Node resolve về bản `zeppos-app-utils` public trên npm
> (thiếu export `modules.fetchDevices`) và build sập với
> `TypeError: devicesData is not a function`. `zeus.config.cjs` đăng ký alias về
> bản đóng gói trong zeus-cli **trước khi** CLI được nạp — không patch file nào
> của zeus-cli.
