"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { getLocalEncryptionIdentity } from '@/lib/clientEncryptionIdentity';
import type { EncryptionPublicJwk } from '@/lib/encryptionIdentity';
import type { RecipientSecretEnvelope } from '@/lib/recipientEnvelope';
import FileSelectCombobox from '@/components/FileSelectCombobox';
import NotebookViewer from '@/components/NotebookViewer';
import { protectedViewKind, type ProtectedViewKind } from '@/lib/protectedView';

type ApprovalRow = {
  id: string;
  requester_address: string;
  threshold: number;
  status: string;
  title: string | null;
  name: string | null;
  vault_name: string;
  approval_count: number;
  can_approve: number;
  approved_token?: string | null;
};

async function csrfToken() {
  const response = await fetch('/api/csrf');
  return (await response.json()).csrf as string;
}

export default function ApprovalManager() {
  const { address } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [fileId, setFileId] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerText, setViewerText] = useState('');
  const [viewerKind, setViewerKind] = useState<ProtectedViewKind>('unsupported');
  const [viewerName, setViewerName] = useState('');

  useEffect(() => () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  }, [viewerUrl]);

  const load = useCallback(async () => {
    const response = await fetch('/api/approvals');
    const data = await response.json();
    if (response.ok && data.ok) setRows(data.requests as ApprovalRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createRequest() {
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
        body: JSON.stringify({ fileId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to create approval request');
      toast.success('Đã tạo yêu cầu phê duyệt theo ngưỡng');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function approve(requestId: string) {
    if (!address) return;
    try {
      const identity = await getLocalEncryptionIdentity(address);
      if (!identity) throw new Error('This device does not have your encryption private key');
      const { decryptThresholdShare } = await import('@/lib/clientThresholdShares');
      const { wrapSecretForRecipient } = await import('@/lib/clientRecipientEnvelope');
      const response = await fetch(`/api/approvals/${requestId}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to load approval request');
      const share = await decryptThresholdShare(
        data.request.encryptedShare as RecipientSecretEnvelope,
        identity.privateKey
      );
      const envelope = await wrapSecretForRecipient(
        new TextEncoder().encode(share).buffer as ArrayBuffer,
        data.request.requesterIdentity.publicKey as EncryptionPublicJwk
      );
      const approveResponse = await fetch(`/api/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
        body: JSON.stringify({ envelope }),
      });
      const approveData = await approveResponse.json();
      if (!approveResponse.ok || !approveData.ok) throw new Error(approveData.error || 'Approval failed');
      toast.success(approveData.token
        ? `Đã đủ phê duyệt và cấp token cho người yêu cầu (${approveData.approvalCount}/${approveData.threshold})`
        : `Đã gửi phê duyệt (${approveData.approvalCount}/${approveData.threshold})`
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyApprovalLink(token: string) {
    const link = `${window.location.origin}/download?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(link);
    toast.success('Đã sao chép liên kết mở bằng token');
  }

  async function recoverInViewer(requestId: string) {
    if (!address) return;
    try {
      const identity = await getLocalEncryptionIdentity(address);
      if (!identity) throw new Error('This device does not have your encryption private key');
      const { combineSecret } = await import('@/lib/clientThresholdShares');
      const { unwrapSecretFromRecipientEnvelope } = await import('@/lib/clientRecipientEnvelope');
      const response = await fetch(`/api/approvals/${requestId}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to load approval request');
      const request = data.request as {
        id: string;
        threshold: number;
        approvalCount: number;
        contributions: Array<{ envelope: RecipientSecretEnvelope }>;
        cid: string;
        iv: string;
        mime?: string;
        name?: string;
      };
      if (request.approvalCount < request.threshold) throw new Error('Not enough approvals yet');
      const shares = await Promise.all(
        request.contributions.slice(0, request.threshold).map(async (contribution) => {
          const plain = await unwrapSecretFromRecipientEnvelope(contribution.envelope, identity.privateKey);
          return new TextDecoder().decode(plain);
        })
      );
      const rawKey = combineSecret(shares);
      const cipherResponse = await fetch(`/api/storage/get?approvalRequestId=${encodeURIComponent(request.id)}`);
      if (!cipherResponse.ok) throw new Error('Failed to fetch ciphertext');
      const cipher = await cipherResponse.arrayBuffer();
      const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const iv = Uint8Array.from(atob(request.iv), (character) => character.charCodeAt(0));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      const kind = protectedViewKind(request.name, request.mime);
      if (kind === 'unsupported') throw new Error('Định dạng này chưa có Viewer an toàn');
      const blob = new Blob([plain], { type: request.mime || 'application/octet-stream' });
      setViewerKind(kind);
      setViewerName(request.name || 'Tài liệu');
      if (kind === 'text' || kind === 'notebook') {
        setViewerText(await blob.text());
        setViewerUrl('');
      } else {
        if (viewerUrl) URL.revokeObjectURL(viewerUrl);
        setViewerText('');
        setViewerUrl(URL.createObjectURL(blob));
      }
      toast.success('Đã khôi phục tài liệu vào Viewer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="glass allow-overflow p-4">
      <div className="text-sm font-semibold mb-2">Yêu cầu phê duyệt theo ngưỡng</div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end mb-4">
        <FileSelectCombobox value={fileId} onChange={setFileId} placeholder="Chọn một tệp được bảo vệ theo ngưỡng..." />
        <button className="btn-primary" disabled={!fileId} onClick={createRequest}>Yêu cầu truy cập</button>
      </div>
      {rows.length === 0 ? <div className="text-sm muted">Chưa có yêu cầu phê duyệt.</div> : (
        <div className="table-scroll"><table className="w-full text-sm">
          <thead className="text-left muted">
            <tr>
              <th className="py-2 pr-3">Tệp</th>
              <th className="py-2 pr-3">Kho</th>
              <th className="py-2 pr-3">Tiến độ</th>
              <th className="py-2 pr-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isRequester = address?.toLowerCase() === row.requester_address;
              return (
                <tr key={row.id} className="border-t border-[var(--card-border)]">
                  <td className="py-2 pr-3">{row.title || row.name || 'file'}</td>
                  <td className="py-2 pr-3">{row.vault_name}</td>
                  <td className="py-2 pr-3">{row.approval_count}/{row.threshold} ({row.status})</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      {row.can_approve ? <button className="btn-secondary text-xs" onClick={() => approve(row.id)}>Phê duyệt</button> : null}
                      {isRequester ? (
                        <button className="btn-secondary text-xs" disabled={row.approval_count < row.threshold} onClick={() => recoverInViewer(row.id)}>
                          Khôi phục vào Viewer
                        </button>
                      ) : null}
                      {isRequester && row.approved_token ? (
                        <>
                          <a className="btn-secondary text-xs" href={`/download?token=${encodeURIComponent(row.approved_token)}`}>Mở bằng token</a>
                          <button className="btn-secondary text-xs" onClick={() => copyApprovalLink(row.approved_token!)}>Sao chép link</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
      {(viewerUrl || viewerText) && (
        <section className="protected-reader mt-4">
          <div className="protected-reader-bar"><div><strong>{viewerName}</strong><span>Đã đủ phê duyệt · chỉ mở trong Viewer</span></div></div>
          <div className="protected-reader-stage" onContextMenu={(event) => event.preventDefault()}>
            {viewerKind === 'text' && <pre>{viewerText}</pre>}
            {viewerKind === 'notebook' && <NotebookViewer source={viewerText} />}
            {/* Blob URLs are local decrypted assets and cannot use the Next image optimizer. */}
            {viewerKind === 'image' && <img src={viewerUrl} alt={viewerName} draggable={false} />}
            {viewerKind === 'video' && <video src={viewerUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture />}
            {viewerKind === 'audio' && <audio src={viewerUrl} controls controlsList="nodownload noplaybackrate" />}
            {viewerKind === 'pdf' && <iframe src={`${viewerUrl}#toolbar=0&navpanes=0`} title={viewerName} />}
          </div>
        </section>
      )}
    </div>
  );
}
