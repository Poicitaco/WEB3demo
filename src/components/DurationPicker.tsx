"use client";

import { useState } from 'react';
import { DURATION_PRESETS, formatDuration } from '@/lib/duration';

export default function DurationPicker({ value, onChange, label = 'Thời hạn liên kết' }: {
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
}) {
  const isPreset = DURATION_PRESETS.some((preset) => preset.minutes === value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const hours = Math.max(1, Math.round(value / 60));

  return (
    <div className="duration-picker">
      <div className="field-heading">
        <label className="label">{label}</label>
        <span>{formatDuration(value)}</span>
      </div>
      <div className="duration-presets" role="group" aria-label={label}>
        {DURATION_PRESETS.map((preset) => (
          <button type="button" key={preset.minutes} className={value === preset.minutes && !customOpen ? 'active' : ''} onClick={() => {
            setCustomOpen(false);
            onChange(preset.minutes);
          }}>
            {preset.label}
          </button>
        ))}
        <button type="button" className={customOpen ? 'active' : ''} onClick={() => setCustomOpen(true)}>Tùy chỉnh</button>
      </div>
      {customOpen && (
        <div className="duration-custom">
          <input className="input" aria-label="Thời hạn tùy chỉnh theo giờ" type="number" min={1} max={72} value={hours} onChange={(event) => {
            const nextHours = Math.min(72, Math.max(1, Number(event.target.value) || 1));
            onChange(nextHours * 60);
          }} />
          <span>giờ</span>
          <small>Tối đa 72 giờ</small>
        </div>
      )}
    </div>
  );
}
