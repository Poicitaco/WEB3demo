"use client";

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export default function PageIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.intro-part', { y: 26, autoAlpha: 0, duration: .8, stagger: .09, ease: 'power3.out' });
    });
    return () => mm.revert();
  }, { scope: root });
  return (
    <div ref={root} className="page-intro">
      <div className="page-kicker intro-part">{kicker}</div>
      <h1 className="page-title intro-part">{title}</h1>
      <p className="page-copy intro-part">{copy}</p>
    </div>
  );
}
