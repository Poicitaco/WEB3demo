import Downloader from '@/components/Downloader';
import PageIntro from '@/components/PageIntro';

export default function DownloadPage() {
  return (
    <div className="page-shell">
      <PageIntro kicker="Validate / recover" title="Open only what is yours." copy="Validate an access token, recover the encrypted key, and decrypt the file entirely inside this browser." />
      <Downloader />
    </div>
  );
}
