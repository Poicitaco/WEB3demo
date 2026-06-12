"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { getLocalEncryptionIdentity } from '@/lib/clientEncryptionIdentity';
import {
  combineSecret,
  decryptThresholdShare,
} from '@/lib/clientThresholdShares';
import {
  unwrapSecretFromRecipientEnvelope,
  wrapSecretForRecipient,
} from '@/lib/clientRecipientEnvelope';
import type { EncryptionPublicJwk } from '@/lib/encryptionIdentity';
import type { RecipientSecretEnvelope } from '@/lib/recipientEnvelope';
import FileSelectCombobox from '@/components/FileSelectCombobox';

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
      toast.success('Threshold approval request created');
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
      toast.success(`Approval submitted (${approveData.approvalCount}/${approveData.threshold})`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function recoverAndDownload(requestId: string) {
    if (!address) return;
    try {
      const identity = await getLocalEncryptionIdentity(address);
      if (!identity) throw new Error('This device does not have your encryption private key');
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
      const url = URL.createObjectURL(new Blob([plain], { type: request.mime || 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = request.name || 'file';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Threshold-protected file recovered');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="glass p-4 overflow-x-auto">
      <div className="text-sm font-semibold mb-2">Threshold Approval Requests</div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end mb-4">
        <FileSelectCombobox value={fileId} onChange={setFileId} placeholder="Select a threshold-protected file..." />
        <button className="btn-primary" disabled={!fileId} onClick={createRequest}>Request Access</button>
      </div>
      {rows.length === 0 ? <div className="text-sm muted">No approval requests.</div> : (
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr>
              <th className="py-2 pr-3">File</th>
              <th className="py-2 pr-3">Vault</th>
              <th className="py-2 pr-3">Progress</th>
              <th className="py-2 pr-3">Action</th>
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
                      {row.can_approve ? <button className="btn-secondary text-xs" onClick={() => approve(row.id)}>Approve</button> : null}
                      {isRequester ? (
                        <button className="btn-secondary text-xs" disabled={row.approval_count < row.threshold} onClick={() => recoverAndDownload(row.id)}>
                          Recover & Download
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
