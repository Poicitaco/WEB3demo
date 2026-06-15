# Online Deployment

The production-ready demo layout uses:

- one persistent container for the Next.js application and SQLite metadata;
- a mounted volume at `/app/data`;
- Cloudflare R2 for encrypted file objects;
- HTTPS at the hosting platform or reverse proxy.

## Required environment

```bash
JWT_SECRET=replace-with-a-long-random-secret
REQUIRE_CSRF=true
DB_PATH=/app/data/app.sqlite
STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_KEY_PREFIX=ciphertexts
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Do not deploy this SQLite build to an ephemeral serverless filesystem. Use a
container host or VM with a persistent disk. Keep one application replica while
SQLite is the metadata database.

## Container check

```bash
docker build -t vaultline .
docker run --rm -p 3000:3000 \
  --env-file .env.production \
  -v vaultline-data:/app/data \
  vaultline
```

Verify `GET /api/health` returns HTTP 200, then run the three-wallet demo flow.

## Production evolution

For multiple application replicas, migrate metadata from SQLite to PostgreSQL
before horizontal scaling. R2 object keys are content hashes, so the ciphertext
storage layer can remain unchanged.
