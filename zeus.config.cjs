// zeus.config.cjs — bootstrap cho @zeppos/zeus-cli 1.9.3 trên repo này.
//
// LỖI CỦA ZEUS-CLI 1.9.3 (module-alias bug):
//   zeus-cli đóng gói bản zeppos-app-utils riêng trong
//   `node_modules/@zeppos/zeus-cli/private-modules/zeppos-app-utils` và định
//   tuyến require("zeppos-app-utils") tới nó qua `_moduleAliases` trong
//   package.json của chính zeus-cli. Nhưng `module-alias/register` (được nạp
//   đầu tiên trong bin shim) chỉ đọc `_moduleAliases` của package.json GẦN
//   NHẤT với tiến trình đang chạy — với repo này là package.json gốc của
//   project, KHÔNG phải của zeus-cli — nên alias không bao giờ được đăng ký.
//   Kết quả: Node resolve về bản zeppos-app-utils public trên npm (không có
//   export `modules.fetchDevices`) và `npx zeus build` sập với
//   `TypeError: devicesData is not a function`.
//
// FILE NÀY là bản bootstrap thay cho wrapper /tmp/zeus-run.js (task 10): đăng
// ký alias về bản đóng gói trong zeus-cli rồi nhả quyền cho CLI. Không patch
// file nào của zeus-cli.
//
// CÚ PHÁP BUILD (file này phải được nạp TRƯỚC bin của zeus):
//   NODE_OPTIONS="--require ./zeus.config.cjs" npx zeus build
//
// Ghi chú: package.json của repo khai báo "type": "module", nên một file
// preload đuôi .js bị Node xử lý là ESM và `require` không tồn tại — vì vậy
// bootstrap được đặt ở đuôi .cjs (CommonJS) để dùng được với --require.
"use strict";
const path = require("path");
const nm = path.join(__dirname, "node_modules");
try {
  const { addAlias } = require(path.join(nm, "module-alias"));
  addAlias(
    "zeppos-app-utils",
    path.join(nm, "@zeppos", "zeus-cli", "private-modules", "zeppos-app-utils"),
  );
} catch (e) {
  // Dev dependencies chưa cài (vd. môi trường CI không có node_modules) —
  // không có gì để bootstrap; zeus build sẽ tự báo lỗi thiếu dependency.
}
