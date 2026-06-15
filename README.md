# WEB3demo

**Secure document sharing with wallet identity, client-side encryption, threshold approval, protected viewing, and Cloudflare R2 storage.**

WEB3demo is an academic-grade secure file sharing system built for a Software Engineering course. It demonstrates how sensitive documents, such as research papers or internal academic files, can be encrypted before upload, shared through revocable access tokens, and opened only after policy checks or multi-wallet approval.

The project is not just a file upload demo. It is a small product system: identity, storage, permission, approval workflow, protected viewer, audit trail, and cloud deployment are designed as one flow.

## Highlights

- **Wallet-based identity**: users sign in with MetaMask by signing a nonce.
- **Client-side encryption**: files are encrypted in the browser before storage.
- **Zero plaintext storage**: the server stores ciphertext and metadata, not original files.
- **Threshold approval**: for sensitive files, A and B must both approve before C receives access.
- **Protected viewer**: recipients can open files inside a controlled view instead of downloading raw originals by default.
- **Revocable access**: owners can revoke tokens or destroy documents.
- **Audit trail**: sensitive operations are recorded for accountability.
- **Cloud-ready storage**: ciphertext can be stored locally or on Cloudflare R2.
- **Railway deployment**: Docker, healthcheck, and persistent SQLite volume are supported.

## Product Scenario

The system is designed around this core question:

> If a research document is shared with someone, how can the owner keep control over access after upload?

WEB3demo answers this with a layered model:

1. The browser encrypts the file before upload.
2. The backend stores only encrypted payloads and permission metadata.
3. Access is granted through scoped tokens.
4. High-risk documents can require approval from multiple wallets.
5. The viewer reduces accidental raw-file exposure.
6. Revocation, destruction, and audit logs make the lifecycle demonstrable.

## Demo Flow

Recommended classroom demo uses three MetaMask accounts:

| Role | Wallet | Purpose |
| --- | --- | --- |
| A | Owner | Uploads and controls the document |
| B | Reviewer | Co-approves sensitive access |
| C | Recipient | Requests and opens the protected document |

Demo script:

1. A connects wallet and registers encryption identity.
2. A uploads a document. Encryption happens in the browser.
3. A creates a threshold-protected sharing flow.
4. C requests access.
5. A approves. Access is still blocked because the threshold is not met.
6. B connects wallet and approves.
7. The system issues an approval token for C.
8. C opens the document in the protected viewer.
9. A revokes the token or destroys the document.
10. The dashboard and audit trail show the lifecycle.

## Architecture

