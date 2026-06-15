# WEB3demo - Hệ thống chia sẻ tài liệu mã hóa có phê duyệt nhiều ví

WEB3demo là một hệ thống chia sẻ tài liệu bảo mật cho bối cảnh học thuật: người gửi tải tài liệu lên, tài liệu được mã hóa ở trình duyệt, ciphertext được lưu trên storage, còn quyền truy cập được kiểm soát bằng ví, token, thời hạn và cơ chế phê duyệt nhiều người.

Dự án được xây cho môn Kỹ thuật phần mềm, tập trung vào logic sản phẩm, kiến trúc hệ thống, luồng demo rõ ràng và khả năng mở rộng lên cloud.

## Mục tiêu sản phẩm

Bài toán không chỉ là "mã hóa rồi tải xuống". Hệ thống hướng tới một kịch bản thực tế hơn:

- Tác giả A sở hữu tài liệu hoặc bài báo khoa học.
- Tài liệu không được lưu bản gốc trên server.
- Người nhận C không tự mở được nếu chưa có quyền.
- Một số tài liệu cần A và B cùng duyệt trước khi C nhận được token mở.
- Chủ sở hữu có thể thu hồi token hoặc hủy tài liệu đã gửi.
- Hệ thống có dashboard, audit log và viewer để trình bày rõ luồng bảo vệ.

## Tính năng chính

- Đăng nhập bằng ví MetaMask, không dùng mật khẩu truyền thống.
- Mã hóa file phía client bằng Web Crypto API.
- Lưu metadata trong SQLite, hỗ trợ Railway Volume khi deploy online.
- Lưu ciphertext bằng local filesystem hoặc Cloudflare R2.
- Tạo token chia sẻ có thời hạn, có thể thu hồi.
- Hỗ trợ chế độ chỉ xem trong protected viewer.
- Dashboard quản lý tài liệu, token, kho nhóm và phê duyệt.
- Luồng phê duyệt ngưỡng: ví A và B cùng duyệt thì C mới mở được.
- Hủy tài liệu bởi chủ sở hữu, đồng thời thu hồi token và approval còn liên quan.
- Audit trail cho các hành động nhạy cảm.
- Healthcheck `/api/health` để kiểm tra deploy.

## Kiến trúc tổng quan

```txt
Browser
  |-- MetaMask ký nonce để đăng nhập
  |-- Web Crypto mã hóa / giải mã file
  |-- Protected viewer hiển thị nội dung được cấp quyền

Next.js App
  |-- App Router UI
  |-- API routes: auth, files, tokens, approvals, vaults, audit, storage
  |-- JWT session bằng cookie
  |-- CSRF protection cho mutation API

Database
  |-- SQLite
  |-- Local: data/app.sqlite
  |-- Railway: /app/data/app.sqlite qua volume

Storage
  |-- local: thư mục storage/
  |-- r2: Cloudflare R2 bucket, ví dụ r2web3
```

## Tech stack

- Next.js 15, React 19, TypeScript.
- Ethers.js cho MetaMask.
- Web Crypto API cho mã hóa phía client.
- better-sqlite3 cho metadata.
- Cloudflare R2 qua S3-compatible SDK.
- Playwright cho E2E test.
- Docker/Railway cho deploy.

## Luồng demo 3 ví

Chuẩn bị 3 ví MetaMask:

- A: chủ sở hữu tài liệu.
- B: người đồng duyệt.
- C: người nhận tài liệu.

Kịch bản demo đề xuất:

1. A đăng nhập bằng ví.
2. A đăng ký encryption identity.
3. A tạo kho hoặc tài liệu cần phê duyệt.
4. A upload file, hệ thống mã hóa file trước khi upload.
5. C yêu cầu mở tài liệu.
6. A duyệt một lần, hệ thống vẫn chưa cấp token vì chưa đủ ngưỡng.
7. B đăng nhập và duyệt lần hai.
8. Khi đủ ngưỡng 2/2, hệ thống cấp approval token cho C.
9. C nhập token, mở tài liệu trong viewer.
10. A thu hồi token hoặc hủy tài liệu để chứng minh vòng đời quyền truy cập.

## Chạy local

Yêu cầu:

- Node.js 20 trở lên.
- npm.
- MetaMask trên trình duyệt.

Cài dependency:

```bash
npm install
```

Tạo file môi trường từ mẫu:

```bash
copy .env.example .env.local
```

Với Windows PowerShell có thể dùng:

```powershell
Copy-Item .env.example .env.local
```

Chạy dev:

```bash
npm run dev
```

Mở:

```txt
http://localhost:3000
```

Chạy giống production để demo ổn định hơn:

```bash
npm run build
npm run start
```

## Cấu hình local storage

Nếu chỉ cần chạy toàn bộ trên máy:

```env
JWT_SECRET=replace-with-a-long-random-secret
REQUIRE_CSRF=true
DB_PATH=data/app.sqlite
STORAGE_PROVIDER=local
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

File mã hóa sẽ nằm trong `storage/`, metadata nằm trong `data/app.sqlite`.

## Cấu hình local nhưng dùng Cloudflare R2

Đây là phương án dự phòng tốt nếu Railway chưa ổn: app chạy local, nhưng file mã hóa vẫn lưu cloud.

```env
JWT_SECRET=replace-with-a-long-random-secret
REQUIRE_CSRF=true
DB_PATH=data/app.sqlite
STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=<account_id>
CLOUDFLARE_R2_BUCKET=<bucket_name>
CLOUDFLARE_R2_ACCESS_KEY_ID=<rotated_access_key_id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<rotated_secret_access_key>
CLOUDFLARE_R2_KEY_PREFIX=ciphertexts
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Không commit `.env.local`, `.env.production` hoặc bất kỳ file chứa key nào.

