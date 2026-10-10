# Nhắc Việc – bản điện thoại

Bản **chỉ xem** cho Android và iOS. Không tạo hay sửa việc; dữ liệu lấy từ bản máy tính.

## Đồng bộ (2 cách, mỗi lần đồng bộ thay toàn bộ dữ liệu cũ trên điện thoại)
**Qua Wi-Fi (nhanh nhất, cần chung mạng):**
1. Trên máy tính: **📦 Dữ liệu → 📱 Đồng bộ sang điện thoại**. Cửa sổ hiện mã QR, địa chỉ (vd. `192.168.1.5:47800`) và mã 6 số.
2. Trên điện thoại: bấm **⟳ → Quét mã QR trên máy tính** (hoặc **Nhập địa chỉ và mã**).
3. Lần sau chỉ cần mở cửa sổ đồng bộ trên máy tính và bấm **⟳ Lấy lại từ máy tính** trên điện thoại (mã giữ nguyên tới khi bấm *Đổi mã mới*).

Cổng đồng bộ chỉ mở khi cửa sổ đang mở, tự đóng sau 10 phút, khóa sau 10 lần nhập sai mã. Lần đầu Windows hỏi tường lửa: chọn *Cho phép* cho mạng riêng.

**Gửi file (khi không chung Wi-Fi):** máy tính **📤 Xuất toàn bộ dữ liệu** → gửi file `.nhacviec.json` qua Zalo / email → điện thoại **⟳ → Chọn file**.

Sau khi đồng bộ, app tự đặt **thông báo** cho mọi mốc nhắc sắp tới (giờ nhắc riêng, các mốc "nhắc trước hạn", giờ đã hoãn).

## Giao diện
- **Điện thoại thanh** và **màn ngoài Z Fold** (< 700px): 1 cột, thanh tab dưới (Hôm nay · 7 ngày · Nhắc · Dự án · Khác), chi tiết trượt từ phải, vuốt mép trái để quay lại.
- **Z Fold mở / máy tính bảng / xoay ngang** (≥ 700px): 2 cột danh sách | chi tiết, tự đổi khi gập mở máy.
- Màn gập có bản lề báo qua `viewport-segments`: mỗi cột nằm gọn một nửa, tránh đường gập.
- Tự theo chế độ sáng / tối của máy.

Xem thử trên máy tính: mở `www/index.html?demo=1` bằng Chrome, bấm F12 → biểu tượng điện thoại để chọn khổ máy.

## Đóng gói (Capacitor)
Cần Node 20+.

**Android** (Windows / Mac / Linux). Thư mục `android/` đã tạo sẵn, chỉ cần cài [Android Studio](https://developer.android.com/studio):
```
npm install
npm run android          # mở Android Studio → Build → Build App Bundle(s) / APK(s) → Build APK(s)
```
File APK nằm ở `android/app/build/outputs/apk/debug/app-debug.apk`; chép sang điện thoại và mở để cài (cho phép "cài ứng dụng không rõ nguồn").
Hoặc đẩy mã nguồn lên GitHub và chạy workflow *Đóng gói Nhắc Việc* (job `android`) để tự tạo APK.

**iOS** (bắt buộc máy Mac có Xcode, cần Apple ID; muốn cài lâu dài hoặc phát hành cần tài khoản Apple Developer 99 USD/năm):
```
npm install
npx cap add ios          # chỉ lần đầu
npm run ios              # mở Xcode → chọn iPhone → Run
```
Với iOS cần thêm vào `ios/App/App/Info.plist` để đồng bộ Wi-Fi và quét QR chạy được:
`NSAppTransportSecurity → NSAllowsLocalNetworking = YES`, `NSLocalNetworkUsageDescription` = "Nhận dữ liệu từ máy tính trong cùng Wi-Fi", `NSCameraUsageDescription` = "Quét mã QR đồng bộ".

`lunar.js` và `remind.js` dùng chung với bản máy tính (`../src/renderer/`); `npm run sync-libs` chép bản mới nhất sang `www/`.
