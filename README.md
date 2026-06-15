# WEB3demo

**Hệ thống chia sẻ tài liệu bảo mật với định danh ví, mã hóa phía client, phê duyệt nhiều ví, viewer bảo vệ và lưu trữ Cloudflare R2.**

WEB3demo là một dự án phục vụ môn Kỹ thuật phần mềm, mô phỏng cách một tài liệu nhạy cảm như bài báo khoa học, luận văn hoặc tài liệu nội bộ có thể được mã hóa trước khi tải lên, chia sẻ bằng token có thể thu hồi, và chỉ được mở khi thỏa mãn chính sách quyền truy cập.

Dự án không chỉ là một chức năng upload file. Nó được thiết kế như một hệ thống sản phẩm nhỏ gồm: định danh, lưu trữ, phân quyền, phê duyệt, viewer, audit trail và triển khai cloud.

## Điểm nổi bật

- **Định danh bằng ví**: người dùng đăng nhập bằng MetaMask thông qua ký nonce.
- **Mã hóa phía client**: file được mã hóa ngay trong trình duyệt trước khi gửi lên server.
- **Không lưu bản gốc**: server chỉ lưu ciphertext và metadata, không lưu file gốc.
- **Phê duyệt nhiều ví**: với tài liệu nhạy cảm, A và B phải cùng duyệt thì C mới nhận quyền mở.
- **Viewer bảo vệ**: người nhận mở tài liệu trong giao diện kiểm soát thay vì tải bản gốc theo mặc định.
- **Token có thể thu hồi**: chủ sở hữu có thể thu hồi token hoặc hủy tài liệu.
- **Audit trail**: các hành động quan trọng được ghi lại để truy vết.
- **Sẵn sàng dùng cloud storage**: hỗ trợ local filesystem hoặc Cloudflare R2.
- **Triển khai Railway**: có Dockerfile, healthcheck và hỗ trợ SQLite qua persistent volume.

## Bài toán sản phẩm

Câu hỏi chính của hệ thống:

> Khi một tài liệu nghiên cứu đã được chia sẻ, làm sao để chủ sở hữu vẫn kiểm soát được quyền truy cập sau khi upload?

WEB3demo trả lời bằng mô hình nhiều lớp:

1. Trình duyệt mã hóa file trước khi upload.
2. Backend chỉ lưu payload đã mã hóa và metadata phân quyền.
3. Quyền truy cập được cấp bằng token có phạm vi và thời hạn.
4. Tài liệu rủi ro cao có thể yêu cầu nhiều ví cùng phê duyệt.
5. Viewer giảm nguy cơ lộ bản gốc do thao tác tải xuống.
6. Thu hồi, hủy tài liệu và audit log giúp chứng minh vòng đời bảo vệ.

## Luồng demo đề xuất

Kịch bản bảo vệ nên dùng 3 tài khoản MetaMask:

| Vai trò | Ví | Mục đích |
| --- | --- | --- |
| A | Chủ sở hữu | Upload và kiểm soát tài liệu |
| B | Người duyệt | Đồng phê duyệt quyền truy cập |
| C | Người nhận | Yêu cầu và mở tài liệu được bảo vệ |

Các bước demo:

1. A kết nối ví và đăng ký encryption identity.
2. A upload tài liệu. File được mã hóa trong trình duyệt.
3. A tạo luồng chia sẻ cần phê duyệt theo ngưỡng.
4. C yêu cầu quyền mở tài liệu.
5. A duyệt lần thứ nhất. Hệ thống vẫn chưa cấp token vì chưa đủ ngưỡng.
6. B kết nối ví và duyệt lần thứ hai.
7. Khi đủ ngưỡng 2/2, hệ thống cấp approval token cho C.
8. C nhập token và mở tài liệu trong protected viewer.
9. A thu hồi token hoặc hủy tài liệu.
10. Dashboard và audit trail thể hiện toàn bộ vòng đời truy cập.

## Kiến trúc hệ thống

