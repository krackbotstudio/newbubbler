'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AnalyticsPreset } from '@/types';
import { RotateCcw } from 'lucide-react';

const PRESET_OPTIONS: { value: AnalyticsPreset; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_1_MONTH', label: 'Last 1 month' },
  { value: 'LAST_3_MONTHS', label: 'Last 3 months' },
  { value: 'LAST_6_MONTHS', label: 'Last 6 months' },
  { value: 'LAST_12_MONTHS', label: 'Last 12 months' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LAST_YEAR', label: 'Last year' },
  { value: 'FY25', label: 'FY25' },
  { value: 'FY26', label: 'FY26' },
  { value: 'FY27', label: 'FY27' },
  { value: 'CUSTOM', label: 'Custom range' },
];

export type BreakdownMode = 'DAILY' | 'MONTHLY';

export interface AnalyticsFilterBarProps {
  preset: AnalyticsPreset;
  setPreset: (p: AnalyticsPreset) => void;
  dateFrom: string;
  setDateFrom: (s: string) => void;
  dateTo: string;
  setDateTo: (s: string) => void;
  mode: BreakdownMode;
  setMode: (m: BreakdownMode) => void;
  onApplyCustomRange: () => void;
  onResetToPreset: () => void;
  isLoading: boolean;
  dateRangeError?: string;
}

export function AnalyticsFilterBar({
  preset,
  setPreset,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  mode,
  setMode,
  onApplyCustomRange,
  onResetToPreset,
  isLoading,
  dateRangeError,
}: AnalyticsFilterBarProps) {
  const isCustom = preset === 'CUSTOM';

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Preset</label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
            value={preset}
            onChange={(e) => setPreset(e.target.value as AnalyticsPreset)}
            disabled={isLoading}
          >
            {PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isCustom && (
          <>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={isLoading}
                className={dateRangeError ? 'border-destructive' : ''}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={isLoading}
                className={dateRangeError ? 'border-destructive' : ''}
              />
            </div>
            {dateRangeError ? (
              <p className="text-sm text-destructive self-center">{dateRangeError}</p>
            ) : null}
            <Button size="sm" onClick={onApplyCustomRange} disabled={isLoading}>
              Apply
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onResetToPreset} disabled={isLoading}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to preset
        </Button>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs font-medium text-muted-foreground">Breakdown:</span>
        <div className="flex rounded-md border border-input overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm ${mode === 'DAILY' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
            onClick={() => setMode('DAILY')}
          >
            Daily
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm border-l border-input ${mode === 'MONTHLY' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
            onClick={() => setMode('MONTHLY')}
            title="Monthly coming soon"
          >
            Monthly
          </button>
        </div>
      </div>
    </div>
  );
}
