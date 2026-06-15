# Ghi chú cập nhật báo cáo và slide

## Nội dung nên thêm vào báo cáo

### 1. Luồng phê duyệt A+B cấp token cho C

Mô tả:

- C tạo yêu cầu truy cập cho tài liệu trong kho.
- A và B giải mã share của chính mình trên thiết bị cá nhân.
- A và B bọc lại share đó bằng public key mã hoá của C.
- Khi đủ ngưỡng, server phát hành một approval token bị ràng buộc với ví C.
- C dùng token để lấy bản mã, sau đó trình duyệt C ghép các share để khôi phục khoá file.

Điểm bảo mật:

- Server không có plaintext file key.
- Token chỉ cấp quyền tải bản mã, không chứa khoá.
- Token bị giới hạn theo ví C và thời hạn của approval request.

### 2. Huỷ tài liệu đã gửi

Mô tả:

- Chỉ chủ tài liệu được huỷ.
- Hệ thống đánh dấu `destroyed_at`, thu hồi mọi token, huỷ các approval request đang chờ.
- Ciphertext được xoá khỏi local storage hoặc Cloudflare R2 nếu không còn file active nào tham chiếu cùng CID.
- Audit event `file.destroyed` vẫn được giữ lại.

Điểm cần nói rõ:

> Hệ thống không hard-delete toàn bộ metadata vì cần giữ bằng chứng truy vết cho audit.

### 3. Storage online bằng Cloudflare R2

Mô tả:

- Local demo dùng thư mục `storage`.
- Online demo đặt `STORAGE_PROVIDER=r2`.
- Object key là hash SHA-256 của ciphertext, nên không lộ tên file gốc.
- Metadata và quyền truy cập vẫn do API kiểm soát.

Giới hạn:

- SQLite phù hợp demo một instance.
- Muốn scale production nhiều instance thì chuyển metadata sang PostgreSQL.

### 4. Chống chụp màn hình

Nên viết thẳng:

> Website không thể ngăn tuyệt đối việc chụp màn hình ở tầng hệ điều hành. Hệ thống chọn hướng giảm thiểu và truy vết: watermark theo ví/token, audit mở file, hết hạn, thu hồi, giới hạn thiết bị ở mức phiên ví và Viewer chỉ đọc.

## Ảnh nên chụp cho báo cáo

1. Landing page có logo.
2. Upload Wizard với lựa chọn chỉ đọc / gói mã hoá.
3. Dashboard tài liệu đã gửi.
4. Màn hình tạo kho và thêm thành viên.
5. Màn hình phê duyệt A+B cho C.
6. Download Viewer có watermark.
7. Token Manager có trạng thái thu hồi/đã huỷ.
8. Audit feed.
9. Health endpoint hoặc cấu hình R2 trong `.env.example`.

## Slide nên thêm

- Slide kiến trúc: Browser crypto -> API metadata -> SQLite -> R2 ciphertext.
- Slide luồng A+B+C: request -> approve -> approval token -> viewer.
- Slide giới hạn: không chống screenshot tuyệt đối, chưa ZKP/on-chain production.

