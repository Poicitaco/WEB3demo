"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalEncryptionIdentity } from '@/lib/clientEncryptionIdentity';
import type { RecipientKeyEnvelope, RecipientSecretEnvelope } from '@/lib/recipientEnvelope';
import NotebookViewer from '@/components/NotebookViewer';
import { protectedViewKind, protectedViewLabel, type ProtectedViewKind } from '@/lib/protectedView';

function base64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}

type Meta = {
  ok: boolean;
  fileId?: string;
  cid: string;
  name?: string;
  mime?: string;
  sizeBytes?: number;
  iv: string;
  rawKeyBase64?: string;
  salt?: string;
  ivWrap?: string;
  wrappedKey?: string;
  recipientAddress?: string;
  recipientEnvelope?: RecipientKeyEnvelope;
  thresholdProtected?: boolean;
  approvalGranted?: boolean;
  approvalRequestId?: string;
  maxDownloads?: number;
  remainingDownloads?: number;
  accessMode?: 'download' | 'view';
};

type EncryptedPackage = {
  format: 'vaultline-encrypted-package';
  version: 1;
  fileId: string;
  name: string;
  cipherBase64: string;
};

export default function Downloader() {
  const { address, loading: authLoading } = useAuth();
  const toast = useToast();
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerText, setViewerText] = useState('');
  const [viewerKind, setViewerKind] = useState<ProtectedViewKind>('unsupported');
  const [packageCipher, setPackageCipher] = useState<ArrayBuffer | null>(null);
  const [packageFileId, setPackageFileId] = useState('');
  const [packageName, setPackageName] = useState('');
  const needsPass = useMemo(
    () => Boolean(meta && !meta.rawKeyBase64 && !meta.recipientEnvelope && !meta.thresholdProtected && !meta.approvalGranted),
    [meta]
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('token');
    if (t) setToken(t);
  }, []);

  useEffect(() => () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  }, [viewerUrl]);

  useEffect(() => {
    if (!viewerUrl && !viewerText) return;
    const prevent = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['s', 'p'].includes(event.key.toLowerCase())) event.preventDefault();
    };
    document.addEventListener('keydown', prevent);
    return () => document.removeEventListener('keydown', prevent);
  }, [viewerUrl, viewerText]);

  async function validate() {
    if (!address) {
      const message = 'Kết nối ví để kiểm tra và mở tài liệu.';
      setStatus(message);
      toast.info(message);
      return false;
    }
    setStatus('Đang kiểm tra quyền truy cập...');
    setMeta(null);
    setProgress(0);
    try {
      const res = await fetch('/api/tokens/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = (await res.json()) as Meta & { error?: string };
      if (!res.ok || !result.ok) {
        const messages: Record<string, string> = {
          'Not found': 'Không tìm thấy liên kết hoặc mã truy cập không đúng.',
          Revoked: 'Liên kết này đã bị thu hồi.',
          Expired: 'Liên kết này đã hết hạn.',
          Unauthorized: 'Phiên đăng nhập đã hết hạn. Hãy kết nối ví lại.',
          'Token is restricted to another wallet': 'Liên kết này được cấp cho một ví khác.',
        };
        throw new Error(messages[result.error || ''] || result.error || 'Không thể kiểm tra quyền truy cập');
      }
      setMeta(result);
      setStatus('Sẵn sàng');
      toast.success('Bạn có quyền mở tài liệu này');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Không thể mở: ${message}`);
      toast.error(message);
      return null;
    }
  }

  async function fetchCiphertext(purpose: 'view' | 'package' = 'view') {
    const res = await fetch(`/api/storage/get?token=${encodeURIComponent(token)}&purpose=${purpose}`);
    if (!res.ok || !res.body) throw new Error('Không thể tải bản mã');
    const total = Number(res.headers.get('content-length') || 0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total) setProgress(Math.round((received / total) * 100));
      }
    }
    const cipher = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      cipher.set(chunk, offset);
      offset += chunk.length;
    }
    return cipher.buffer;
  }

  async function downloadEncryptedPackage() {
    if (!meta?.fileId || !needsPass) return;
    setDownloading(true);
    setStatus('Đang đóng gói bản mã hóa...');
    try {
      const cipher = await fetchCiphertext('package');
      const encryptedPackage: EncryptedPackage = {
        format: 'vaultline-encrypted-package',
        version: 1,
        fileId: meta.fileId,
        name: meta.name || 'tai-lieu',
        cipherBase64: arrayBufferToBase64(cipher),
      };
      const blob = new Blob([JSON.stringify(encryptedPackage)], { type: 'application/vnd.vaultline.encrypted+json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${meta.name || 'tai-lieu'}.vaultline`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Đã tải gói mã hóa. Cần token và mật khẩu để mở.');
      toast.success('Đã tải gói mã hóa, chưa chứa bản gốc');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Lỗi: ${message}`);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  async function importEncryptedPackage(file: File) {
    try {
      const data = JSON.parse(await file.text()) as EncryptedPackage;
      if (data.format !== 'vaultline-encrypted-package' || data.version !== 1 || !data.fileId || !data.cipherBase64) {
        throw new Error('Gói mã hóa không hợp lệ');
      }
      setPackageCipher(base64ToArrayBuffer(data.cipherBase64));
      setPackageFileId(data.fileId);
      setPackageName(data.name || file.name);
      setMeta(null);
      setStatus('Đã nạp gói mã hóa. Nhập token để xác thực, sau đó nhập mật khẩu.');
      toast.success('Đã nạp gói mã hóa');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function downloadAndDecrypt(validatedMeta: Meta | null = meta) {
    if (!validatedMeta) return;
    if (validatedMeta.thresholdProtected && !validatedMeta.approvalGranted) {
      toast.error('Tệp này cần phê duyệt từ kho. Hãy dùng quy trình phê duyệt trong trang điều khiển.');
      return;
    }
    setDownloading(true);
    setStatus('Đang tải bản mã...');
    setProgress(0);
    try {
      if (packageCipher && packageFileId !== validatedMeta.fileId) {
        throw new Error('Token không thuộc gói mã hóa đã chọn');
      }
      const cipherBuffer = packageCipher || await fetchCiphertext();

      setStatus('Đang giải mã...');
      const webCrypto = globalThis.crypto;
      if (!webCrypto || !webCrypto.subtle) throw new Error('Trình duyệt không hỗ trợ Web Crypto API');
      let raw: ArrayBuffer;
      if (validatedMeta.approvalGranted && validatedMeta.approvalRequestId) {
        const { combineSecret } = await import('@/lib/clientThresholdShares');
        const { unwrapSecretFromRecipientEnvelope } = await import('@/lib/clientRecipientEnvelope');
        if (!address) throw new Error('Kết nối ví người nhận để giải mã tệp này');
        const identity = await getLocalEncryptionIdentity(address);
        if (!identity) throw new Error('Thiết bị này không có khoá riêng của người nhận');
        const approvalResponse = await fetch(`/api/approvals/${validatedMeta.approvalRequestId}`);
        const approvalData = await approvalResponse.json();
        if (!approvalResponse.ok || !approvalData.ok) throw new Error(approvalData.error || 'Không thể nạp phiên phê duyệt');
        const request = approvalData.request as {
          threshold: number;
          approvalCount: number;
          contributions: Array<{ envelope: RecipientSecretEnvelope }>;
        };
        if (request.approvalCount < request.threshold) throw new Error('Phiên phê duyệt chưa đủ số người đồng ý');
        const shares = await Promise.all(
          request.contributions.slice(0, request.threshold).map(async (contribution) => {
            const plain = await unwrapSecretFromRecipientEnvelope(contribution.envelope, identity.privateKey);
            return new TextDecoder().decode(plain);
          })
        );
        raw = combineSecret(shares);
      } else if (validatedMeta.recipientEnvelope) {
        const { unwrapFileKeyFromRecipientEnvelope } = await import('@/lib/clientRecipientEnvelope');
        if (!address) throw new Error('Kết nối ví người nhận để giải mã tệp này');
        const identity = await getLocalEncryptionIdentity(address);
        if (!identity) throw new Error('Thiết bị này không có khoá riêng của người nhận');
        raw = await unwrapFileKeyFromRecipientEnvelope(validatedMeta.recipientEnvelope, identity.privateKey);
      } else if (validatedMeta.rawKeyBase64) {
        raw = base64ToArrayBuffer(validatedMeta.rawKeyBase64);
      } else {
        if (!passphrase) throw new Error('Nhập mật khẩu để giải mã khoá');
        const enc = new TextEncoder();
        const salt = new Uint8Array(base64ToArrayBuffer(validatedMeta.salt!));
        const ivWrap = new Uint8Array(base64ToArrayBuffer(validatedMeta.ivWrap!));
        const wrapped = base64ToArrayBuffer(validatedMeta.wrappedKey!);
        const baseKey = await webCrypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const wrapKey = await webCrypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        raw = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv: ivWrap }, wrapKey, wrapped);
      }
      const key = await webCrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const iv = new Uint8Array(base64ToArrayBuffer(validatedMeta.iv));
      const plain = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuffer);

      const blob = new Blob([plain], { type: validatedMeta.mime || 'application/octet-stream' });
      const kind = protectedViewKind(validatedMeta.name, validatedMeta.mime);
      if (kind === 'unsupported') {
        throw new Error('Định dạng này chưa có trình đọc an toàn. Hãy chuyển tài liệu sang PDF hoặc định dạng được hỗ trợ.');
      }
      setViewerKind(kind);
      if (kind === 'text' || kind === 'notebook') {
        setViewerText(await blob.text());
        setViewerUrl('');
      } else {
        if (viewerUrl) URL.revokeObjectURL(viewerUrl);
        setViewerText('');
        setViewerUrl(URL.createObjectURL(blob));
      }
      setStatus('Đang mở trong chế độ đọc được kiểm soát');
      toast.success('Đã mở tài liệu trong trình xem');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = /OperationError/i.test(msg) ? 'Không thể mở tài liệu. Hãy kiểm tra lại mật khẩu hoặc mã truy cập.' : msg;
      setStatus('Lỗi: ' + friendly);
      toast.error(friendly);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="download-workspace">
      <div className="download-control-column space-y-4">
      <section className="encrypted-package-import">
        <div>
          <strong>Mở gói mã hóa đã tải về</strong>
          <span>Chọn tệp `.vaultline`, sau đó nhập token và mật khẩu để giải mã.</span>
        </div>
        <label className="btn-secondary">
          Chọn gói mã hóa
          <input type="file" accept=".vaultline,application/vnd.vaultline.encrypted+json" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importEncryptedPackage(file);
          }} />
        </label>
        {packageName && <small>Đã nạp: {packageName}</small>}
      </section>
      <div className="glass p-4 flex flex-col gap-3" aria-busy={downloading} aria-live="polite">
        {!authLoading && !address && (
          <div className="connection-required">
            <strong>Kết nối ví trước khi mở tài liệu</strong>
            <span>Liên kết xác định quyền truy cập; ví xác nhận người đang sử dụng quyền đó.</span>
          </div>
        )}
          <label className="label">Mã truy cập</label>
        <input type="text" placeholder="Dán mã truy cập" value={token} onChange={(e) => setToken(e.target.value)} className="input" />
        <div className="flex gap-2">
          <button aria-label="Validate" className="btn-secondary" onClick={validate} disabled={!address || !token || authLoading}>Kiểm tra quyền</button>
          <button aria-label="Download & Decrypt" className="btn-primary" onClick={async () => {
            if (meta) {
              await downloadAndDecrypt();
              return;
            }
            const validatedMeta = await validate();
            if (validatedMeta) await downloadAndDecrypt(validatedMeta);
          }} disabled={!address || !token || authLoading || downloading || Boolean(meta?.thresholdProtected && !meta?.approvalGranted)}>
            {downloading ? 'Đang chuẩn bị...' : 'Mở trong Viewer'}
          </button>
        </div>
        {status && <div className="text-sm muted">{status}</div>}
        {downloading && (
          <div className="w-full h-2 rounded bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-3)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {meta && (
        <div className="glass p-4">
          <div className="text-sm font-semibold mb-2">Chi tiết tệp</div>
          <div className="text-xs grid grid-cols-2 gap-y-1">
            <div className="muted">Tên</div><div>{meta.name || 'tệp'}</div>
            <div className="muted">Loại</div><div>{meta.mime || 'application/octet-stream'}</div>
            <div className="muted">Dung lượng</div><div>{formatBytes(meta.sizeBytes || 0)}</div>
            <div className="muted">Bảo vệ</div>
            <div>{meta.approvalGranted ? 'Token đã đủ phê duyệt' : meta.thresholdProtected ? 'Cần phê duyệt theo ngưỡng' : meta.recipientEnvelope ? 'E2EE theo ví người nhận' : needsPass ? 'Khoá bằng mật khẩu' : 'Khoá thô (demo)'}</div>
            <div className="muted">Quyền sử dụng</div>
            <div>{meta.accessMode === 'view' ? 'Chỉ xem trong Viewer' : 'Xem trong Viewer và được tải gói mã hóa'}</div>
            <div className="muted">Lượt tải còn lại</div>
            <div>{meta.remainingDownloads ?? 'Không giới hạn'}</div>
          </div>
          {needsPass && (
            <div className="mt-3">
              <label className="label">Mật khẩu</label>
              <input type="password" placeholder="Nhập mật khẩu" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="input" />
            </div>
          )}
          {meta.accessMode === 'download' && needsPass && (
            <div className="encrypted-download-callout">
              <div>
                <strong>Tải về nhưng vẫn giữ mã hóa</strong>
                <span>Gói `.vaultline` không chứa bản gốc và phải được mở lại bằng token cùng mật khẩu.</span>
              </div>
              <button type="button" className="btn-secondary" onClick={downloadEncryptedPackage} disabled={downloading}>
                Tải gói mã hóa
              </button>
            </div>
          )}
          {meta.thresholdProtected && !meta.approvalGranted && (
            <div className="mt-3 text-xs text-cyan-300">Mở trang điều khiển và tạo yêu cầu phê duyệt theo ngưỡng cho tệp này.</div>
          )}
          {meta.approvalGranted && (
            <div className="mt-3 text-xs text-cyan-300">Token này đã được A+B phê duyệt cho ví hiện tại. Viewer sẽ ghép khoá từ các share đã bọc riêng cho bạn.</div>
          )}
        </div>
      )}
      </div>
      <div className="download-viewer-column">
      {(viewerUrl || viewerText) && meta && (
        <section className="protected-reader">
          <div className="protected-reader-bar">
            <div><strong>{meta.name || 'Tài liệu được bảo vệ'}</strong><span>Chỉ đọc · phiên truy cập được ghi nhật ký</span></div>
            <span className="status-pill active">Đang bảo vệ</span>
          </div>
          <div className="protected-reader-stage" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
            {viewerKind === 'text' && <pre>{viewerText}</pre>}
            {viewerKind === 'notebook' && <NotebookViewer source={viewerText} />}
            {/* Blob URLs are local decrypted assets and cannot use the Next image optimizer. */}
            {viewerKind === 'image' && <img src={viewerUrl} alt={meta.name || 'Tài liệu'} draggable={false} />}
            {viewerKind === 'video' && <video src={viewerUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture />}
            {viewerKind === 'audio' && <audio src={viewerUrl} controls controlsList="nodownload noplaybackrate" />}
            {viewerKind === 'pdf' && <iframe src={`${viewerUrl}#toolbar=0&navpanes=0`} title={meta.name || 'Tài liệu'} />}
            <div className="reader-watermarks" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <span key={index}>{address?.slice(0, 10)} · {token.slice(0, 8)} · CHỈ ĐỌC</span>)}
            </div>
          </div>
          <p>{protectedViewLabel(viewerKind)} · Không có nút tải bản gốc. Watermark giúp truy vết ảnh chụp hoặc bản sao bị phát tán.</p>
        </section>
      )}
      {!viewerUrl && !viewerText && (
        <section className="reader-placeholder">
          <div className="reader-placeholder-grid" aria-hidden="true" />
          <div>
            <span>Vùng xem tài liệu</span>
            <strong>Viewer sẽ xuất hiện tại đây sau khi xác thực.</strong>
            <p>PDF, ảnh, video, âm thanh, văn bản và notebook được mở trong vùng đọc có watermark. Tệp cho phép tải sẽ được giải mã theo lựa chọn của chủ tài liệu.</p>
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
