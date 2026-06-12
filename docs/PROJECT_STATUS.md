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

All milestone branches are stacked in the order shown above. `develop` contains
the complete stack.

## Intentionally Deferred

These items are not required for the classroom prototype:

- Production IPFS/Filecoin or S3 storage
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
- [ ] Screenshots and report updates
- [ ] Final presentation rehearsal
