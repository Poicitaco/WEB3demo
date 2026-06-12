# SecureShare - Client-Side Encrypted File Sharing

A secure, privacy-focused file sharing application that encrypts files on your browser using AES-256-GCM before uploading. Your keys never leave your device.

## Features

- 🔐 **Client-side Encryption**: Files encrypted with AES-256-GCM using Web Crypto API
- 🔑 **Wallet Authentication**: Sign in with your Ethereum wallet (MetaMask) - no passwords needed
- 🎟️ **Token-Based Access**: Share files with time-limited tokens that can be revoked instantly
- 🔓 **Zero-Knowledge Server**: Server never has access to decryption keys or plaintext
- 🛡️ **CSRF Protection**: Double-submit cookie pattern + SameSite cookies
- 📱 **Responsive UI**: Modern, user-friendly interface built with React and Tailwind CSS

## Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Crypto**: Web Crypto API (AES-GCM, PBKDF2)
- **Wallet**: Ethers.js (MetaMask integration)

### Backend

- **API**: Next.js API routes
- **Auth**: JWT (HS256) with cookie-based sessions
- **Database**: SQLite for metadata storage
- **Security**: CSRF protection, Input validation

### Storage

- **Ciphertext**: Local filesystem (demo) - can swap with IPFS/Filecoin
- **Metadata**: SQLite database

## Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- MetaMask browser extension (for wallet integration)

## Installation

```bash
# Clone the repository
git clone https://github.com/Poicitaco/WEB3demo.git
cd doan_attt

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### 1. Connect Your Wallet

1. Click **"Connect Wallet"** in the top-right corner
2. MetaMask will open - select your account and approve
3. Sign the authentication message (nonce) to verify ownership
4. Your wallet address will appear in the header

### 2. Upload & Encrypt a File

1. Navigate to the **Upload** page
2. Drag and drop a file or click **Browse**
3. Enter a **Title** and optional **Description**
4. (Recommended) Enter a **Passphrase** to wrap the AES key
5. Adjust **Token TTL** (10 minutes to 3 days)
6. Click **Encrypt & Upload**
7. The file is encrypted client-side; only ciphertext is sent to server
8. A share token is generated

### 3. Share the File

1. Copy the **Share Token** or **Download Link**
2. Send to recipient via any communication channel
3. Tokens can be revoked anytime from the Dashboard

### 4. Download & Decrypt

1. Navigate to **Download** page (or use share link)
2. Paste the **Token**
3. Click **Validate** to check token and retrieve metadata
4. Enter **Passphrase** if file was wrapped
5. Click **Download & Decrypt**
6. Decryption happens entirely in browser; server never sees plaintext

### 5. Manage Files & Tokens

From the **Dashboard**:

- View all your uploaded files
- Create new tokens for any file
- Revoke existing tokens instantly
- Set token TTL and optional address restrictions

## Project Structure

```
doan_attt/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   ├── upload/               # Upload page
│   │   ├── download/             # Download page
│   │   ├── dashboard/            # Dashboard page
│   │   └── api/                  # API routes
│   ├── components/               # React components
│   │   ├── UploadWizard.tsx
│   │   ├── Downloader.tsx
│   │   ├── TokenIssuer.tsx
│   │   ├── TokenManager.tsx
│   │   └── ...
│   ├── contexts/                 # React contexts
│   │   └── AuthContext.tsx
│   └── lib/                      # Utilities
│       ├── auth.ts
│       ├── crypto.ts
│       ├── db.ts
│       └── ...
├── report/
│   ├── main.tex                  # LaTeX report
│   ├── chapters/                 # Report chapters
│   └── img/                      # Screenshots & diagrams
├── tests/
│   └── e2e.spec.ts              # Playwright E2E tests
├── data/                         # SQLite database
├── storage/                      # Encrypted files
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/auth/start` - Get nonce for signing
- `POST /api/auth/verify` - Verify signature and get JWT
- `POST /api/auth/logout` - Sign out

### File Storage

- `POST /api/storage/upload` - Upload ciphertext
- `GET /api/storage/get?cid=...` - Download ciphertext

### Files Metadata

- `POST /api/files` - Create file metadata and get token
- `GET /api/files/list` - List user's files

### Token Management

- `POST /api/tokens/issue` - Issue new token
- `POST /api/tokens/validate` - Validate token
- `POST /api/tokens/revoke` - Revoke token
- `GET /api/tokens/list` - List user's tokens

### Security

- `GET /api/csrf` - Get CSRF token

## Environment Variables

Create `.env.local`:

```bash
# Allow raw keys (demo mode) - disable in production
NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=false

# Database path (SQLite)
DB_PATH=data/app.sqlite

# Storage path for ciphertext
STORAGE_PATH=storage
```

## Running Tests

```bash
# E2E tests with Playwright
npm run test:e2e

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Security Considerations

### Client-Side

- ✅ AES-256-GCM for authenticated encryption
- ✅ PBKDF2 (200k iterations) for key wrapping
- ✅ 96-bit random IV per file (never reused)
- ✅ Web Crypto API (hardware-accelerated when available)

### Server-Side

- ✅ Double-submit CSRF cookies
- ✅ SameSite cookie attribute
- ✅ JWT-based session management
- ✅ Input validation and sanitization
- ✅ Persistent SQLite-backed rate limiting on critical APIs
- ✅ Immutable audit events for sensitive access and mutations

### Limitations

- 🔴 Local storage for demo (scale with IPFS/Filecoin)
- 🔴 External monitoring and audit-log export are not configured
- 🔴 Demo mode allows raw keys (use wrapped keys in production)

## Future Roadmap

### Short-term (1-2 months)

- Enforce passphrase-wrapped keys
- Optimize encryption/decryption with Web Workers
- Comprehensive test coverage

### Medium-term (3-6 months)

- IPFS/Filecoin integration
- Attribute-Based Access Control (ABAC)
- External audit-log export and monitoring

### Long-term (6+ months)

- Smart contract integration (on-chain token management)
- Native mobile apps (iOS/Android)
- Multi-chain support

## Development

```bash
# Start dev server with Turbopack (fast)
npm run dev

# Or with Webpack (slower)
npm run dev:webpack

# Build for production
npm run build

# Clean build cache
npm run clean
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Security & Audit

⚠️ **Important**: This is a research/education project. Before using in production:

- Conduct professional security audit
- Connect audit events and rate-limit metrics to external monitoring
- Use HTTPS everywhere
- Disable demo mode (`ALLOW_DEMO_RAW_KEYS=false`)
- Implement proper key backup/recovery

## License

This project is part of an academic capstone. See repository for license details.

## Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation in `/report` folder
- Review API documentation in source code comments

## Acknowledgments

- NIST for AES and GCM specifications
- W3C for Web Crypto API
- Ethers.js team for web3 integration
- Next.js and React communities

---

**Built with ❤️ for secure, privacy-first file sharing**
