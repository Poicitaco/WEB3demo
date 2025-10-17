import UploadWizard from '@/components/UploadWizard';

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create Encrypted Upload</h1>
      <UploadWizard />
    </div>
  );
}
