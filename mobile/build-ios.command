#!/bin/bash
# Build bản iPhone của Nhắc Việc trên máy Mac. Cần: Xcode (App Store), Node 20+.
# Cách chạy: mở Terminal, kéo file này vào rồi Enter (hoặc: bash build-ios.command)
set -e
cd "$(dirname "$0")"
echo "== Nhắc Việc – build bản iPhone =="
command -v node >/dev/null || { echo "Chưa có Node.js. Tải tại https://nodejs.org (bản LTS) rồi chạy lại."; exit 1; }
xcode-select -p >/dev/null 2>&1 || { echo "Chưa có Xcode. Cài Xcode từ App Store, mở 1 lần để đồng ý điều khoản, rồi chạy lại."; exit 1; }
xattr -cr . 2>/dev/null || true
npm install
npm run sync-libs
[ -d ios ] || npx cap add ios
npx cap sync ios
# Cho phép nhận dữ liệu qua Wi-Fi trong mạng nội bộ và dùng camera quét QR
PL=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
$PB -c "Delete :NSAppTransportSecurity" $PL 2>/dev/null || true
$PB -c "Add :NSAppTransportSecurity dict" $PL
$PB -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" $PL
$PB -c "Delete :NSLocalNetworkUsageDescription" $PL 2>/dev/null || true
$PB -c "Add :NSLocalNetworkUsageDescription string Nhận dữ liệu công việc từ máy tính trong cùng Wi-Fi" $PL
$PB -c "Delete :NSCameraUsageDescription" $PL 2>/dev/null || true
$PB -c "Add :NSCameraUsageDescription string Quét mã QR để đồng bộ với máy tính" $PL
echo
echo "Xong phần chuẩn bị. Xcode sẽ mở ra, anh làm tiếp:"
echo " 1. Cắm iPhone vào Mac (iPhone: Cài đặt > Quyền riêng tư & Bảo mật > Chế độ nhà phát triển: Bật)."
echo " 2. Bấm mục App (bên trái) > Signing & Capabilities > Team: chọn Apple ID của anh (Add Account nếu chưa có)."
echo " 3. Chọn iPhone ở thanh trên cùng rồi bấm nút ▶ (Run)."
echo " 4. Lần đầu trên iPhone: Cài đặt > Cài đặt chung > Quản lý VPN & thiết bị > tin cậy Apple ID của anh."
npx cap open ios
