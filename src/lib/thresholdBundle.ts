import {
  isRecipientSecretEnvelope,
  type RecipientSecretEnvelope,
} from '@/lib/recipientEnvelope';

export type ThresholdShareEnvelope = {
  memberAddress: string;
  shareIndex: number;
  envelope: RecipientSecretEnvelope;
};

export function isThresholdShareEnvelope(value: unknown): value is ThresholdShareEnvelope {
  if (!value || typeof value !== 'object') return false;
  const share = value as Partial<ThresholdShareEnvelope>;
  return (
    typeof share.memberAddress === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(share.memberAddress) &&
    Number.isInteger(share.shareIndex) &&
    Number(share.shareIndex) > 0 &&
    isRecipientSecretEnvelope(share.envelope)
  );
}
