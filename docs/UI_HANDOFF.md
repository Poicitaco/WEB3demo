# UI/UX Handoff

This document defines the integration boundary for the UI/UX phase.

## Branch Workflow

- Stable integration branch: `develop`
- UI branch: create `ui/<feature-name>` from `develop`
- Open pull requests into `develop`
- Do not merge directly into `main` until the final classroom demo is approved

Recommended ownership:

- `Poicitaco`: APIs, database, cryptography, access control, tests
- `tduong`: layouts, visual hierarchy, responsive behavior, accessibility, copy

## Safe UI Editing Area

UI work should normally stay inside:

- `src/app/page.tsx`
- `src/app/upload/page.tsx`
- `src/app/download/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
- `src/components/*.tsx`
- `public/`

Coordinate before changing:

- `src/app/api/**`
- `src/lib/**`
- `tests/e2e.spec.ts`
- request payloads, response shapes, button accessible names used by E2E tests

## Required User Flows

1. Connect wallet and sign the login nonce.
2. Upload and encrypt a file.
3. Choose passphrase, recipient wallet, or threshold-vault protection.
4. Copy a token or download link.
5. Validate a token and decrypt in the browser.
6. Manage vault members and threshold policy.
7. Request and contribute threshold approvals.
8. Inspect file versions, tokens, and remaining self-destruct downloads.

## API Contract Summary

All mutation APIs require an authenticated wallet session. They also expect the
`x-csrf` header returned by `GET /api/csrf`.

### Authentication

- `POST /api/auth/start`: returns `{ nonce, message }`
- `POST /api/auth/verify`: body `{ address, signature }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Files and Storage

- `POST /api/storage/upload`: multipart ciphertext upload; returns `{ cid }`
- `GET /api/storage/get?token=<token>`: authorized ciphertext download
- `GET /api/storage/get?approvalRequestId=<id>`: approved threshold download
- `POST /api/files`: creates encrypted metadata and initial token
- `GET /api/files/list`
- `GET /api/files/<id>/versions`

Important `POST /api/files` optional fields:

- `parentFileId`: creates the next immutable version
- `vaultId`: uploads into a collaborative vault
- `recipientAddress` and `recipientEnvelope`: recipient-wallet E2EE
- `thresholdShares`: Shamir threshold protection
- `maxDownloads`: self-destruct download limit

### Tokens

- `POST /api/tokens/validate`: body `{ token }`
- `POST /api/tokens/issue`: body `{ fileId, ttlMinutes, issuedTo? }`
- `POST /api/tokens/revoke`: body `{ token }`
- `GET /api/tokens/list`

### Vaults and Approvals

- `GET|POST /api/vaults`
- `GET|POST|DELETE /api/vaults/<id>/members`
- `GET|PUT|DELETE /api/vaults/<id>/threshold`
- `GET|POST /api/approvals`
- `GET /api/approvals/<id>`
- `POST /api/approvals/<id>/approve`

### Security

- `GET /api/audit`: authorized immutable audit events
- Rate-limited endpoints may return `429` with `Retry-After`

## States the UI Must Handle

- `401`: wallet session required
- `403`: forbidden, recipient mismatch, CSRF failure, or approval required
- `404`: resource unavailable or hidden by access control
- `410`: self-destructed file or unavailable token
- `429`: rate limit reached

Do not display raw key material, wrapped keys, signatures, complete tokens, or
encryption envelopes in general UI surfaces.

## Verification Before a UI Pull Request

```bash
npm run lint
npm run build
npm run test:e2e
```

Small copy/layout changes may require updating E2E selectors if accessible button
names change. Preserve behavior and ask the core owner to review API changes.
