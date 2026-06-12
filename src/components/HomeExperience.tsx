"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const revealWords = 'Security should feel invisible until the exact moment you need proof that it is working.'.split(' ');
const cipherBlocks = Array.from({ length: 12 });

export default function HomeExperience() {
  const root = useRef<HTMLDivElement>(null);
  const heroOrb = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);

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

        gsap.to('.artifact-image', { y: -12, rotation: 1.5, duration: 4.5, ease: 'sine.inOut', repeat: -1, yoyo: true });
        gsap.to('.artifact-light', { scale: 1.14, autoAlpha: .72, duration: 3.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
        gsap.to('.artifact-scan', { yPercent: 850, duration: 5.5, ease: 'none', repeat: -1, repeatDelay: 2.5 });
        gsap.to('.hero-orb', {
          '--reveal-size': '62%',
          scrollTrigger: { trigger: '.spatial-hero', start: 'top top', end: 'bottom top', scrub: 1 },
        });

        gsap.timeline({
          scrollTrigger: { trigger: '.encrypt-scene', start: 'top 72%', end: 'bottom 38%', scrub: 1.1 },
        })
          .from('.encrypt-copy > *', { y: 55, autoAlpha: 0, stagger: .12, duration: .8 }, 0)
          .from('.scene-file', { rotationY: -18, scale: .82, autoAlpha: 0, duration: 1 }, 0)
          .to('.scene-file', { rotationY: 12, scale: .88, duration: 1 }, .55)
          .fromTo('.cipher-block', {
            x: 0, y: 0, scale: .2, autoAlpha: 0,
          }, {
            x: (index) => ((index % 4) - 1.5) * 112,
            y: (index) => (Math.floor(index / 4) - 1) * 112,
            scale: 1,
            autoAlpha: 1,
            stagger: .025,
            duration: 1,
          }, .65)
          .to('.cipher-block', { x: 0, y: 0, scale: .3, autoAlpha: 0, stagger: .018, duration: .8 }, 1.65)
          .to('.scene-file', { rotationY: 0, scale: 1, duration: .8 }, 1.75)
          .fromTo('.seal-scan', { yPercent: -130, autoAlpha: 0 }, { yPercent: 550, autoAlpha: 1, duration: .7 }, 1.95);

        gsap.timeline({
          scrollTrigger: { trigger: '.wallet-scene', start: 'top 72%', end: 'bottom 35%', scrub: 1 },
        })
          .from('.wallet-copy > *', { y: 55, autoAlpha: 0, stagger: .12, duration: .8 })
          .from('.wallet-device', { x: 100, rotationY: -24, autoAlpha: 0, duration: 1 }, 0)
          .from('.access-packet', { x: -260, scale: .35, autoAlpha: 0, duration: 1.2 }, .5)
          .to('.access-line', { scaleX: 1, duration: 1.2 }, .55)
          .to('.access-packet', { x: 160, rotation: 90, duration: 1.2 }, 1.1)
          .to('.wallet-status-before', { y: -18, autoAlpha: 0, duration: .35 }, 1.8)
          .to('.wallet-status-after', { y: 0, autoAlpha: 1, duration: .4 }, 1.9)
          .to('.wallet-glow', { scale: 1.25, autoAlpha: .65, duration: .55 }, 1.8);

        gsap.to('.reveal-word', {
          color: '#f7f8fb',
          stagger: .08,
          scrollTrigger: { trigger: '.word-reveal', start: 'top 78%', end: 'bottom 48%', scrub: 1 },
        });

        if (context.conditions.desktop) {
          gsap.timeline({
            scrollTrigger: {
              trigger: '.threshold-stage',
              start: 'top top',
              end: '+=1800',
              scrub: 1,
              pin: '.threshold-panel',
            },
          })
            .from('.threshold-node', { scale: .25, autoAlpha: 0, stagger: .12, duration: .8 })
            .to('.threshold-line', { strokeDashoffset: 0, autoAlpha: 1, stagger: .13, duration: .7 }, .45)
            .to('.threshold-node:nth-of-type(-n+3)', { scale: 1.14, duration: .35, stagger: .12 }, 1.1)
            .to('.threshold-count-step', { y: -72, duration: .6 }, 1.1)
            .to('.threshold-core', { scale: 1.16, rotation: 8, duration: .65 }, 1.55)
            .to('.threshold-lock-closed', { autoAlpha: 0, y: -12, duration: .25 }, 1.55)
            .to('.threshold-lock-open', { autoAlpha: 1, y: 0, duration: .35 }, 1.67)
            .to('.threshold-flare', { scale: 1.7, autoAlpha: .7, duration: .7 }, 1.5);
        } else {
          gsap.from('.threshold-node, .threshold-core', {
            y: 30, autoAlpha: 0, stagger: .08, duration: .7,
            scrollTrigger: { trigger: '.threshold-panel', start: 'top 78%', once: true },
          });
        }

        gsap.from('.final-reveal', {
          y: 70, autoAlpha: 0, stagger: .1, duration: 1,
          scrollTrigger: { trigger: '.spatial-final', start: 'top 76%', once: true },
        });
      }
    );

    const cursorEnabled = window.matchMedia('(pointer: fine)').matches
      && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (!heroOrb.current || !cursor.current || !cursorEnabled) return () => mm.revert();
    const xTo = gsap.quickTo(heroOrb.current, 'x', { duration: 1, ease: 'power3.out' });
    const yTo = gsap.quickTo(heroOrb.current, 'y', { duration: 1, ease: 'power3.out' });
    const cursorX = gsap.quickTo(cursor.current, 'x', { duration: .42, ease: 'power3.out' });
    const cursorY = gsap.quickTo(cursor.current, 'y', { duration: .42, ease: 'power3.out' });
    const revealX = gsap.quickSetter(heroOrb.current, '--reveal-x');
    const revealY = gsap.quickSetter(heroOrb.current, '--reveal-y');
    const cursorCopy = cursor.current.querySelector<HTMLElement>('.cursor-copy');
    const onPointer = (event: PointerEvent) => {
      xTo((event.clientX / innerWidth - .5) * 32);
      yTo((event.clientY / innerHeight - .5) * 24);
      cursorX(event.clientX);
      cursorY(event.clientY);
      const orbBounds = heroOrb.current!.getBoundingClientRect();
      revealX(`${((event.clientX - orbBounds.left) / orbBounds.width) * 100}%`);
      revealY(`${((event.clientY - orbBounds.top) / orbBounds.height) * 100}%`);
      const overHero = Boolean((event.target as HTMLElement).closest('.spatial-hero'));
      gsap.to(heroOrb.current, { '--reveal-size': overHero ? '18%' : '0%', duration: .55, ease: 'power3.out', overwrite: 'auto' });
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor]');
      cursorCopy!.textContent = target?.dataset.cursor ?? '';
      gsap.to(cursor.current, {
        scale: target ? 1.8 : 1,
        autoAlpha: 1,
        duration: .3,
        overwrite: true,
      });
    };
    const onPointerLeave = () => gsap.to(cursor.current, { autoAlpha: 0, duration: .25 });
    window.addEventListener('pointermove', onPointer);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      mm.revert();
    };
  }, { scope: root });

  return (
    <main ref={root} className="home-experience overflow-x-hidden w-full max-w-full">
      <div ref={cursor} className="motion-cursor" aria-hidden="true"><span className="cursor-copy" /></div>
      <section className="spatial-hero">
        <div ref={heroOrb} className="hero-orb" data-cursor="sealed" aria-hidden="true">
          <div className="artifact-light" />
          <div className="artifact-frame">
            <i className="artifact-scan" />
            <Image className="artifact-image" src="/visuals/encrypted-artifact.png" alt="" fill priority sizes="(max-width: 900px) 105vw, 68vw" />
            <div className="artifact-reveal">
              <Image className="artifact-image artifact-image-open" src="/visuals/decrypted-artifact.png" alt="" fill priority sizes="(max-width: 900px) 105vw, 68vw" />
            </div>
            <i className="artifact-lens-ring" />
          </div>
        </div>
        <div className="spatial-hero-copy">
          <p className="hero-support">Private file infrastructure for teams that cannot rely on trust alone.</p>
          <h1>
            <span className="hero-line-mask"><span className="hero-reveal">Share files.</span></span>
            <span className="hero-line-mask"><span className="hero-reveal hero-soft">Keep the keys.</span></span>
          </h1>
          <div className="hero-support spatial-actions">
            <Link href="/upload" className="btn-primary" data-cursor="enter">Start encrypting</Link>
            <Link href="/dashboard" className="btn-secondary" data-cursor="explore">Explore the vault</Link>
          </div>
        </div>
        <p className="hero-reveal-hint hero-support">Move to reveal what the server never sees.</p>
      </section>

      <section className="product-scene encrypt-scene">
        <div className="scene-copy encrypt-copy">
          <span>01 / Local encryption</span>
          <h2>Sealed before it leaves.</h2>
          <p>AES-256-GCM transforms every byte before upload. Storage receives an unreadable object, never your original file.</p>
        </div>
        <div className="scene-visual encrypt-visual" data-cursor="encrypt">
          <div className="cipher-field" aria-hidden="true">
            {cipherBlocks.map((_, index) => <i className="cipher-block" key={index} />)}
          </div>
          <div className="scene-file">
              <i className="seal-scan" />
              <span>quarterly-report.pdf</span><strong>SEALED</strong><small>ciphertext only / 18.4 mb</small>
          </div>
        </div>
      </section>

      <section className="product-scene wallet-scene">
        <div className="scene-copy wallet-copy">
          <span>02 / Wallet-bound access</span>
          <h2>A shared link is not permission.</h2>
          <p>The file key is wrapped for one recipient wallet. Forward the URL anywhere; only the intended wallet can open it.</p>
        </div>
        <div className="scene-visual wallet-visual" data-cursor="authorize">
          <div className="wallet-glow" />
          <div className="access-origin"><span>FILE KEY</span><b /></div>
          <div className="access-line" />
          <div className="access-packet"><i /></div>
          <div className="wallet-device">
            <div className="wallet-camera" />
            <div className="wallet-screen">
              <span>RECIPIENT</span>
              <strong>0x7A...91C4</strong>
              <div className="wallet-status"><b className="wallet-status-before">VERIFYING</b><b className="wallet-status-after">AUTHORIZED</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="word-reveal">
        <p>{revealWords.map((word, index) => <span className="reveal-word" key={`${word}-${index}`}>{word} </span>)}</p>
      </section>

      <section className="threshold-stage">
        <div className="threshold-panel">
          <div className="threshold-copy">
            <span>Threshold recovery / live</span>
            <h2>No one holds the whole key.</h2>
            <p>Five fragments stay independent. Any three can reconstruct access without revealing the secret to a single holder.</p>
            <div className="threshold-counter"><div className="threshold-count-step"><strong>0/5</strong><strong>3/5</strong></div><span>approvals</span></div>
          </div>
          <div className="threshold-map" data-cursor="approve">
            <svg viewBox="0 0 620 620" aria-hidden="true">
              <line className="threshold-line" x1="310" y1="310" x2="310" y2="60" />
              <line className="threshold-line" x1="310" y1="310" x2="548" y2="232" />
              <line className="threshold-line" x1="310" y1="310" x2="457" y2="512" />
              <line className="threshold-line threshold-line-muted" x1="310" y1="310" x2="163" y2="512" />
              <line className="threshold-line threshold-line-muted" x1="310" y1="310" x2="72" y2="232" />
            </svg>
            <div className="threshold-flare" />
            <div className="threshold-node threshold-node-1"><span>01</span><b>AL</b></div>
            <div className="threshold-node threshold-node-2"><span>02</span><b>MK</b></div>
            <div className="threshold-node threshold-node-3"><span>03</span><b>TD</b></div>
            <div className="threshold-node threshold-node-4"><span>04</span><b>JL</b></div>
            <div className="threshold-node threshold-node-5"><span>05</span><b>PS</b></div>
            <div className="threshold-core">
              <span className="threshold-lock-closed">K/N</span>
              <span className="threshold-lock-open">OPEN</span>
            </div>
          </div>
        </div>
      </section>

      <section className="spatial-final">
        <div className="final-reveal final-orb"><span className="seal-mark" /></div>
        <h2 className="final-reveal">Make access feel deliberate.</h2>
        <p className="final-reveal">Encrypt locally. Share selectively. Recover together.</p>
        <Link href="/upload" className="btn-primary final-reveal" data-cursor="create">Create a sealed file</Link>
      </section>
    </main>
  );
}
