import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const normalized = normalizeAddress(address);
  const limitParam = Number(new URL(req.url).searchParams.get('limit') || 100);
  const limit = Math.min(Math.max(Number.isInteger(limitParam) ? limitParam : 100, 1), 500);
  const rows = getDb().prepare(
    `SELECT DISTINCT a.id, a.actor_address, a.action, a.resource_type, a.resource_id,
            a.outcome, a.metadata_json, a.created_at
     FROM audit_events a
     LEFT JOIN files f ON a.resource_type = 'file' AND f.id = a.resource_id
     LEFT JOIN tokens t ON a.resource_type = 'token' AND t.token = a.resource_id
     LEFT JOIN files tf ON t.file_id = tf.id
     LEFT JOIN vault_members vm ON vm.vault_id = COALESCE(f.vault_id, tf.vault_id) AND vm.address = ?
     LEFT JOIN vault_members direct_vm ON a.resource_type = 'vault' AND direct_vm.vault_id = a.resource_id AND direct_vm.address = ?
     WHERE a.actor_address = ?
        OR f.owner_address = ?
        OR tf.owner_address = ?
        OR (vm.role IN ('owner', 'editor'))
        OR (direct_vm.role IN ('owner', 'editor'))
     ORDER BY a.created_at DESC LIMIT ?`
  ).all(normalized, normalized, normalized, normalized, normalized, limit) as Array<{ metadata_json: string | null } & Record<string, unknown>>;
  return NextResponse.json({
    ok: true,
    events: rows.map((row) => ({
      ...row,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      metadata_json: undefined,
    })),
  });
}
