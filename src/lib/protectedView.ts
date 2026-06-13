export type ProtectedViewKind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'notebook' | 'unsupported';

export function protectedViewKind(name = '', mime = ''): ProtectedViewKind {
  const lowerName = name.toLowerCase();
  const lowerMime = mime.toLowerCase();
  if (lowerName.endsWith('.ipynb')) return 'notebook';
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) return 'image';
  if (lowerMime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(lowerName)) return 'video';
  if (lowerMime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(lowerName)) return 'audio';
  if (lowerMime.startsWith('text/') || /\.(md|txt|csv|json|xml|log|py|js|ts|tsx|jsx|java|c|cpp|rs|go|sql)$/i.test(lowerName)) return 'text';
  return 'unsupported';
}

export function protectedViewLabel(kind: ProtectedViewKind) {
  return {
    pdf: 'PDF',
    image: 'Hình ảnh',
    video: 'Video',
    audio: 'Âm thanh',
    text: 'Văn bản / mã nguồn',
    notebook: 'Jupyter Notebook',
    unsupported: 'Chưa có trình đọc an toàn',
  }[kind];
}
