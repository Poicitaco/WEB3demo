"use client";

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export default function InterfaceMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        pointer: '(pointer: fine)',
      },
      (context) => {
        if (!context.conditions?.motion || !context.conditions.pointer) return;

        const cards = gsap.utils.toArray<HTMLElement>('.glass, .module-card, .transfer-module, .account-module');
        const buttons = gsap.utils.toArray<HTMLElement>('.magnetic');

        const onCardMove = (event: PointerEvent) => {
          const card = event.currentTarget as HTMLElement;
          const bounds = card.getBoundingClientRect();
          card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
          card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
        };

        const onButtonMove = (event: PointerEvent) => {
          const button = event.currentTarget as HTMLElement;
          const bounds = button.getBoundingClientRect();
          gsap.to(button, {
            x: (event.clientX - bounds.left - bounds.width / 2) * .12,
            y: (event.clientY - bounds.top - bounds.height / 2) * .18,
            duration: .18,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        };

        const onButtonLeave = (event: PointerEvent) => {
          gsap.to(event.currentTarget as HTMLElement, {
            x: 0,
            y: 0,
            duration: .22,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        };

        cards.forEach((card) => card.addEventListener('pointermove', onCardMove));
        buttons.forEach((button) => {
          button.addEventListener('pointermove', onButtonMove);
          button.addEventListener('pointerleave', onButtonLeave);
        });

        return () => {
          cards.forEach((card) => card.removeEventListener('pointermove', onCardMove));
          buttons.forEach((button) => {
            button.removeEventListener('pointermove', onButtonMove);
            button.removeEventListener('pointerleave', onButtonLeave);
          });
        };
      }
    );

    return () => mm.revert();
  }, { scope: root });

  return <div ref={root} className="interface-motion">{children}</div>;
}
