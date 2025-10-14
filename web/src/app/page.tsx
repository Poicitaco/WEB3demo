export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Client-side Encrypted Uploads</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Connect your wallet from the header, then try Upload/Download.
      </p>
      <ul className="list-disc pl-5 text-sm">
        <li>Encrypts files in the browser with AES-GCM.</li>
        <li>Stores ciphertext server-side (local demo provider).</li>
        <li>Saves metadata and issues a download token.</li>
        <li>Downloads and decrypts in your browser.</li>
      </ul>
    </div>
  );
}

