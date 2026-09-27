// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useRequestQuery } from '@/hooks/useQueryRequest';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://iprxetnntchgsekdbyon.supabase.co';
const SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  '';

const C = {
  navy: '#1B3A6B',
  amber: '#E8A020',
  green: '#27ae60',
  red: '#e74c3c',
  axis: '#d0d7e3',
  label: '#6b7a99',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function weekLabel(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function fmtDisp(n: number): string {
  return `$${n.toFixed(2)}`;
}

function getLast12WeekStarts(): Date[] {
  const thisMonday = getMondayOf(new Date());
  return Array.from({ length: 12 }, (_, i) =>
    addDays(thisMonday, -(11 - i) * 7),
  );
}

// ─── Supabase GF weekly data ──────────────────────────────────────────────────

interface WeekData {
  weekIso: string;
  label: string;
  totalamt: number;
  totalstops: number;
  revPerDispatch: number;
}

function useGFWeeklyData(): { data: WeekData[]; loading: boolean } {
  const [data, setData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weeks = getLast12WeekStarts();
    const fromIso = isoDate(weeks[0]);
    const toIso = isoDate(addDays(weeks[11], 6));
    const url =
      `${SUPABASE_URL}/rest/v1/gf_statement_weekly_totals` +
      `?select=date,totalamt,totalstops` +
      `&date=gte.${fromIso}T00:00:00` +
      `&date=lte.${toIso}T23:59:59` +
      `&limit=5000`;

    fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((rows: any[]) => {
        const byWeek = new Map<string, { amt: number; stops: number }>();
        for (const w of weeks) {
          byWeek.set(isoDate(w), { amt: 0, stops: 0 });
        }
        for (const row of rows || []) {
          const rowDate = (row.date ?? '').split('T')[0];
          if (byWeek.has(rowDate)) {
            const cur = byWeek.get(rowDate)!;
            cur.amt += Number(row.totalamt ?? 0);
            cur.stops += Number(row.totalstops ?? 0);
          } else {
            const d = new Date(rowDate + 'T12:00:00');
            const key = isoDate(getMondayOf(d));
            if (byWeek.has(key)) {
              const cur = byWeek.get(key)!;
              cur.amt += Number(row.totalamt ?? 0);
              cur.stops += Number(row.totalstops ?? 0);
            }
          }
        }
        const result: WeekData[] = [];
        for (const [weekIso, v] of byWeek.entries()) {
          result.push({
            weekIso,
            label: weekLabel(weekIso),
            totalamt: v.amt,
            totalstops: v.stops,
            revPerDispatch: v.stops > 0 ? v.amt / v.stops : 0,
          });
        }
        result.sort((a, b) => a.weekIso.localeCompare(b.weekIso));
        setData(result);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

// ─── BigCapital expenses hook ─────────────────────────────────────────────────

function useExpensesForPeriod(fromDate: string) {
  return useRequestQuery(
    ['disp-econ-expenses', fromDate],
    {
      method: 'get',
      url: 'expenses',
      params: { page_size: 500, from_date: fromDate || '2026-01-01' },
    },
    {
      select: (res: any) => res?.data?.expenses ?? res?.data ?? [],
      defaultData: [],
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  subtitle,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  subtitle?: string;
}) {
  const hasDelta = delta != null;
  const isPos = (delta ?? 0) >= 0;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e0e6ef',
        borderRadius: 8,
        padding: '14px 18px',
        flex: '1 1 160px',
        minWidth: 0,
        boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.label,
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1A1A2E',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#9aa5bc', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
      {hasDelta && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: isPos ? C.green : C.red,
            fontWeight: 600,
          }}
        >
          {isPos ? '▲' : '▼'} {Math.abs(delta!).toFixed(2)}{' '}
          {deltaLabel ?? 'vs prior period'}
        </div>
      )}
    </div>
  );
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({
  weeks,
  costRefLine,
  loading,
}: {
  weeks: WeekData[];
  costRefLine: number | null;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 520,
    H = 160;
  const PAD = { top: 14, right: 12, bottom: 32, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = weeks.length;

  if (loading) {
    return (
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        <rect
          x={PAD.left}
          y={PAD.top}
          width={cW}
          height={cH}
          fill="#f4f6fb"
          rx={4}
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={PAD.left + 20 + i * 90}
            y={PAD.top + 20 + i * 15}
            width={80}
            height={8}
            rx={3}
            fill="#e0e6ef"
            opacity={0.5}
          />
        ))}
      </svg>
    );
  }

  if (n === 0) return null;

  const revVals = weeks.map((w) => w.revPerDispatch).filter((v) => v > 0);
  if (revVals.length === 0) {
    return (
      <div
        style={{
          color: '#9aa5bc',
          fontSize: 12,
          textAlign: 'center',
          padding: '24px 0',
        }}
      >
        No revenue data for this period
      </div>
    );
  }

  const allVals = costRefLine ? [...revVals, costRefLine] : revVals;
  const rawMax = Math.max(...allVals);
  const rawMin = Math.min(...allVals) * 0.88;
  const maxVal = rawMax * 1.08;
  const minVal = Math.max(0, rawMin);
  const range = Math.max(maxVal - minVal, 1);

  const scaleX = (i: number) =>
    n === 1 ? PAD.left + cW / 2 : PAD.left + (i / (n - 1)) * cW;
  const scaleY = (v: number) => PAD.top + cH - ((v - minVal) / range) * cH;

  const revPoints = weeks
    .map((w, i) =>
      w.revPerDispatch > 0
        ? `${scaleX(i).toFixed(1)},${scaleY(w.revPerDispatch).toFixed(1)}`
        : null,
    )
    .filter(Boolean)
    .join(' ');

  const yTicks = [minVal, minVal + range / 2, maxVal];
  const costY = costRefLine ? scaleY(costRefLine) : null;

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      {/* Grid + Y-axis labels */}
      {yTicks.map((tick, i) => {
        const y = scaleY(tick);
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={PAD.left + cW}
              y1={y}
              y2={y}
              stroke={C.axis}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={C.label}
            >
              ${tick.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Cost reference line (dashed amber) */}
      {costY !== null && (
        <line
          x1={PAD.left}
          x2={PAD.left + cW}
          y1={costY}
          y2={costY}
          stroke={C.amber}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.85}
        />
      )}

      {/* Revenue polyline (navy) */}
      {revPoints && (
        <polyline
          points={revPoints}
          fill="none"
          stroke={C.navy}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots + X-labels + hover tooltip */}
      {weeks.map((w, i) => {
        const x = scaleX(i);
        const y = w.revPerDispatch > 0 ? scaleY(w.revPerDispatch) : null;
        const isHov = hovered === i;
        const showLabel = n <= 8 || i % 2 === 0;
        return (
          <g key={i}>
            {showLabel && (
              <text
                x={x}
                y={H - 5}
                textAnchor="middle"
                fontSize={8}
                fill={C.label}
              >
                {w.label}
              </text>
            )}
            {y !== null && (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={isHov ? 5.5 : 3.5}
                  fill={C.navy}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
                {isHov && (
                  <g>
                    <rect
                      x={Math.min(x - 28, W - 64)}
                      y={y - 26}
                      width={56}
                      height={17}
                      rx={3}
                      fill="#1A1A2E"
                      opacity={0.88}
                    />
                    <text
                      x={Math.min(x, W - 36)}
                      y={y - 14}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#fff"
                      fontWeight={600}
                    >
                      {fmtDisp(w.revPerDispatch)}
                    </text>
                  </g>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Legend item ─────────────────────────────────────────────────────────────

function LegendItem({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: C.label,
      }}
    >
      <svg width={18} height={12} style={{ flexShrink: 0 }}>
        {dashed ? (
          <line
            x1={0}
            y1={6}
            x2={18}
            y2={6}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        ) : (
          <line x1={0} y1={6} x2={18} y2={6} stroke={color} strokeWidth={2.5} />
        )}
      </svg>
      {label}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function DispatchEconomicsSection() {
  const { data: gfWeeks, loading: gfLoading } = useGFWeeklyData();
  const fromDate = gfWeeks.length > 0 ? gfWeeks[0].weekIso : '2026-01-01';
  const { data: expenses = [], isLoading: expLoading } =
    useExpensesForPeriod(fromDate);

  const loading = gfLoading || expLoading;

  // Aggregate period totals
  const totalStops = gfWeeks.reduce((s, w) => s + w.totalstops, 0);
  const totalRevenue = gfWeeks.reduce((s, w) => s + w.totalamt, 0);
  const totalExpenses = Array.isArray(expenses)
    ? (expenses as any[]).reduce(
        (s, e) => s + Number(e.totalAmount ?? e.amount ?? 0),
        0,
      )
    : 0;

  const periodRevPD = totalStops > 0 ? totalRevenue / totalStops : 0;
  const periodCostPD =
    totalStops > 0 && totalExpenses > 0 ? totalExpenses / totalStops : null;
  const profitPD = periodCostPD != null ? periodRevPD - periodCostPD : null;
  const marginPct =
    profitPD != null && periodRevPD > 0 ? (profitPD / periodRevPD) * 100 : null;

  // Delta: current 6 weeks vs prior 6 weeks (revenue/dispatch)
  const mid = Math.floor(gfWeeks.length / 2);
  const calcHalfRevPD = (half: WeekData[]) => {
    const stops = half.reduce((s, w) => s + w.totalstops, 0);
    const rev = half.reduce((s, w) => s + w.totalamt, 0);
    return stops > 0 ? rev / stops : 0;
  };
  const currentHalfRevPD = calcHalfRevPD(gfWeeks.slice(mid));
  const priorHalfRevPD = calcHalfRevPD(gfWeeks.slice(0, mid));
  const revDelta =
    priorHalfRevPD > 0 ? currentHalfRevPD - priorHalfRevPD : null;

  return (
    <div style={{ margin: '18px 32px 0' }}>
      {/* Section title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#1A1A2E',
          marginBottom: 12,
          letterSpacing: 0.1,
        }}
      >
        Dispatch Economics — 12-Week Trend
      </div>

      {/* KPI cards */}
      <div
        style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}
      >
        <KpiCard
          label="Revenue / Dispatch"
          value={loading ? '—' : fmtDisp(periodRevPD)}
          delta={revDelta}
          deltaLabel="vs prior 6 wk"
          subtitle="12-week avg"
        />
        <KpiCard
          label="Cost / Dispatch"
          value={
            loading ? '—' : periodCostPD != null ? fmtDisp(periodCostPD) : 'N/A'
          }
          subtitle={
            periodCostPD != null ? '12-week avg' : 'No expense data matched'
          }
        />
        <KpiCard
          label="Profit / Dispatch"
          value={loading ? '—' : profitPD != null ? fmtDisp(profitPD) : 'N/A'}
          subtitle={
            marginPct != null ? `${marginPct.toFixed(1)}% margin` : undefined
          }
        />
      </div>

      {/* Chart card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e0e6ef',
          borderRadius: 8,
          padding: '18px 20px 16px',
          boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>
            Revenue per Dispatch — Weekly
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <LegendItem color={C.navy} label="Revenue / dispatch" />
            {periodCostPD != null && (
              <LegendItem
                color={C.amber}
                dashed
                label={`Cost / dispatch (avg ${fmtDisp(periodCostPD)})`}
              />
            )}
          </div>
        </div>
        <LineChart
          weeks={gfWeeks}
          costRefLine={periodCostPD}
          loading={gfLoading}
        />
        {!gfLoading && gfWeeks.length > 0 && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: '#9aa5bc',
              textAlign: 'right',
            }}
          >
            {totalStops.toLocaleString()} total dispatches ·{' '}
            {gfWeeks.filter((w) => w.totalstops > 0).length} active weeks
          </div>
        )}
      </div>
    </div>
  );
}
