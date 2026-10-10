# Nhắc Việc – phần mềm nhắc việc cho Windows và macOS

Ứng dụng máy tính để **tạo việc, đặt giờ nhắc** và **nhập tiến độ dự án từ file Excel mẫu**.
Chạy nền ở khay hệ thống (Windows) / thanh menu (macOS) và bật thông báo của hệ điều hành khi đến giờ.

## Tính năng

Tham khảo các phần mềm quản lý công việc phổ biến ở Việt Nam (MISA AMIS Công việc, Base Wework) và quốc tế (Todoist, Microsoft To Do, Trello), chọn những tính năng hữu ích nhất cho một người dùng trên máy tính:

- **Thêm việc nhanh bằng câu tiếng Việt**: gõ `Họp giao ban 9h sáng mai !cao #Website @Lan` rồi Enter. Phần mềm tự hiểu giờ, ngày, mức ưu tiên, dự án và người phụ trách.
  Hiểu được: `hôm nay`, `mai`, `ngày kia`, `thứ 2`…`chủ nhật`, `tuần sau`, `15/10`, `9h`, `9h30`, `3h chiều`, `hằng ngày/tuần/tháng`, `!cao` `!tb` `!thấp`, `#Dự_án`, `@Người`.
- **4 cách xem**: *Danh sách* (gom theo Quá hạn / Hôm nay / Sắp tới), *Bảng* Kanban kéo thả đổi trạng thái, *Lịch* tháng có **ngày âm lịch** và ngày lễ Việt Nam, *Tiến độ* dạng biểu đồ Gantt theo dự án.
- **Mức ưu tiên** Cao / Trung bình / Thấp, hiển thị bằng màu.
- **Các bước (checklist)** trong từng việc; tiến độ % tự tính theo số bước đã xong.
- **Cửa sổ cảnh báo nổi** ở góc màn hình (luôn nằm trên các cửa sổ khác, kèm âm báo) khi đến giờ, đồng thời có thông báo của Windows/macOS.
  Trên cửa sổ có thể **cộng thêm thời gian**: +5, +10, +15, +30 phút, +1 giờ, +2 giờ, 8:00 sáng mai, hoặc tự nhập số phút / giờ / ngày, hay chọn giờ cụ thể.
  Việc được hoãn vẫn nằm trong **Hàng đợi nhắc** và sẽ báo lại đúng giờ mới. Nhắc có thể lặp lại hằng ngày / tuần / tháng.
- **Hàng đợi nhắc**: xem việc đang báo, việc đã hoãn (kèm số lần hoãn) và việc sắp nhắc, có đếm ngược thời gian còn lại.
- **Ghi ngày giờ hoàn thành**: khi tích xong, phần mềm tự ghi lại ngày giờ (có thể sửa trong chi tiết việc).
  Mục *Đã xong* gom việc theo ngày hoàn thành, cho biết **đúng hạn hay trễ bao lâu** và tỷ lệ xong đúng hạn. Mỗi việc có lịch sử hoãn / hoàn thành / mở lại.
- **Nhắc trước hạn tùy chỉnh từng việc** (1.3.0): trong chi tiết việc, ô *Nhắc trước hạn* nhận nhiều mốc (bấm nhanh 15 phút, 1 giờ, 1 ngày…, hoặc gõ `1 ngày, 2 giờ, 30 phút`),
  phần mềm hiện ngay danh sách giờ sẽ nhắc. Có thể thêm *Nhắc riêng lúc* một giờ bất kỳ. Thêm nhanh cũng hiểu: `Mở thầu thứ 5 9h30 nhắc trước 1 ngày, 2 giờ`.
- **Bản điện thoại Android / iOS** (chỉ xem, thư mục `mobile/`): đồng bộ bằng *📦 Dữ liệu → 📱 Đồng bộ sang điện thoại* (quét QR qua Wi-Fi) hoặc gửi file `.nhacviec.json`. Xem `mobile/README.md`.
- **Tóm tắt mỗi sáng** (mặc định 08:00): một thông báo cho biết hôm nay có bao nhiêu việc đến hạn, bao nhiêu việc quá hạn.
- **Nhập / xuất Excel** theo file mẫu (có cột *Hoàn thành lúc*); nhập lại cùng file sẽ cập nhật tiến độ, không tạo bản trùng.
- **Chuyển dữ liệu sang máy khác**: menu *Dữ liệu → Xuất toàn bộ dữ liệu* tạo một file `.nhacviec.json`. Chép file sang máy kia (USB, email, Zalo…),
  mở Nhắc Việc rồi chọn *Dữ liệu → Nhập dữ liệu từ máy khác*. Chọn **Gộp** để giữ việc sẵn có và lấy bản sửa mới hơn, hoặc **Thay thế toàn bộ**. Dùng qua lại được giữa Windows và Mac.
