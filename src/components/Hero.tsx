import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="relative z-10 max-w-5xl">
        <p className="text-xs tracking-wider text-cyan-300/80 uppercase">Built on client-side crypto</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold leading-tight">
          Secure, Private File Sharing
          <br /> With Client-side Encryption
        </h1>
        <p className="mt-4 max-w-xl text-sm sm:text-base muted">
          Encrypt in your browser with AES-GCM, store ciphertext, and share access via tokens. Your keys never leave your device.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/upload" className="btn-primary text-center">Start Uploading</Link>
          <Link href="/download" className="btn-secondary text-center">Try Download</Link>
        </div>
      </div>

      {/* Decorative gradient dots strip */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute right-[-10%] top-[-10%] h-[360px] w-[600px] rounded-full blur-3xl"
             style={{background: 'radial-gradient(closest-side, rgba(110,105,255,0.35), transparent)'}}/>
        <div className="absolute left-[-10%] bottom-[-20%] h-[300px] w-[500px] rounded-full blur-3xl"
             style={{background: 'radial-gradient(closest-side, rgba(0,224,255,0.25), transparent)'}}/>
      </div>
    </section>
  );
}

