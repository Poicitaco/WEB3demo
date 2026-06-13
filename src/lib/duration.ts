export const DURATION_PRESETS = [
  { minutes: 60, label: '1 giờ' },
  { minutes: 360, label: '6 giờ' },
  { minutes: 1440, label: '24 giờ' },
  { minutes: 4320, label: '3 ngày' },
] as const;

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} phút`;
  if (minutes % 1440 === 0) return `${minutes / 1440} ngày`;
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
