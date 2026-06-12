"use client";

import Link from 'next/link';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const revealWords = 'Security should feel invisible until the exact moment you need proof that it is working.'.split(' ');

const stackCards = [
  { title: 'Encrypt before upload', copy: 'AES-256-GCM seals every byte locally. The server receives ciphertext, never plaintext.', code: 'LOCAL / AES-GCM' },
  { title: 'Bind access to wallets', copy: 'Recipient keys are wrapped with ECDH P-256 so possession of a link is never enough.', code: 'ECDH / P-256' },
  { title: 'Turn trust into consensus', copy: 'Shamir K-of-N approvals distribute authority across the people who should hold it.', code: 'THRESHOLD / K-N' },
];

export default function HomeExperience() {
  const root = useRef<HTMLDivElement>(null);
  const heroOrb = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)' },
      (context) => {
        if (!context.conditions?.motion) return;

        gsap.timeline({ defaults: { ease: 'power4.out' } })
          .from('.spatial-nav-proxy', { y: -24, autoAlpha: 0, duration: .8 })
          .from('.hero-reveal', { yPercent: 115, autoAlpha: 0, duration: 1.15, stagger: .1 }, '-=.45')
          .from('.hero-support', { y: 22, autoAlpha: 0, duration: .75, stagger: .1 }, '-=.55')
          .from('.hero-orb', { scale: .6, autoAlpha: 0, duration: 1.4 }, '-=1.05');

        gsap.to('.orb-shell-a', { rotation: 360, duration: 30, ease: 'none', repeat: -1 });
        gsap.to('.orb-shell-b', { rotation: -360, duration: 22, ease: 'none', repeat: -1 });
        gsap.to('.orb-light', { scale: 1.18, autoAlpha: .7, duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true });

        gsap.from('.bento-cell', {
          y: 80, scale: .94, autoAlpha: 0, stagger: .1, duration: 1,
          scrollTrigger: { trigger: '.bento-grid', start: 'top 82%', once: true },
        });

        gsap.to('.reveal-word', {
          color: '#f7f8fb',
          stagger: .08,
          scrollTrigger: { trigger: '.word-reveal', start: 'top 78%', end: 'bottom 48%', scrub: 1 },
        });

        if (context.conditions.desktop) {
          const cards = gsap.utils.toArray<HTMLElement>('.stack-card');
          cards.forEach((card, index) => {
            gsap.to(card, {
              scale: 1 - (cards.length - index - 1) * .035,
              y: -index * 14,
              filter: `brightness(${.72 + index * .1})`,
              scrollTrigger: {
                trigger: card,
                start: 'top 18%',
                end: '+=75%',
                scrub: .8,
                pin: true,
                pinSpacing: index === cards.length - 1,
              },
            });
          });
        }

        gsap.from('.final-reveal', {
          y: 70, autoAlpha: 0, stagger: .1, duration: 1,
          scrollTrigger: { trigger: '.spatial-final', start: 'top 76%', once: true },
        });
      }
    );

    if (!heroOrb.current) return () => mm.revert();
    const xTo = gsap.quickTo(heroOrb.current, 'x', { duration: 1, ease: 'power3.out' });
    const yTo = gsap.quickTo(heroOrb.current, 'y', { duration: 1, ease: 'power3.out' });
    const onPointer = (event: PointerEvent) => {
      xTo((event.clientX / innerWidth - .5) * 32);
      yTo((event.clientY / innerHeight - .5) * 24);
    };
    window.addEventListener('pointermove', onPointer);
    return () => { window.removeEventListener('pointermove', onPointer); mm.revert(); };
  }, { scope: root });

  return (
    <main ref={root} className="home-experience overflow-x-hidden w-full max-w-full">
      <section className="spatial-hero">
        <div ref={heroOrb} className="hero-orb" aria-hidden="true">
          <div className="orb-light" />
          <div className="orb-shell orb-shell-a"><i/><i/><i/><i/></div>
          <div className="orb-shell orb-shell-b"><b>KEY</b><b>0x</b><b>K/N</b></div>
          <div className="orb-glass"><span>Encrypted</span><strong>SS</strong><small>Client-side trust</small></div>
        </div>
        <div className="spatial-hero-copy">
          <p className="hero-support">Private file infrastructure for teams that cannot rely on trust alone.</p>
          <h1>
            <span className="hero-line-mask"><span className="hero-reveal">Share files.</span></span>
            <span className="hero-line-mask"><span className="hero-reveal hero-soft">Keep the keys.</span></span>
          </h1>
          <div className="hero-support spatial-actions">
            <Link href="/upload" className="btn-primary">Start encrypting</Link>
            <Link href="/dashboard" className="btn-secondary">Explore the vault</Link>
          </div>
        </div>
        <div className="hero-support hero-footnote"><span>AES-256-GCM</span><span>Wallet-bound access</span><span>Threshold recovery</span></div>
      </section>

      <section className="interest-chapter">
        <div className="chapter-heading">
          <h2>Designed around the moment access matters.</h2>
          <p>Every layer stays quiet, legible, and verifiable until someone asks to open the file.</p>
        </div>
        <div className="bento-grid">
          <article className="bento-cell bento-visual">
            <div className="visual-haze" />
            <div className="visual-file"><span>contract.pdf</span><strong>SEALED</strong><small>256-bit authenticated encryption</small></div>
          </article>
          <article className="bento-cell bento-copy">
            <span>Wallet access</span><h3>A link is not permission.</h3><p>Only the intended wallet can unwrap the key.</p>
          </article>
          <article className="bento-cell bento-copy bento-copy-alt">
            <span>Shared authority</span><h3>No single point of approval.</h3><p>Require K people before recovery becomes possible.</p>
          </article>
        </div>
      </section>

      <section className="word-reveal">
        <p>{revealWords.map((word, index) => <span className="reveal-word" key={`${word}-${index}`}>{word} </span>)}</p>
      </section>

      <section className="stack-chapter">
        <div className="stack-intro">
          <h2>A security model you can explain in three moves.</h2>
          <p>Complex cryptography, presented as a calm sequence of human decisions.</p>
        </div>
        <div className="stack-list">
          {stackCards.map((card, index) => (
            <article className="stack-card" key={card.title}>
              <div className="stack-card-index">0{index + 1}</div>
              <div><span>{card.code}</span><h3>{card.title}</h3><p>{card.copy}</p></div>
              <div className="stack-card-orbit"><i/><i/><i/></div>
            </article>
          ))}
        </div>
      </section>

      <section className="spatial-final">
        <div className="final-reveal final-orb"><span>SS</span></div>
        <h2 className="final-reveal">Make access feel deliberate.</h2>
        <p className="final-reveal">Encrypt locally. Share selectively. Recover together.</p>
        <Link href="/upload" className="btn-primary final-reveal">Create a sealed file</Link>
      </section>
    </main>
  );
}
