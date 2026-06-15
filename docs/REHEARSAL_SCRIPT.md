# Kịch bản bảo vệ demo 7-10 phút

## Vai trò chuẩn bị

- Ví A: chủ kho, người tải tài liệu lên.
- Ví B: biên tập viên, người cùng phê duyệt.
- Ví C: người xem, người yêu cầu mở tài liệu.

Chuẩn bị trước:

- Một file PDF hoặc TXT nhỏ.
- Một kho nhóm có A là chủ kho, B là biên tập viên, C là người xem.
- Chính sách ngưỡng đặt là `2/3` hoặc giải thích rõ demo dùng A+B để cấp quyền cho C.
- Nếu demo online, kiểm tra `/api/health` trả `ok: true`.

## Mở đầu

Nói ngắn:

> Hệ thống này bảo vệ tài liệu riêng tư bằng mã hoá phía trình duyệt. Server chỉ lưu bản mã, metadata, token và audit; server không có bản rõ và không tự khôi phục được khoá.

Điểm cần nhấn:

- Người dùng đăng nhập bằng ví.
- File được mã hoá bằng AES-GCM trước khi upload.
- Quyền truy cập được kiểm soát bằng token, vai trò trong kho và phê duyệt nhiều người.

## Flow 1: upload và mở bằng token thường

1. A kết nối ví.
2. A upload một tài liệu cá nhân.
3. Chọn chế độ chỉ đọc trong Viewer.
4. Tạo token.
5. Mở link download, kiểm tra quyền, nhập mật khẩu nếu có.
6. Cho thấy Viewer có watermark và không có nút tải bản gốc.

Nói:

> Khi tải xuống, người nhận không nhận bản gốc trực tiếp. Nếu chủ tài liệu cho phép tải, hệ thống chỉ tải gói `.vaultline` vẫn còn mã hoá.

## Flow 2: kho nhóm và phê duyệt A+B cho C

1. A tạo kho nhóm.
2. Thêm B là biên tập viên, C là người xem.
3. Bật chính sách phê duyệt theo ngưỡng.
4. A upload tài liệu vào kho, hệ thống chia khoá thành các mảnh Shamir.
5. C tạo yêu cầu truy cập.
6. A phê duyệt.
7. B phê duyệt.
8. Chỉ sau lần phê duyệt thứ hai, hệ thống cấp token riêng cho C.
9. C mở token; trình duyệt C ghép các share đã được bọc riêng cho C để khôi phục khoá.

Nói:

> Điểm quan trọng là token không thay thế khoá. Token chỉ là cổng truy cập bản mã. Khoá file được khôi phục ở trình duyệt C từ các mảnh mà A và B đã phê duyệt.

## Flow 3: thu hồi và huỷ tài liệu

1. Vào Dashboard.
2. Mở phần tài liệu đã gửi.
3. Chọn huỷ tài liệu.
4. Giải thích: mọi token bị thu hồi, request đang chờ bị huỷ, bản mã được xoá khỏi storage nếu không còn phiên bản nào dùng chung.
5. Thử validate lại token cũ để thấy không còn dùng được.

Nói:

> Đây là thao tác huỷ có audit, không phải xoá dấu vết. Metadata sự kiện vẫn được giữ để chứng minh ai đã thao tác và khi nào.

## Flow 4: audit và phiên bản

1. Mở Dashboard activity feed.
2. Chỉ ra các sự kiện như tạo file, cấp token, phê duyệt, xem file, huỷ file.
3. Mở lịch sử phiên bản nếu có.

Nói:

> Audit log là append-only trong SQLite bằng trigger, nên không thể sửa hoặc xoá qua API thông thường.

## Câu hỏi dễ gặp

**Người xem chụp màn hình thì sao?**

Không thể ngăn tuyệt đối ảnh chụp màn hình ở tầng web. Hệ thống giảm rủi ro bằng watermark theo ví/token, audit thời gian mở, hạn dùng, thu hồi và chỉ đọc trong Viewer. Đây là kiểm soát truy vết, không phải DRM tuyệt đối.

**Server có giải mã được file không?**

Không. Server giữ bản mã và metadata. Với file ngưỡng, server cũng chỉ lưu các share đã được mã hoá cho từng người, không tự ghép được khoá.

**Tại sao cần 3 ví?**

Để chứng minh phân quyền: A sở hữu, B cùng chịu trách nhiệm phê duyệt, C chỉ được mở khi đủ điều kiện. Nếu C dùng token bằng ví khác, API từ chối.

**Cloudflare R2 dùng để làm gì?**

R2 lưu ciphertext khi triển khai online. Metadata vẫn nằm trong SQLite có persistent volume ở bản demo; nếu scale nhiều replica thì bước tiếp theo là PostgreSQL.