```txt
┌─────────────────────────────────────────────────────────────┐
│ Trình duyệt                                                  │
│ - Ký nonce bằng MetaMask                                     │
│ - Mã hóa / giải mã bằng Web Crypto                           │
│ - Protected viewer để xem tài liệu                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Ứng dụng Next.js                                             │
│ - App Router UI                                              │
│ - API routes: auth, files, tokens, approvals, audit          │
│ - Phiên đăng nhập bằng JWT cookie                            │
│ - CSRF protection cho API thay đổi dữ liệu                   │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────┐   ┌───────────▼──────────────┐
│ SQLite Metadata DB            │   │ Object Storage            │
│ - phiên ví                    │   │ - local filesystem         │
│ - files/tokens/approvals      │   │ - Cloudflare R2            │
│ - audit events                │   │ - chỉ lưu ciphertext       │
└───────────────────────────────┘   └──────────────────────────┘
```

## Công nghệ sử dụng

| Lớp | Công nghệ |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| Ví | MetaMask, Ethers.js |
| Mã hóa | Web Crypto API |
| Backend | Next.js API routes |
| Database | SQLite, better-sqlite3 |
| Storage | Local filesystem hoặc Cloudflare R2 |
| Kiểm thử | ESLint, Playwright |
| Triển khai | Docker, Railway |

## Mô hình bảo mật

WEB3demo sử dụng hướng tiếp cận defense-in-depth:

- Server không chủ động lưu file gốc.
- File được mã hóa trước khi upload.
- Storage chỉ nhận ciphertext.
- Token có thời hạn và có thể bị thu hồi.
- Phê duyệt nhiều ví giúp tránh việc một người tự ý cấp quyền cho tài liệu nhạy cảm.
- Audit event ghi lại các thao tác truy cập và thay đổi quan trọng.
- Chế độ raw key demo bị tắt mặc định trong cấu hình production-style.

Giới hạn quan trọng:

WEB3demo không phải DRM tuyệt đối. Nếu người dùng đã được phép xem nội dung, họ vẫn có thể copy thủ công hoặc chụp ảnh màn hình bằng thiết bị khác. Hệ thống tập trung vào mã hóa, kiểm soát truy cập, vòng đời quyền và khả năng truy vết, không đưa ra lời hứa phi thực tế rằng tài liệu "không bao giờ bị copy".

Đây là điểm nên nói thẳng khi bảo vệ: dự án hiểu đúng ranh giới giữa mã hóa, phân quyền, hạn chế viewer và rò rỉ do hành vi con người.

## Bảng tính năng

| Nhóm chức năng | Trạng thái |
| --- | --- |
| Đăng nhập bằng ví | Đã có |
| Mã hóa phía client | Đã có |
| Upload file mã hóa | Đã có |
| Cloudflare R2 provider | Đã có |
| Cấp / kiểm tra / thu hồi token | Đã có |
| Protected viewer | Đã có |
| Phê duyệt ngưỡng A + B -> C | Đã có |
| Chủ sở hữu hủy tài liệu | Đã có |
| Audit trail | Đã có |
| Dashboard quản lý | Đã có |
| Docker/Railway deploy | Đã có |
| AI policy assistant | Không đưa vào giai đoạn này |
| ZK permission proof | Định hướng phát triển |
| Time-locked encryption | Định hướng phát triển |

## Chạy local

Yêu cầu:

- Node.js 20 trở lên.
- npm.
- Extension MetaMask trên trình duyệt.

Cài dependency:

```bash
npm install
```

Tạo file môi trường local:

```powershell
Copy-Item .env.example .env.local
```

Chạy development server:

```bash
npm run dev
```

Mở:

```txt
http://localhost:3000
```

Để demo ổn định hơn, nên chạy theo chế độ production local:

```bash
npm run build
npm run start
```

## Biến môi trường

Cấu hình local tối thiểu:

