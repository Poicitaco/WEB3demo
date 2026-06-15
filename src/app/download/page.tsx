import Downloader from '@/components/Downloader';
import PageIntro from '@/components/PageIntro';

export default function DownloadPage() {
  return (
    <div className="page-shell">
      <PageIntro kicker="Nhận tệp" title="Xác thực trước. Xem hoặc giải mã sau." copy="Dùng token để xác nhận quyền truy cập. Tài liệu chỉ đọc mở trong viewer; gói tải về vẫn có thể giữ nguyên trạng thái mã hóa." />
      <Downloader />
    </div>
  );
}
