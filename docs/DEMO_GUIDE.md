# Classroom Demo Guide

Target duration: 7-10 minutes.

## Preparation

1. Start from the `develop` branch.
2. Run `npm install` and `npm run dev`.
3. Prepare three browser wallet accounts:
   - Vault owner
   - Editor/approver
   - Viewer/requester
4. Use a small text or PDF file for a reliable live demo.
5. Keep a backup screenshot or recording in case MetaMask interrupts the flow.

## Primary Demo Flow

1. **Wallet authentication**
   - Connect the owner wallet.
   - Explain nonce signing and cookie-based session creation.

2. **Client-side encrypted upload**
   - Upload a small file using a passphrase or recipient wallet.
   - Explain that plaintext and the unwrapped AES key never reach the server.

3. **Recipient download**
   - Open the generated link.
   - Validate the token and decrypt the file in the browser.

4. **Collaborative vault and Shamir approval**
   - Show a vault with owner, editor, and viewer roles.
   - Explain the K-of-N policy.
   - Let the requester create an access request.
   - Submit enough approvals and recover the file key.

5. **Extension features**
   - Briefly show immutable versions.
   - Show remaining self-destruct downloads.
   - Mention rate limiting and immutable audit events.

## Key Technical Points

- AES-256-GCM encrypts file content in the browser.
- ECDH P-256 wraps file keys for recipient wallets.
- Shamir Secret Sharing splits a file key into K-of-N encrypted shares.
- Tokens are version-specific and can expire or be revoked.
- Ciphertext access requires a valid token or approved threshold request.
- Sensitive actions create append-only audit events.

## Scope Statement

This is a classroom prototype. Local filesystem storage and SQLite are deliberate
choices that keep the security flows demonstrable without requiring production
infrastructure. IPFS/Filecoin, on-chain token management, and large-file streaming
are documented future work rather than required live-demo features.

## Contribution Summary

- **Poicitaco**: core architecture, authentication, cryptography, APIs, access
  control, Shamir approvals, versioning, self-destruct behavior, security
  hardening, tests, and integration.
- **tduong**: final UI/UX design, responsive polish, visual consistency, and demo
  presentation assets.