## Deploy Railway

Repository có sẵn:

- `Dockerfile`
- `railway.json`
- `/api/health`
- hỗ trợ `DB_PATH=/app/data/app.sqlite`

Biến môi trường cần có trên Railway:

```env
JWT_SECRET=<long_random_secret>
REQUIRE_CSRF=true
DB_PATH=/app/data/app.sqlite
STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=<account_id>
CLOUDFLARE_R2_BUCKET=<bucket_name>
CLOUDFLARE_R2_ACCESS_KEY_ID=<rotated_access_key_id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<rotated_secret_access_key>
CLOUDFLARE_R2_KEY_PREFIX=ciphertexts
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Railway cần volume mount tại:

```txt
/app/data
```

Sau khi deploy, kiểm tra:

```txt
https://your-domain.up.railway.app/api/health
```

Kết quả kỳ vọng:

```json
{
  "ok": true,
  "database": "ready",
  "storageProvider": "r2"
}
```

## Scripts

```bash
npm run dev          # chạy dev server
npm run build        # build production
npm run start        # chạy production server
npm run lint         # kiểm tra lint
npm run test:e2e     # chạy Playwright E2E
npm run clean        # xóa cache build
```

## Cấu trúc thư mục

```txt
src/
  app/
    api/             # API routes
    dashboard/       # dashboard quản lý
    download/        # trang nhận/mở tài liệu
    upload/          # trang upload
  components/        # UI component
  contexts/          # Auth context
  lib/               # db, storage, crypto helpers, csrf, audit
docs/                # tài liệu demo, triển khai, test plan
public/              # logo và visual assets
tests/               # Playwright E2E
data/                # SQLite local, không dùng để commit dữ liệu thật
storage/             # ciphertext local, không dùng để commit dữ liệu thật
```

## API chính

- `POST /api/auth/start`: tạo nonce đăng nhập.
- `POST /api/auth/verify`: xác thực chữ ký ví.
- `POST /api/storage/upload`: upload ciphertext.
- `GET /api/storage/get`: lấy ciphertext nếu token hợp lệ.
- `POST /api/files`: tạo metadata tài liệu.
- `DELETE /api/files/[id]`: chủ sở hữu hủy tài liệu.
- `POST /api/tokens/issue`: cấp token.
- `POST /api/tokens/validate`: kiểm tra token.
- `POST /api/tokens/revoke`: thu hồi token.
- `GET /api/approvals`: danh sách yêu cầu phê duyệt.
- `POST /api/approvals/[id]/approve`: duyệt yêu cầu.
- `GET /api/audit`: xem audit event.
- `GET /api/health`: kiểm tra app/database.

## Tài liệu liên quan

- `docs/RAILWAY_DEPLOYMENT.md`: hướng dẫn Railway chi tiết.
- `docs/DEPLOYMENT.md`: hướng dẫn deploy tổng quát.
- `docs/REHEARSAL_SCRIPT.md`: kịch bản nói khi bảo vệ.
- `docs/REPORT_UPDATE_NOTES.md`: gợi ý cập nhật báo cáo.
- `docs/SOFTWARE_ENGINEERING.md`: phân tích kỹ thuật phần mềm.
- `docs/TEST_PLAN.md`: chiến lược kiểm thử.
- `docs/UI_HANDOFF.md`: ghi chú UI/UX.
- `docs/screenshots/`: ảnh chụp giao diện dùng cho báo cáo.

## Giới hạn bảo mật cần nói rõ khi bảo vệ

Hệ thống bảo vệ file ở mức mã hóa và quyền truy cập, nhưng không thể ngăn tuyệt đối mọi hành vi ngoài hệ thống:

- Nếu người dùng được xem, họ vẫn có thể chụp màn hình bằng thiết bị khác.
- Viewer chỉ đọc giúp giảm rủi ro tải bản gốc, không phải DRM tuyệt đối.
- Audit log giúp phát hiện và truy vết hành vi bất thường.
- Muốn tiến xa hơn có thể thêm watermark cá nhân hóa, phát hiện chụp màn hình, ZK permission proof, Merkle audit receipt hoặc time-locked encryption.

Đây là điểm nên trình bày thẳng với giảng viên: hệ thống không hứa "không thể bị copy", mà thiết kế để giảm rủi ro, kiểm soát quyền, ghi nhận truy cập và chứng minh vòng đời bảo vệ tài liệu.

## Trạng thái hiện tại

Đã có bản demo hoạt động với:

- Local filesystem hoặc Cloudflare R2.
- SQLite local hoặc Railway volume.
- UI dashboard mới.
- Luồng token và approval nhiều ví.
- Protected viewer.
- Healthcheck và Docker deploy.

Trước khi demo, nên chạy:

```bash
npm run lint
npm run build
```

Sau đó chọn một trong hai cách:

- Online: Railway + R2.
- Dự phòng: local app + R2.

