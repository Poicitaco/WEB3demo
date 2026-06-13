# Kế hoạch kiểm thử Vaultline

## 1. Mục tiêu

Xác nhận rằng người dùng chỉ truy cập được tài liệu theo đúng quyền, dữ liệu rõ không
rời thiết bị và các quy tắc cộng tác không thể bị bỏ qua.

## 2. Chiến lược

| Tầng | Phạm vi | Công cụ / trạng thái |
| --- | --- | --- |
| Static analysis | TypeScript, quy tắc code, lỗi React | ESLint, Next.js build |
| API integration | Auth, token, vault, approval, versioning | Playwright APIRequest |
| End-to-end | Gửi, nhận, mở tài liệu bằng mật khẩu | Playwright Chromium |
| Security regression | CSRF, rate limit, phân quyền, audit bất biến | Playwright APIRequest |

## 3. Ma trận yêu cầu - kiểm thử

| Yêu cầu | Kịch bản kiểm thử |
| --- | --- |
| Đăng ký thiết bị tin cậy | Chấp nhận chữ ký đúng, từ chối chữ ký của ví khác |
| Chia sẻ đích danh | Chỉ ví người nhận lấy được key envelope |
| Phân quyền nhóm | Owner, editor và viewer bị giới hạn đúng quyền |
| Phiên bản bất biến | Liên kết cũ chỉ mở đúng phiên bản cũ |
| Tự huỷ | Bản mã bị xoá sau đủ số lượt tải |
| K-of-N | Khôi phục được với K phần; không đủ K thì thất bại |
| Audit | Thành viên hợp lệ xem được; sự kiện không thể sửa/xoá |
| Rate limit | Giới hạn vẫn tồn tại qua nhiều request |
| Ranh giới đăng nhập | API workspace và mutation từ chối người chưa có session |
| Luồng người dùng | Gửi, tạo mã truy cập, nhận và mở lại đúng nội dung |

## 4. Tiêu chí hoàn thành

- `npm run lint` không có lỗi hoặc cảnh báo.
- `npm run build` thành công.
- Toàn bộ E2E bắt buộc đạt; bài demo raw-key chỉ chạy khi bật biến môi trường.
- Không có thay đổi nào làm giảm kiểm soát quyền hiện có.

## 5. Cách chạy

```bash
npm run lint
npm run build
npm run test:e2e
```

## 6. Kiểm thử nên bổ sung tiếp

- Unit test cho helper mật mã và access control.
- Kiểm thử accessibility bằng axe.
- Kiểm thử tải với nhiều tệp và liên kết đồng thời.
- Kiểm thử tương thích nhiều trình duyệt.
- Kiểm thử khôi phục sau lỗi storage/database.
