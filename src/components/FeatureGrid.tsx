import { ReactNode } from 'react';

type Item = { title: string; desc: string; icon?: ReactNode };

const items: Item[] = [
  { title: 'Leverage AES-GCM', desc: '256-bit keys with authenticated encryption.' },
  { title: 'Client-side only', desc: 'Keys never leave your browser.' },
  { title: 'Token-based access', desc: 'Issue share tokens with TTL.' },
  { title: 'Local/IPFS storage', desc: 'Swap providers without changing flows.' },
  { title: 'Wallet sign-in', desc: 'Nonce + signature, no password needed.' },
  { title: 'Open-source', desc: 'Simple architecture, easy to audit.' },
];

export default function FeatureGrid() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.title} className="glass p-5">
          <div className="text-base font-semibold">{it.title}</div>
          <div className="text-sm mt-1 muted">{it.desc}</div>
        </div>
      ))}
    </section>
  );
}

