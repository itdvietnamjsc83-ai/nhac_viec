#!/bin/bash
# Build Nhắc Việc cho macOS. Cách chạy: mở Terminal, gõ "bash " rồi kéo file này vào cửa sổ Terminal, bấm Enter.
#   bash build-mac.command          -> build cho loại chip của máy đang dùng (Apple M hoặc Intel)
#   bash build-mac.command all      -> build cả 2 bản (Apple M + Intel)
set -e
cd "$(dirname "$0")"
echo ""
echo "=== Build phần mềm Nhắc Việc cho macOS ==="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Máy chưa có Node.js."
  echo "   Hãy tải bản LTS tại https://nodejs.org , cài đặt xong thì chạy lại lệnh này."
  open "https://nodejs.org/" 2>/dev/null || true
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Cần Node.js 20 trở lên, máy đang có $(node -v). Hãy cài bản LTS mới tại https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# Gỡ cờ "tải từ Internet" để macOS không chặn các file trong thư mục mã nguồn
xattr -cr . 2>/dev/null || true

case "$1" in
  all)   ARCHS="arm64 x64" ;;
  intel) ARCHS="x64" ;;
  m|arm) ARCHS="arm64" ;;
  *)     if [ "$(uname -m)" = "arm64" ]; then ARCHS="arm64"; else ARCHS="x64"; fi ;;
esac

echo ""
echo "1/3 Cài thư viện (lần đầu mất vài phút, cần Internet)..."
npm install --no-audit --no-fund

echo ""
echo "2/3 Chạy kiểm thử..."
npm test

echo ""
echo "3/3 Đóng gói file cài đặt .dmg ($ARCHS)..."
rm -rf dist
for A in $ARCHS; do
  echo "   → Bản cho chip $([ "$A" = arm64 ] && echo 'Apple M (arm64)' || echo 'Intel (x64)')"
  # Ký "ad-hoc" (không cần tài khoản Apple Developer) đã cấu hình sẵn trong package.json
  npx electron-builder --mac dmg --$A --publish never
done

# Tự kiểm tra: mở thử app vừa build trên máy này
HOST=$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)
APP=$([ "$HOST" = arm64 ] && echo dist/mac-arm64/NhacViec.app || echo dist/mac/NhacViec.app)
if [ -d "$APP" ]; then
  echo ""
  echo "Kiểm tra app vừa build..."
  codesign --verify --deep --strict "$APP" && echo "✓ Chữ ký hợp lệ"
  set +e
  "$APP/Contents/MacOS/NhacViec" --smoke-test > dist/kiem-tra.log 2>&1
  CODE=$?
  set -e
  if grep -q SMOKE_OK dist/kiem-tra.log; then
    echo "✓ App mở được bình thường ($(grep SMOKE_OK dist/kiem-tra.log | sed 's/SMOKE_OK //'))"
  else
    echo "❌ App chưa mở được (mã lỗi $CODE). Hãy gửi nội dung file dist/kiem-tra.log cho người hỗ trợ:"
    tail -40 dist/kiem-tra.log
    exit 1
  fi
fi

echo ""
echo "✅ Xong! File cài đặt nằm trong thư mục dist:"
ls -1 dist/*.dmg
open dist 2>/dev/null || true
