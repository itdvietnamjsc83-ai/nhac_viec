# Hướng dẫn build Nhắc Việc trên MacBook

Làm một lần, khoảng 10 phút (tùy tốc độ mạng). Kết quả là file cài đặt `NhacViec-1.3.1-mac-arm64.dmg` (máy chip Apple M1/M2/M3/M4) hoặc `NhacViec-1.3.1-mac-x64.dmg` (máy chip Intel).

## Cần chuẩn bị

- macOS 11 (Big Sur) trở lên, còn trống khoảng 2 GB, có Internet.
- **Node.js** bản LTS: tải tại https://nodejs.org (nút *Download Node.js (LTS)*), mở file `.pkg` và cài như phần mềm bình thường.
  Kiểm tra: mở **Terminal** (Cmd + Space, gõ "Terminal"), gõ `node -v`, thấy `v20…` hoặc cao hơn là được.
- Không cần cài Xcode.

## Các bước build

1. Giải nén file `nhac-viec-ma-nguon-macos.zip`, ví dụ ra thư mục `Downloads/nhac-viec`.
2. Mở **Terminal**, gõ `bash ` (có dấu cách phía sau), rồi **kéo file `build-mac.command`** trong thư mục vừa giải nén thả vào cửa sổ Terminal. Bấm **Enter**.
3. Đợi script chạy 3 bước: cài thư viện → kiểm thử → đóng gói, cuối cùng **tự mở thử app** để chắc chắn chạy được trên máy của bạn. Thấy dòng `✓ App mở được bình thường` là thành công; Finder tự mở thư mục `dist` chứa file `.dmg`.

Nếu trước đó bạn đã build bản cũ, cứ chạy lại lệnh trên trong thư mục mã nguồn **mới**; script tự cập nhật thư viện.

Muốn build cả bản cho máy Intel lẫn máy chip M (để cài cho nhiều máy khác nhau), thêm chữ `all` vào cuối lệnh ở bước 2:
`bash /đường/dẫn/build-mac.command all`

## Cài đặt và chạy

1. Mở file `.dmg`, kéo biểu tượng **NhacViec** vào thư mục **Applications** (tên file không dấu để tránh lỗi; khi chạy, thanh menu và Dock vẫn hiện "Nhắc Việc"). Nếu đã có bản cũ "Nhắc Việc.app" trong Applications, hãy xóa bản cũ đi. Dữ liệu công việc không bị mất.
2. Mở Nhắc Việc từ Launchpad. Trên chính máy đã build, app mở được ngay.
   Nếu cài sang máy Mac khác mà bị báo *"không xác định nhà phát triển"*: nhấp chuột phải vào app → **Open** → **Open**.
   Nếu bị báo *"app bị hỏng"*: mở Terminal và chạy `xattr -cr /Applications/NhacViec.app`, rồi mở lại.
3. Khi macOS hỏi, bấm **Cho phép** gửi thông báo. Nên vào **System Settings → Notifications → Nhắc Việc**, chọn kiểu **Alerts** để thông báo nằm lại trên màn hình cho tới khi bạn xử lý.
4. Bật **Tự chạy khi mở máy** trong phần *Cài đặt* của app (macOS có thể hỏi xác nhận trong *System Settings → General → Login Items*).
5. Biểu tượng chuông nằm trên **thanh menu** góc phải trên cùng. Đóng cửa sổ app không tắt nhắc việc; muốn tắt hẳn bấm chuông → **Thoát**.

## Chuyển dữ liệu từ máy Windows sang Mac

Trên Windows: **📦 Dữ liệu → Xuất toàn bộ dữ liệu** → được file `….nhacviec.json`.
Chép file sang Mac (USB, email, Zalo, AirDrop…), rồi trên Mac: **📦 Dữ liệu → Nhập dữ liệu từ máy khác** → chọn **Gộp** hoặc **Thay thế toàn bộ**.

## Gặp lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `node: command not found` | Chưa cài Node.js, hoặc cài xong chưa mở lại Terminal. Đóng Terminal, mở lại rồi chạy lệnh. |
| `npm ERR! network` / chạy rất lâu ở bước 1 | Mạng chậm hoặc bị chặn. Chạy lại lệnh; nếu dùng VPN/proxy công ty thử tắt đi. |
| `EACCES: permission denied` | Không chạy bằng `sudo`. Giải nén mã nguồn vào thư mục của bạn (Downloads, Documents) rồi chạy lại. |
| `codesign … resource fork, Finder information…` | Chạy `xattr -cr .` trong thư mục mã nguồn rồi chạy lại script. |
| Script báo `❌ App chưa mở được` | Gửi nội dung file `dist/kiem-tra.log` (và báo cáo sự cố của macOS nếu có) cho người hỗ trợ. |
| Không thấy thông báo | System Settings → Notifications → Nhắc Việc → bật *Allow Notifications*, kiểu *Alerts*. Kiểm tra chế độ *Focus/Không làm phiền* đang tắt. |

## Ký số chính thức (không bắt buộc)

Nếu có tài khoản Apple Developer (99 USD/năm) và muốn phát hành cho nhiều người mà không bị cảnh báo:
cài chứng chỉ *Developer ID Application* vào Keychain, xóa dòng `"identity": "-"` và đặt `"hardenedRuntime": true` trong `package.json` (mục `build.mac`), rồi build bằng lệnh
`npx electron-builder --mac --publish never`
(muốn notarize thêm, xem https://www.electron.build/code-signing-mac).

## Lệnh thủ công (cho người quen dùng)

```bash
npm install
npm start                 # chạy thử không cần đóng gói
npm test
npm run smoke             # tự kiểm tra: mở app rồi thoát, in SMOKE_OK nếu ổn
npm run dist:mac          # build .dmg cả Intel và Apple M (ký ad-hoc)
```
