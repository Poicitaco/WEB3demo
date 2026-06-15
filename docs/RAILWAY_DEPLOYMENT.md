# Deploy lên Railway Free

Mục tiêu:

- Railway chạy Next.js bằng Dockerfile.
- SQLite metadata nằm ở volume `/app/data`.
- Cloudflare R2 lưu ciphertext.
- Secret được nhập trong Railway Variables, không commit vào Git.

## 0. Việc cần làm trước

Key Cloudflare R2 đã từng bị gửi vào chat thì phải revoke/rotate trước khi deploy.
Chỉ dùng key mới trong Railway Variables.

## 1. Push branch lên GitHub

Railway deploy dễ nhất từ GitHub. Trước khi deploy, đảm bảo branch đã push.

```bash
git status
git push origin ui/tduong-redesign
```

Nếu muốn deploy từ nhánh khác, chọn đúng branch đó trong Railway.

## 2. Tạo project Railway

1. Vào `https://railway.app`.
2. Đăng nhập bằng GitHub.
3. Chọn **New Project**.
4. Chọn **Deploy from GitHub repo**.
5. Chọn repo `WEB3demo`.
6. Chọn branch `ui/tduong-redesign` hoặc branch demo cuối cùng của bạn.

Railway sẽ thấy `railway.json` và dùng `Dockerfile`.

## 3. Thêm volume cho SQLite

Trong Railway project:

1. Mở service app vừa tạo.
2. Vào tab **Volumes** hoặc **Storage**.
3. Chọn **Add Volume**.
4. Mount path:

```txt
/app/data
```

5. Dung lượng: Free plan có thể chọn nhỏ, ví dụ `0.5GB` nếu Railway cho chọn.

Không có volume này thì SQLite sẽ mất dữ liệu khi redeploy/restart.

## 4. Thêm biến môi trường

Vào tab **Variables** của service và thêm:

```env
JWT_SECRET=tao_mot_chuoi_random_that_dai
REQUIRE_CSRF=true

DB_PATH=/app/data/app.sqlite

STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=0ce60007d297d4127e3ec74ebe30e5ba
CLOUDFLARE_R2_BUCKET=r2web3
CLOUDFLARE_R2_ACCESS_KEY_ID=access_key_id_moi
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret_access_key_moi
CLOUDFLARE_R2_KEY_PREFIX=ciphertexts

ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Không đưa các giá trị secret vào GitHub, README, issue, chat hoặc screenshot.

Gợi ý tạo `JWT_SECRET` local:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. Deploy

Sau khi thêm variables và volume:

1. Vào tab **Deployments**.
2. Chọn **Redeploy** nếu Railway đã deploy trước khi bạn thêm biến môi trường.
3. Chờ build xong.

Nếu build fail, xem logs. Các lỗi thường gặp:

- Thiếu R2 secret.
- Chưa mount volume `/app/data`.
- Key R2 bị revoke hoặc sai quyền.

## 6. Kiểm tra health

Mở domain Railway:

```txt
https://<ten-app>.up.railway.app/api/health
```

Kỳ vọng:

```json
{
  "ok": true,
  "database": "ready",
  "storageProvider": "r2"
}
```

Nếu `storageProvider` là `local`, kiểm tra lại biến `STORAGE_PROVIDER`.

## 7. Test demo thật

Sau khi health OK:

1. Mở app domain Railway.
2. Kết nối ví A.
3. Upload file nhỏ.
4. Tạo kho, thêm B và C.
5. Bật chính sách phê duyệt.
6. C tạo yêu cầu truy cập.
7. A và B phê duyệt.
8. C mở approval token.
9. Huỷ tài liệu từ dashboard và thử lại token cũ.

## Lưu ý cho Free plan

- Giữ 1 instance/replica vì SQLite không sync giữa nhiều máy.
- Không bật public R2 bucket.
- Nếu app sleep hoặc cold start, lần mở đầu có thể chậm hơn.
- Dọn dữ liệu demo cũ trước khi bảo vệ nếu dashboard quá nhiều item.

