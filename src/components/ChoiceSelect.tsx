"use client";

import { useEffect, useRef, useState } from 'react';

export type ChoiceOption = { value: string; label: string; description?: string };

export default function ChoiceSelect({ value, options, onChange, disabled = false, ariaLabel }: {
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={`choice-select ${open ? 'open' : ''}`} ref={rootRef}>
      <button type="button" className="input choice-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}>
        <span><strong>{selected?.label}</strong>{selected?.description && <small>{selected.description}</small>}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <div className="choice-select-panel" role="listbox">
          {options.map((option) => (
            <button type="button" key={option.value} role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}>
              <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