- **Theo dõi dự án**: % tiến độ từng dự án ở thanh bên, vòng tiến độ, số việc xong / quá hạn, hạn cuối.
- Hoàn tác khi lỡ xóa hoặc lỡ đánh dấu xong; hiệu ứng chúc mừng khi hoàn thành việc.
- Phím tắt: `Ctrl/⌘ + N` thêm việc chi tiết, `Ctrl/⌘ + F` tìm kiếm, `/` gõ nhanh.
- Tự chạy khi mở máy (trong *Cài đặt*). Đóng cửa sổ chỉ ẩn xuống khay; muốn tắt hẳn chọn *Thoát* ở biểu tượng khay.
- Giao diện phẳng, tối giản, tự đổi sang nền tối theo hệ điều hành.
- Dữ liệu lưu cục bộ tại:
  - Windows: `%APPDATA%\Nhắc Việc\nhac-viec-data.json`
  - macOS: `~/Library/Application Support/Nhắc Việc/nhac-viec-data.json`

## File Excel mẫu

`assets/mau-tien-do-du-an.xlsx` (trong app: nút **Tải file Excel mẫu**). Sheet "Tiến độ dự án" gồm các cột:

| Dự án* | Công việc* | Người phụ trách | Ngày bắt đầu | Hạn hoàn thành | Giờ hạn | Tiến độ (%) | Trạng thái | Ưu tiên | Nhắc trước | Hoàn thành lúc | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|

- **Hạn có giờ** (từ 1.3.0): ghi giờ ở cột *Giờ hạn* (`09:00`, `14h30`) hoặc ngay trong ô hạn (`15/10/2026 09:30`). Không ghi giờ thì hạn tính 17:00.
- **Nhắc trước** (từ 1.3.0): ghi khoảng thời gian trước giờ hạn, nhiều mốc cách nhau dấu phẩy, vd. `3 ngày, 1 ngày, 2 giờ, 30 phút` = nhắc 4 lần.
  Viết tắt được: `2n`, `3g`, `45p`, `1 tuần`. Chỉ ghi số (vd. `1`) là kiểu cũ: nhắc lúc 08:00 trước hạn 1 ngày. File mẫu cũ (cột *Nhắc trước (ngày)*) vẫn đọc được.
- Ngày nhập dạng `dd/mm/yyyy`. Trạng thái: *Chưa bắt đầu / Đang thực hiện / Tạm dừng / Hoàn thành* (bỏ trống thì tự suy ra từ tiến độ).
- Có thể dùng file Excel của riêng bạn, miễn là dòng tiêu đề (trong 10 dòng đầu) có cột **Dự án** và **Công việc**; thứ tự cột không quan trọng.
- Chỉ hỗ trợ `.xlsx` (Excel 2007 trở lên). File `.xls` cũ: mở bằng Excel rồi *Lưu thành* `.xlsx`.

## Cài đặt

**Windows**: chạy `NhacViec-1.3.1-win-x64.exe`. Vì bộ cài chưa ký số, Windows SmartScreen có thể cảnh báo: bấm *More info* → *Run anyway*.

**macOS**: mở file `.dmg`, kéo *Nhắc Việc* vào Applications. Lần đầu mở, macOS báo "không xác định nhà phát triển":
nhấp chuột phải vào app → *Open* → *Open* (hoặc chạy `xattr -cr "/Applications/Nhắc Việc.app"`).
Khi được hỏi, cho phép app gửi thông báo (System Settings → Notifications → Nhắc Việc).

## Chạy và đóng gói từ mã nguồn

Cần [Node.js](https://nodejs.org) 20 trở lên.

```bash
npm install
npm start            # chạy thử
npm run smoke        # tự kiểm tra: mở app rồi thoát (in SMOKE_OK)
npm test             # kiểm thử Excel, lưu trữ, nhắc lặp lại, âm lịch, nhập nhanh
npm run template     # tạo lại file Excel mẫu
npm run dist:win     # tạo bộ cài Windows (.exe) -> thư mục dist/
npm run dist:mac     # tạo bộ cài macOS (.dmg)  -> chạy trên máy Mac
```

Bộ cài macOS phải đóng gói trên máy Mac: xem **HUONG-DAN-BUILD-MAC.md**, chỉ cần chạy `bash build-mac.command`. Nếu không có máy Mac: đưa mã nguồn lên GitHub và chạy workflow
`.github/workflows/build.yml` (tab **Actions → Đóng gói Nhắc Việc → Run workflow**), GitHub sẽ build cả `.exe` và `.dmg`.

## Cấu trúc mã nguồn

```
src/main.js        tiến trình chính: cửa sổ, khay hệ thống, bộ hẹn giờ nhắc (20 giây/lần), thông báo, hộp thoại file
src/preload.js     cầu nối an toàn giữa giao diện và tiến trình chính
src/tasks.js       lưu trữ JSON, nhập dòng Excel, tính giờ nhắc / lặp lại / báo lại
src/excel.js       đọc file Excel, tạo file mẫu, xuất Excel (thư viện exceljs)
src/renderer/      giao diện (HTML/CSS/JS thuần, tiếng Việt, hỗ trợ chế độ tối)
  alert.html/.js   cửa sổ cảnh báo nổi khi đến giờ
  lunar.js         đổi dương lịch sang âm lịch, ngày lễ Việt Nam
  quickadd.js      hiểu câu nhập nhanh tiếng Việt
assets/            biểu tượng và file Excel mẫu
scripts/           tạo file mẫu, kiểm thử
```
