'use client';

import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Dark, saturated presets for primary (accents, nav, buttons). */
const PRESET_PRIMARY = [
  '#991b1b',
  '#0e7490',
  '#1e3a8a',
  '#166534',
  '#86198f',
  '#854d0e',
  '#171717',
  '#404040',
] as const;

/** Light tints for secondary (surfaces, card washes). */
const PRESET_SECONDARY = [
  '#fecaca',
  '#cffafe',
  '#dbeafe',
  '#dcfce7',
  '#fae8ff',
  '#fef9c3',
  '#f5f5f5',
  '#ffffff',
] as const;

export function normalizeHex6(raw: string, fallback: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return fallback;
}

function isHex6(raw: string): boolean {
  const t = raw.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(t) || /^[0-9A-Fa-f]{6}$/.test(t);
}

export function HexColorPickField({
  value,
  onChange,
  fallbackHex,
  ariaLabel,
  className,
  presetVariant = 'primary',
}: {
  value: string;
  onChange: (hex: string) => void;
  fallbackHex: string;
  ariaLabel: string;
  className?: string;
  /** Primary uses dark presets; secondary uses light pastels. */
  presetVariant?: 'primary' | 'secondary';
}) {
  const fb = normalizeHex6(fallbackHex, '#808080');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeHex6(value, fb));

  useEffect(() => {
    if (open) setDraft(normalizeHex6(value, fb));
  }, [open, value, fb]);

  const displayColor = normalizeHex6(value, fb);
  const pickerSafe = isHex6(draft) ? normalizeHex6(draft, fb) : fb;

  const apply = () => {
    onChange(normalizeHex6(draft, fb));
    setOpen(false);
  };

  const presetHexes = presetVariant === 'secondary' ? PRESET_SECONDARY : PRESET_PRIMARY;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={cn(
          'h-10 w-12 shrink-0 touch-manipulation cursor-pointer rounded-md border border-slate-300 bg-white p-1 shadow-sm transition-opacity hover:opacity-90 active:opacity-80',
          className,
        )}
      >
        <span
          className="block h-full w-full rounded-sm border border-black/15"
          style={{ backgroundColor: displayColor }}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,520px)] max-w-[min(100vw-1.5rem,380px)] gap-4 overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Choose colour</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <HexColorPicker
              color={pickerSafe}
              onChange={(c) => setDraft(c)}
              style={{ width: '100%', height: '192px' }}
            />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Presets</p>
              <div className="grid grid-cols-4 gap-3 place-items-center">
                {presetHexes.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={cn(
                      'h-11 w-11 shrink-0 touch-manipulation rounded-full border-2 border-slate-400/80 shadow-sm transition-transform active:scale-95',
                      presetVariant === 'secondary' && 'border-slate-300',
                      normalizeHex6(draft, fb).toLowerCase() === hex.toLowerCase() &&
                        'ring-2 ring-primary ring-offset-2',
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={`Use preset ${hex}`}
                    onClick={() => setDraft(hex)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" className="touch-manipulation" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="touch-manipulation" onClick={apply}>
              Set colour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
