const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

export function formatDateUtc(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTimeUtc(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
