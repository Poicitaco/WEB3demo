import UploadWizard from '@/components/UploadWizard';
import PageIntro from '@/components/PageIntro';

export default function UploadPage() {
  return (
    <div className="page-shell">
      <PageIntro kicker="Encrypt / distribute" title="Create a sealed file." copy="Encrypt locally, define who can recover the key, then distribute access without exposing plaintext." />
      <UploadWizard />
    </div>
  );
}
