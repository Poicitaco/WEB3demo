# Project Status

## Active Branches

- `main`: original stable branch; unchanged during core development
- `develop`: integrated core baseline for UI/UX work and final demo preparation
- `ui/<feature-name>`: UI/UX branches created from `develop`

## Completed Core Milestones

| Milestone | Branch | Status |
| --- | --- | --- |
| Repository and CI foundation | `chore/repository-foundation` | Complete |
| Wallet-linked encryption identity | `core/e2ee-identity` | Complete |
| Recipient-wallet E2EE sharing | `core/e2ee-sharing` | Complete |
| Collaborative role-based vaults | `core/collaborative-vaults` | Complete |
| Shamir threshold policy | `core/shamir-approval` | Complete |
| Interactive approval sessions | `core/approval-sessions` | Complete |
| Immutable file versioning | `core/file-versioning` | Complete |
| Self-destructing downloads | `core/self-destructing-files` | Complete |
| Rate limiting and immutable audit trail | `core/security-hardening` | Complete |
| A+B approval token issuance for requester C | `ui/tduong-redesign` | Complete |
| Optional Cloudflare R2 ciphertext storage | `ui/tduong-redesign` | Complete |
| Owner document destruction lifecycle | `ui/tduong-redesign` | Complete |

All milestone branches are stacked in the order shown above. `develop` contains
the complete stack.

## Intentionally Deferred

These items are not required for the classroom prototype:

- Production database migration from local SQLite
- On-chain token registry
- Large-file chunked streaming encryption
- External audit-log export and monitoring
- Native mobile clients
- Zero-knowledge proof access control

## Finalization Checklist

- [x] Integrated backend/core branch
- [x] Lint, production build, E2E tests, and dependency audit
- [x] UI/UX handoff contract
- [x] Classroom demo guide
- [ ] Final UI/UX implementation
- [x] Document inbox, operational metrics, search/filter, and audit activity feed
- [x] Software-engineering architecture and test-plan documentation
- [x] CI verification for lint, production build, and E2E
- [x] Report update notes and rehearsal script
- [x] Screenshots captured for final report
- [ ] Final live rehearsal with three real wallets
