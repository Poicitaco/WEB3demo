import EncryptUploader from '@/components/EncryptUploader';

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Upload & Encrypt</h1>
      <EncryptUploader />
    </div>
  );
}
