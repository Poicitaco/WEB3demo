import UploadWizard from '@/components/UploadWizard';
import PageIntro from '@/components/PageIntro';

export default function UploadPage() {
  return (
    <div className="page-shell">
      <PageIntro kicker="Gửi tệp riêng tư" title="Chọn tệp. Chọn người được xem." copy="Tạo một liên kết riêng tư, đặt thời hạn hoặc giới hạn lượt tải, rồi gửi đi mà vẫn giữ quyền thu hồi." />
      <UploadWizard />
    </div>
  );
}
