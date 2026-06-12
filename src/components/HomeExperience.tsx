"use client";

import Link from 'next/link';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const protocols = [
  ['01', 'Client encryption', 'AES-256-GCM seals content before it leaves your browser.'],
  ['02', 'Wallet-bound access', 'ECDH envelopes make file keys readable only by the intended wallet.'],
  ['03', 'Threshold recovery', 'Shamir K-of-N approval turns access into a collective decision.'],
  ['04', 'Immutable control', 'Versions, self-destruct limits, revocation, and audit events stay traceable.'],
];

export default function HomeExperience() {
  const root = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 768px)' },
      (context) => {
        if (!context.conditions?.motion) return;
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro
          .from('.hero-line', { yPercent: 110, autoAlpha: 0, duration: 1.05, stagger: .12 })
          .from('.hero-meta', { y: 18, autoAlpha: 0, duration: .65, stagger: .08 }, '-=.5')
          .from('.crypto-core', { scale: .72, rotation: -16, autoAlpha: 0, duration: 1.25 }, '-=.85');

        gsap.to('.core-ring-a', { rotation: 360, duration: 22, ease: 'none', repeat: -1 });
        gsap.to('.core-ring-b', { rotation: -360, duration: 16, ease: 'none', repeat: -1 });
        gsap.to('.core-pulse', { scale: 1.15, autoAlpha: .35, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });

        gsap.from('.protocol-row', {
          x: -44,
          autoAlpha: 0,
          stagger: .12,
          duration: .75,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.protocol-list', start: 'top 78%', once: true },
        });

        if (context.conditions.desktop) {
          gsap.to('.manifesto-track', {
            xPercent: -18,
            ease: 'none',
            scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: 1 },
          });
        }
      }
    );

    if (!core.current) return () => mm.revert();
    const xTo = gsap.quickTo(core.current, 'x', { duration: .7, ease: 'power3.out' });
    const yTo = gsap.quickTo(core.current, 'y', { duration: .7, ease: 'power3.out' });
    const onPointer = (event: PointerEvent) => {
      xTo((event.clientX / window.innerWidth - .5) * 24);
      yTo((event.clientY / window.innerHeight - .5) * 24);
    };
    window.addEventListener('pointermove', onPointer);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      mm.revert();
    };
  }, { scope: root });

  return (
    <div ref={root} className="home-experience">
      <section className="hero-stage">
        <div className="hero-copy">
          <div className="hero-meta hero-signal"><span /> Zero-knowledge file control</div>
          <h1>
            <span className="hero-mask"><span className="hero-line">Encrypt the file.</span></span>
            <span className="hero-mask"><span className="hero-line accent-line">Own the access.</span></span>
          </h1>
          <p className="hero-meta hero-description">A client-side encrypted vault where wallets, thresholds, and expiring access replace blind trust.</p>
          <div className="hero-meta hero-actions">
            <Link href="/upload" className="btn-primary">Encrypt a file</Link>
            <Link href="/dashboard" className="btn-secondary">Open control room</Link>
          </div>
        </div>
        <div className="core-zone" aria-hidden="true">
          <div ref={core} className="crypto-core">
            <div className="core-pulse" />
            <div className="core-ring core-ring-a"><i/><i/><i/><i/></div>
            <div className="core-ring core-ring-b"><b>256</b><b>ECDH</b><b>K/N</b></div>
            <div className="core-center"><span>SEALED</span><strong>0x</strong><small>CLIENT SIDE</small></div>
          </div>
        </div>
        <div className="hero-index"><span>SECURESHARE</span><span>PROTOCOL / 2026</span></div>
      </section>

      <section className="manifesto">
        <div className="manifesto-track">YOUR FILES SHOULD NOT REQUIRE TRUST. YOUR KEYS SHOULD NOT LEAVE YOU.</div>
      </section>

      <section className="protocol-section">
        <div className="protocol-heading">
          <span>Access architecture</span>
          <h2>Security is not a feature card. It is the entire flow.</h2>
        </div>
        <div className="protocol-list">
          {protocols.map(([index, title, copy]) => (
            <article className="protocol-row" key={index}>
              <span>{index}</span><h3>{title}</h3><p>{copy}</p><b>↗</b>
            </article>
          ))}
        </div>
      </section>

      <section className="final-call">
        <div>
          <span>Ready when you are</span>
          <h2>Turn a file into a cryptographic agreement.</h2>
        </div>
        <Link href="/upload" className="btn-primary">Begin encryption</Link>
      </section>
    </div>
  );
}