```env
JWT_SECRET=replace-with-a-long-random-secret
REQUIRE_CSRF=true
DB_PATH=data/app.sqlite
STORAGE_PROVIDER=local
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Cấu hình local nhưng dùng Cloudflare R2:

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

Không commit `.env.local`, `.env.production`, API token, R2 key hoặc bất kỳ thông tin bí mật nào.

## Triển khai Railway

Repository đã có sẵn:

- `Dockerfile`
- `railway.json`
- `/api/health`
- Hỗ trợ SQLite qua `DB_PATH`
- Hỗ trợ storage Cloudflare R2

Biến môi trường cần đặt trên Railway:

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

Kiểm tra healthcheck sau khi deploy:

```txt
https://your-domain.up.railway.app/api/health
```

Kết quả mong đợi:

```json
{
  "ok": true,
  "database": "ready",
  "storageProvider": "r2"
}
```

## Scripts

```bash
npm run dev          # chạy development server
npm run build        # build production
npm run start        # chạy production server
npm run lint         # kiểm tra static/lint
npm run test:e2e     # chạy Playwright E2E
npm run clean        # xóa cache build
```

## API chính

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/auth/start` | Tạo nonce đăng nhập bằng ví |
| `POST /api/auth/verify` | Xác thực chữ ký ví |
| `POST /api/storage/upload` | Upload ciphertext |
| `GET /api/storage/get` | Lấy ciphertext sau khi kiểm tra quyền |
| `POST /api/files` | Tạo metadata tài liệu |
| `DELETE /api/files/[id]` | Chủ sở hữu hủy tài liệu |
| `POST /api/tokens/issue` | Cấp token truy cập |
| `POST /api/tokens/validate` | Kiểm tra token truy cập |
| `POST /api/tokens/revoke` | Thu hồi token |
| `GET /api/approvals` | Danh sách yêu cầu phê duyệt |
| `POST /api/approvals/[id]/approve` | Duyệt yêu cầu theo ngưỡng |
| `GET /api/audit` | Xem audit event được phép |
| `GET /api/health` | Kiểm tra trạng thái runtime |

## Cấu trúc dự án

```txt
src/
  app/
    api/             API routes
    dashboard/       không gian quản lý
    download/        luồng nhận và mở tài liệu
    upload/          luồng upload và mã hóa
  components/        component giao diện sản phẩm
  contexts/          auth context
  lib/               db, storage, crypto helpers, csrf, audit
docs/                tài liệu triển khai, demo, test, báo cáo
public/              logo và visual assets
tests/               Playwright E2E tests
data/                dữ liệu SQLite local khi chạy runtime
storage/             ciphertext local khi chạy runtime
```

## Tài liệu liên quan

- `docs/RAILWAY_DEPLOYMENT.md`: hướng dẫn Railway.
- `docs/DEPLOYMENT.md`: ghi chú deploy tổng quát.
- `docs/REHEARSAL_SCRIPT.md`: kịch bản nói khi bảo vệ.
- `docs/REPORT_UPDATE_NOTES.md`: checklist cập nhật báo cáo.
- `docs/SOFTWARE_ENGINEERING.md`: phân tích theo môn Kỹ thuật phần mềm.
- `docs/TEST_PLAN.md`: chiến lược kiểm thử.
- `docs/UI_HANDOFF.md`: ghi chú UI/UX.
- `docs/screenshots/`: ảnh chụp giao diện dùng cho báo cáo và slide.

## Kiểm tra trước khi demo

Nên chạy:

```bash
npm run lint
npm run build
```

Nếu còn thời gian:

```bash
npm run test:e2e
```

Các đường chạy đã được kiểm chứng:

- Build production local.
- Local app dùng R2 storage.
- Cấu hình Docker hướng tới Railway.
- Luồng token và phê duyệt ngưỡng qua E2E test.

## Định hướng phát triển

Ngắn hạn:

- Watermark cá nhân hóa theo người nhận trong protected viewer.
- Hỗ trợ viewer tốt hơn cho notebook và tài liệu phức tạp.
- Xuất audit receipt cho từng phiên chia sẻ.

Hướng nghiên cứu:

- Merkle-tree audit receipt.
- Zero-knowledge permission proof.
- Time-locked encryption với decentralized time beacon.
- Chấm điểm rủi ro theo thiết bị và phiên truy cập.

## Góc nhìn Kỹ thuật phần mềm

WEB3demo có thể được trình bày như một dự án Kỹ thuật phần mềm với các phần rõ ràng:

- Phân tích yêu cầu: chia sẻ tài liệu nhạy cảm và kiểm soát quyền sau khi gửi.
- Thiết kế kiến trúc: client crypto, metadata API, storage abstraction.
- Thiết kế bảo mật: xác thực, CSRF, thu hồi, audit trail.
- Thiết kế workflow: phê duyệt nhiều ví và vòng đời tài liệu.
- Thiết kế triển khai: Railway, R2 và persistent volume.
- Chiến lược kiểm thử: lint, build, Playwright E2E, healthcheck.

Luận điểm chính của dự án:

> Hệ thống không tuyên bố làm cho việc copy trở nên bất khả thi. Hệ thống làm cho quyền truy cập trở nên có chủ đích, có thể thu hồi, có thể kiểm chứng và khó bị lạm dụng hơn.