```txt
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ - MetaMask wallet signature                                 │
│ - Web Crypto encryption/decryption                          │
│ - Protected document viewer                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Next.js Application                                          │
│ - App Router UI                                              │
│ - API routes for auth, files, tokens, approvals, audit       │
│ - JWT cookie session                                         │
│ - CSRF protection                                            │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────┐   ┌───────────▼──────────────┐
│ SQLite Metadata DB            │   │ Object Storage            │
│ - users/wallet sessions       │   │ - local filesystem         │
│ - files/tokens/approvals      │   │ - Cloudflare R2            │
│ - audit events                │   │ - ciphertext only          │
└───────────────────────────────┘   └──────────────────────────┘
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| Wallet | MetaMask, Ethers.js |
| Crypto | Web Crypto API |
| Backend | Next.js API routes |
| Database | SQLite, better-sqlite3 |
| Storage | Local filesystem or Cloudflare R2 |
| Testing | ESLint, Playwright |
| Deployment | Docker, Railway |

## Security Model

WEB3demo uses a defense-in-depth approach:

- The original file is never intentionally stored by the server.
- File encryption happens before upload.
- Storage receives ciphertext only.
- Tokens are time-bound and revocable.
- Threshold approval prevents single-party release for sensitive documents.
- Audit events record important access and mutation actions.
- Raw-key demo mode is disabled by default in production-style configuration.

Important limitation:

WEB3demo is not DRM. If a user is allowed to view content, they can still copy it manually or take a photo with another device. The system focuses on cryptographic access control, lifecycle control, and accountability, not impossible promises.

This is a useful point for defense: the project understands the real boundary between encryption, access control, viewer restrictions, and human-side leakage.

## Feature Map

| Area | Implemented |
| --- | --- |
| Wallet login | Yes |
| Client-side encryption | Yes |
| Upload encrypted file | Yes |
| Cloudflare R2 provider | Yes |
| Token issue/validate/revoke | Yes |
| Protected viewer | Yes |
| Threshold approval A + B -> C | Yes |
| Owner document destruction | Yes |
| Audit trail | Yes |
| Dashboard | Yes |
| Railway Docker deploy | Yes |
| AI policy assistant | Not included by design |
| ZK permission proof | Roadmap |
| Time-locked encryption | Roadmap |

## Running Locally

Requirements:

- Node.js 20+
- npm
- MetaMask browser extension

Install dependencies:

```bash
npm install
```

Create local environment file:

```powershell
Copy-Item .env.example .env.local
```

Run development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

For a more reliable presentation run:

```bash
npm run build
npm run start
```

## Environment Variables

Minimal local configuration:

```env
JWT_SECRET=replace-with-a-long-random-secret
REQUIRE_CSRF=true
DB_PATH=data/app.sqlite
STORAGE_PROVIDER=local
ALLOW_RAW_KEYS=false
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false
```

Local app with Cloudflare R2 storage:

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

Never commit `.env.local`, `.env.production`, API tokens, R2 keys, or wallet secrets.

## Railway Deployment

The repository includes:

- `Dockerfile`
- `railway.json`
- `/api/health`
- SQLite support through `DB_PATH`
- Cloudflare R2 storage support

Railway variables:

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

Attach a Railway volume to:

```txt
/app/data
```

Healthcheck:

```txt
https://your-domain.up.railway.app/api/health
```

Expected response:

```json
{
  "ok": true,
  "database": "ready",
  "storageProvider": "r2"
}
```

## Scripts

```bash
npm run dev          # start development server
npm run build        # production build
npm run start        # start production server
npm run lint         # static checks
npm run test:e2e     # Playwright E2E tests
npm run clean        # remove build cache
```

## Main API Surface

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/start` | Create wallet-login nonce |
| `POST /api/auth/verify` | Verify wallet signature |
| `POST /api/storage/upload` | Upload ciphertext |
| `GET /api/storage/get` | Retrieve ciphertext after access validation |
| `POST /api/files` | Create file metadata |
| `DELETE /api/files/[id]` | Destroy owner document |
| `POST /api/tokens/issue` | Issue access token |
| `POST /api/tokens/validate` | Validate access token |
| `POST /api/tokens/revoke` | Revoke access token |
| `GET /api/approvals` | List approval requests |
| `POST /api/approvals/[id]/approve` | Approve threshold request |
| `GET /api/audit` | Read authorized audit events |
| `GET /api/health` | Runtime healthcheck |

## Project Structure

```txt
src/
  app/
    api/             API routes
    dashboard/       dashboard workspace
    download/        recipient and viewer flow
    upload/          upload and encryption flow
  components/        product UI components
  contexts/          auth context
  lib/               db, storage, crypto helpers, csrf, audit
docs/                deployment, demo, testing, report notes
public/              brand assets and visuals
tests/               Playwright E2E tests
data/                local SQLite runtime data
storage/             local ciphertext runtime data
```

## Documentation

- `docs/RAILWAY_DEPLOYMENT.md`: Railway setup guide.
- `docs/DEPLOYMENT.md`: general deployment notes.
- `docs/REHEARSAL_SCRIPT.md`: Vietnamese defense script.
- `docs/REPORT_UPDATE_NOTES.md`: report update checklist.
- `docs/SOFTWARE_ENGINEERING.md`: software engineering analysis.
- `docs/TEST_PLAN.md`: verification strategy.
- `docs/UI_HANDOFF.md`: UI/UX handoff notes.
- `docs/screenshots/`: screenshots for report and slides.

## Verification

Recommended checks before a demo:

```bash
npm run lint
npm run build
```

If time allows:

```bash
npm run test:e2e
```

Current verified paths:

- Local production build.
- Local app with R2 storage.
- Railway-oriented Docker build configuration.
- Token lifecycle and threshold approval flow through E2E tests.

## Roadmap

Near-term:

- Watermarked protected viewer per recipient.
- Better viewer support for notebooks and rich document types.
- Exportable audit receipt for each sharing session.

Research direction:

- Merkle-tree audit receipt.
- Zero-knowledge permission proof.
- Time-locked encryption with decentralized time beacons.
- Stronger device/session risk scoring.

## Academic Positioning

WEB3demo can be presented as a software engineering project with:

- Requirements analysis: secure document sharing and controlled disclosure.
- Architecture design: client crypto, metadata API, storage abstraction.
- Security design: authentication, CSRF, revocation, audit trail.
- Workflow design: threshold approval and document lifecycle.
- Deployment design: Railway + R2 + persistent volume.
- Testing strategy: lint, build, Playwright E2E, healthcheck.

The key argument is simple:

> The system does not claim to make copying impossible. It makes access intentional, revocable, auditable, and harder to misuse.

