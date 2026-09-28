// @ts-nocheck
import React, { useState, useEffect } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://iprxetnntchgsekdbyon.supabase.co';
const SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  '';
const supaHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const C = {
  navy: '#1B3A6B',
  amber: '#E8A020',
  green: '#27ae60',
  red: '#e74c3c',
  axis: '#d0d7e3',
  label: '#6b7a99',
  muted: '#9aa5bc',
  bg: '#fff',
  border: '#e0e6ef',
  text: '#1A1A2E',
};

const TERMINALS = [
  { id: 'all', label: 'All Terminals' },
  { id: '532', label: '532 Milwaukee' },
  { id: '537', label: '537 Madison' },
  { id: '585', label: '585 Bismarck' },
  { id: '590', label: '590 Billings' },
  { id: '658', label: '658 Springfield' },
  { id: '824', label: '824 Cody' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekPoint {
  weekIso: string;
  label: string;
  totalamt: number;
  totalstops: number;
  revPerDispatch: number;
}

interface AllWeekRow {
  csa: string;
  date: string;
  totalamt: number | null;
  totalstops: number | null;
  primary_terminal: string | null;
}

interface DriverRow {
  csa: string;
  date: string;
  drivername: string;
  dlstops: number;
  ecommstops: number;
  pustops: number;
  primary_terminal: string;
}

interface BarPoint {
  label: string;
  value: number;
}

type Period = 'weekly' | 'monthly' | 'yearly';

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

function fmtWeekLabel(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function fmtDisp(n: number): string {
  return `$${n.toFixed(2)}`;
}

function stripTerminal(s: string): string {
  return s ? String(Number(s)) : '';
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useWeeklyTotals16(): { data: WeekPoint[]; loading: boolean } {
  const [data, setData] = useState<WeekPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const thisMonday = getMondayOf(new Date());
    const weeks = Array.from({ length: 16 }, (_, i) =>
      addDays(thisMonday, -(15 - i) * 7),
    );
    const fromIso = isoDate(weeks[0]);
    const toIso = isoDate(addDays(weeks[15], 6));

    fetch(
      `${SUPABASE_URL}/rest/v1/gf_statement_weekly_totals` +
        `?select=date,totalamt,totalstops` +
        `&date=gte.${fromIso}T00:00:00` +
        `&date=lte.${toIso}T23:59:59` +
        `&limit=10000`,
      { headers: supaHeaders },
    )
      .then((r) => r.json())
      .then((rows: any[]) => {
        const byWeek = new Map<string, { amt: number; stops: number }>();
        for (const w of weeks) byWeek.set(isoDate(w), { amt: 0, stops: 0 });

        for (const row of rows || []) {
          const rowDate = (row.date ?? '').split('T')[0];
          let key = rowDate;
          if (!byWeek.has(key)) {
            key = isoDate(getMondayOf(new Date(rowDate + 'T12:00:00')));
          }
          if (byWeek.has(key)) {
            const cur = byWeek.get(key)!;
            cur.amt += Number(row.totalamt ?? 0);
            cur.stops += Number(row.totalstops ?? 0);
          }
        }

        const result: WeekPoint[] = [];
        for (const [weekIso, v] of byWeek.entries()) {
          result.push({
            weekIso,
            label: fmtWeekLabel(weekIso),
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

function useAllWeeklyTotals(): { rows: AllWeekRow[]; loading: boolean } {
  const [rows, setRows] = useState<AllWeekRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${SUPABASE_URL}/rest/v1/gf_statement_weekly_totals` +
        `?select=csa,date,totalamt,totalstops,primary_terminal&limit=50000`,
      { headers: supaHeaders },
    )
      .then((r) => r.json())
      .then((data: any[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return { rows, loading };
}

function useDriverRows(weekIso: string): {
  rows: DriverRow[];
  loading: boolean;
} {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!weekIso) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(
      `${SUPABASE_URL}/rest/v1/gf_statement_drivers` +
        `?select=csa,date,drivername,dlstops,ecommstops,pustops,primary_terminal` +
        `&date=gte.${weekIso}T00:00:00` +
        `&date=lte.${weekIso}T23:59:59` +
        `&limit=5000`,
      { headers: supaHeaders },
    )
      .then((r) => r.json())
      .then((data: any[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [weekIso]);

  return { rows, loading };
}

// ─── Monthly / Yearly aggregation ─────────────────────────────────────────────

function aggregateMonthly(rows: AllWeekRow[]): BarPoint[] {
  const now = new Date();
  const months: { key: string; label: string; amt: number; stops: number }[] =
    [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
    months.push({ key, label, amt: 0, stops: 0 });
  }
  for (const row of rows) {
    const d = (row.date ?? '').split('T')[0];
    if (!d) continue;
    const [y, m] = d.split('-');
    const key = `${y}-${m}`;
    const pt = months.find((p) => p.key === key);
    if (pt) {
      pt.amt += Number(row.totalamt ?? 0);
      pt.stops += Number(row.totalstops ?? 0);
    }
  }
  return months.map((m) => ({
    label: m.label,
    value: m.stops > 0 ? m.amt / m.stops : 0,
  }));
}

function aggregateYearly(rows: AllWeekRow[]): BarPoint[] {
  const yearMap = new Map<number, { amt: number; stops: number }>();
  for (const row of rows) {
    const d = (row.date ?? '').split('T')[0];
    if (!d) continue;
    const y = Number(d.split('-')[0]);
    if (!y || y < 2020) continue;
    const cur = yearMap.get(y) ?? { amt: 0, stops: 0 };
    cur.amt += Number(row.totalamt ?? 0);
    cur.stops += Number(row.totalstops ?? 0);
    yearMap.set(y, cur);
  }
  return Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([y, v]) => ({
      label: String(y),
      value: v.stops > 0 ? v.amt / v.stops : 0,
    }));
}

// ─── Period Toggle ────────────────────────────────────────────────────────────

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const options: { key: Period; label: string }[] = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: 'hidden',
        fontSize: 11,
      }}
    >
      {options.map((o, idx) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: '4px 11px',
            border: 'none',
            borderRight:
              idx < options.length - 1 ? `1px solid ${C.border}` : 'none',
            cursor: 'pointer',
            background: value === o.key ? C.navy : '#f4f6fb',
            color: value === o.key ? '#fff' : C.label,
            fontWeight: value === o.key ? 600 : 400,
            transition: 'background 0.12s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── SVG Bar Chart (single-series, navy) ──────────────────────────────────────

function SingleBarChart({
  points,
  loading,
}: {
  points: BarPoint[];
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 480,
    H = 160;
  const PAD = { top: 14, right: 12, bottom: 32, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = Math.max(points.length, 1);
  const groupW = cW / n;
  const barW = Math.max(4, groupW * 0.55);
  const maxVal = Math.max(...points.map((p) => p.value), 0.01);
  const yTicks = [0, 0.5, 1];

  if (loading) {
    return (
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        {Array.from({ length: 8 }, (_, i) => {
          const x = PAD.left + (i / 8) * cW + cW / 16 - barW / 2;
          const h = cH * (0.3 + 0.45 * ((i % 3) / 2));
          return (
            <rect
              key={i}
              x={x}
              y={PAD.top + cH - h}
              width={barW}
              height={h}
              rx={2}
              fill="#e0e6ef"
              opacity={0.55}
            />
          );
        })}
      </svg>
    );
  }

  if (!points.length) return null;

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      {/* Grid lines + Y-axis labels */}
      {yTicks.map((t) => {
        const y = PAD.top + cH * (1 - t);
        return (
          <g key={t}>
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
              {fmtDisp(maxVal * t)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {points.map((pt, i) => {
        const cx = PAD.left + i * groupW + groupW / 2;
        const barH = maxVal > 0 ? (pt.value / maxVal) * cH : 0;
        const barY = PAD.top + cH - Math.max(barH, 0);
        const isHov = hovered === i;
        const stride = Math.max(1, Math.ceil(n / 12));
        const showLabel = i % stride === 0;

        return (
          <g key={i}>
            <rect
              x={cx - barW / 2}
              y={barY}
              width={barW}
              height={Math.max(barH, 0)}
              rx={2}
              fill={pt.value > 0 ? C.navy : '#e0e6ef'}
              opacity={pt.value > 0 ? (isHov ? 1 : 0.88) : 0.3}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
            {showLabel && (
              <text
                x={cx}
                y={H - 5}
                textAnchor="middle"
                fontSize={8}
                fill={C.label}
              >
                {pt.label}
              </text>
            )}
            {isHov && pt.value > 0 && (
              <g>
                <rect
                  x={Math.min(Math.max(cx - 26, PAD.left), W - PAD.right - 52)}
                  y={barY - 22}
                  width={52}
                  height={16}
                  rx={3}
                  fill="#1A1A2E"
                  opacity={0.88}
                />
                <text
                  x={Math.min(Math.max(cx, PAD.left + 26), W - PAD.right - 26)}
                  y={barY - 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#fff"
                  fontWeight={600}
                >
                  {fmtDisp(pt.value)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
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
  const hasDelta = delta != null && !isNaN(delta);
  const isPos = (delta ?? 0) >= 0;
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '16px 18px',
        boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.label,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: C.text,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
      {hasDelta && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: isPos ? C.green : C.red,
            fontWeight: 600,
          }}
        >
          {isPos ? '▲' : '▼'} {fmtDisp(Math.abs(delta!))}{' '}
          {deltaLabel ?? 'vs prior period'}
        </div>
      )}
    </div>
  );
}

// ─── Chart A: Revenue per Dispatch (multi-period) ─────────────────────────────

function RevenuePerDispatchChart({
  weekPoints,
  allRows,
  weekLoading,
  allLoading,
}: {
  weekPoints: WeekPoint[];
  allRows: AllWeekRow[];
  weekLoading: boolean;
  allLoading: boolean;
}) {
  const [period, setPeriod] = useState<Period>('weekly');

  const loading = period === 'weekly' ? weekLoading : allLoading;

  const points: BarPoint[] = (() => {
    if (period === 'weekly')
      return weekPoints.map((w) => ({
        label: w.label,
        value: w.revPerDispatch,
      }));
    if (period === 'monthly') return aggregateMonthly(allRows);
    return aggregateYearly(allRows);
  })();

  // KPI: recent half vs prior half
  const { currentAvg, delta } = (() => {
    const active = points.filter((p) => p.value > 0);
    if (!active.length) return { currentAvg: 0, delta: null };
    const half = Math.max(1, Math.floor(active.length / 2));
    const curHalf = active.slice(-half);
    const priHalf = active.slice(0, active.length - half);
    const avg = (arr: BarPoint[]) =>
      arr.length ? arr.reduce((s, p) => s + p.value, 0) / arr.length : 0;
    const curAvg = avg(curHalf);
    const priAvg = avg(priHalf);
    return {
      currentAvg: curAvg,
      delta: priAvg > 0 ? curAvg - priAvg : null,
    };
  })();

  const kpiLabel =
    period === 'weekly'
      ? 'Recent 8-wk avg'
      : period === 'monthly'
        ? 'Recent 6-mo avg'
        : 'Recent period avg';

  const deltaLabel = period === 'yearly' ? 'vs prior period' : 'vs prior half';

  const footerNote =
    period === 'weekly'
      ? 'Last 16 weeks'
      : period === 'monthly'
        ? 'Last 12 months'
        : 'All available years';

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      {/* Chart card */}
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '18px 20px 16px',
          flex: '2 1 360px',
          minWidth: 0,
          boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
            Revenue per Dispatch
          </div>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
        <SingleBarChart points={points} loading={loading} />
        {!loading && points.length > 0 && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: C.muted,
              textAlign: 'right',
            }}
          >
            {footerNote} · Y-axis: $/dispatch
          </div>
        )}
      </div>

      {/* KPI card */}
      <div style={{ flex: '1 1 160px', minWidth: 160 }}>
        <KpiCard
          label={kpiLabel}
          value={loading ? '—' : currentAvg > 0 ? fmtDisp(currentAvg) : 'N/A'}
          delta={delta}
          deltaLabel={deltaLabel}
          subtitle="Revenue / dispatch"
        />
      </div>
    </div>
  );
}

// ─── Chart B: Driver Revenue Leaderboard ─────────────────────────────────────

function DriverRevenueLeaderboard({
  weekIso,
  terminalFilter,
  weeklyRows,
  driverRows,
  loading,
}: {
  weekIso: string;
  terminalFilter: string;
  weeklyRows: AllWeekRow[];
  driverRows: DriverRow[];
  loading: boolean;
}) {
  // Build CSA → revenue-per-stop map for the selected week
  const csaRPS = new Map<string, number>();
  for (const row of weeklyRows) {
    const d = (row.date ?? '').split('T')[0];
    if (d !== weekIso) continue;
    const stops = Number(row.totalstops ?? 0);
    const amt = Number(row.totalamt ?? 0);
    if (stops > 0 && amt > 0) csaRPS.set(String(row.csa), amt / stops);
  }

  // Aggregate per-driver across CSA rows
  const driverMap = new Map<
    string,
    { stops: number; rev: number; terminal: string }
  >();
  for (const r of driverRows) {
    const t = stripTerminal(r.primary_terminal ?? '');
    if (terminalFilter !== 'all' && t !== terminalFilter) continue;
    const rps = csaRPS.get(String(r.csa)) ?? 0;
    const stops =
      Number(r.dlstops ?? 0) +
      Number(r.ecommstops ?? 0) +
      Number(r.pustops ?? 0);
    const rev = stops * rps;
    const name = r.drivername ?? 'Unknown';
    const cur = driverMap.get(name) ?? { stops: 0, rev: 0, terminal: t };
    cur.stops += stops;
    cur.rev += rev;
    driverMap.set(name, cur);
  }

  const sorted = Array.from(driverMap.entries())
    .map(([name, v]) => ({ name, stops: v.stops, rev: v.rev }))
    .sort((a, b) => b.rev - a.rev);

  const totalDrivers = sorted.length;
  const top15 = sorted.slice(0, 15);
  const maxRev = top15.length > 0 ? top15[0].rev : 1;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          padding: '8px 0',
        }}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div style={{ width: 18, flexShrink: 0 }} />
            <div
              style={{
                width: 120,
                height: 28,
                borderRadius: 3,
                background: '#e0e6ef',
                opacity: Math.max(0.55 - i * 0.04, 0.1),
                flexShrink: 0,
              }}
            />
            <div
              style={{
                flex: 1,
                height: 20,
                borderRadius: 3,
                background: '#e0e6ef',
                opacity: Math.max(0.65 - i * 0.05, 0.1),
                maxWidth: `${88 - i * 7}%`,
              }}
            />
            <div
              style={{
                width: 60,
                height: 14,
                borderRadius: 3,
                background: '#e0e6ef',
                opacity: 0.4,
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!top15.length) {
    return (
      <div
        style={{
          color: C.muted,
          fontSize: 13,
          textAlign: 'center',
          padding: '28px 0',
        }}
      >
        No driver data
        {weekIso ? ` for week of ${fmtWeekLabel(weekIso)}` : ''}
        {terminalFilter !== 'all' ? ` · terminal ${terminalFilter}` : ''}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top15.map((d, i) => {
          const pct = maxRev > 0 ? (d.rev / maxRev) * 100 : 0;
          return (
            <div
              key={`${d.name}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 18,
                  fontSize: 10,
                  color: C.muted,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>

              {/* Driver name + stop count */}
              <div style={{ width: 148, flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: C.text,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.name}
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>
                  {d.stops} stops
                </div>
              </div>

              {/* Bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: 20,
                    background: C.amber,
                    borderRadius: 3,
                    width: `${pct}%`,
                    opacity: 0.82,
                    minWidth: d.rev > 0 ? 4 : 0,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>

              {/* Revenue value */}
              <div
                style={{
                  width: 74,
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text,
                  flexShrink: 0,
                }}
              >
                {d.rev > 0 ? `$${d.rev.toFixed(0)}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
      {totalDrivers > 15 && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: C.muted,
            textAlign: 'right',
          }}
        >
          Showing top 15 of {totalDrivers} drivers
        </div>
      )}
    </div>
  );
}

// ─── RevenuePerRouteSection ───────────────────────────────────────────────────

export function RevenuePerRouteSection() {
  // Fetch data at the section level to avoid duplicate network calls
  const { data: weekPoints, loading: weekLoading } = useWeeklyTotals16();
  const { rows: allWeeklyRows, loading: allLoading } = useAllWeeklyTotals();

  // Derive sorted list of available week ISO dates from all-weekly data
  const availableWeeks: string[] = (() => {
    const seen = new Set<string>();
    for (const row of allWeeklyRows) {
      const iso = (row.date ?? '').split('T')[0];
      if (iso) seen.add(iso);
    }
    return Array.from(seen).sort().reverse();
  })();

  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [terminalFilter, setTerminalFilter] = useState<string>('all');

  const weekIso = selectedWeek || availableWeeks[0] || '';
  const { rows: driverRows, loading: driverLoading } = useDriverRows(weekIso);

  const weekSelectLabel = (iso: string) =>
    iso ? `Week of ${fmtWeekLabel(iso)}` : '—';

  return (
    <div style={{ margin: '18px 32px 0' }}>
      {/* Section title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.text,
          marginBottom: 16,
          letterSpacing: 0.1,
        }}
      >
        Revenue per Route
      </div>

      {/* Chart A — Revenue per Dispatch */}
      <RevenuePerDispatchChart
        weekPoints={weekPoints}
        allRows={allWeeklyRows}
        weekLoading={weekLoading}
        allLoading={allLoading}
      />

      {/* Chart B — Driver Leaderboard */}
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '18px 20px 16px',
          marginTop: 16,
          boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
            Revenue per Driver
            {weekIso && (
              <span style={{ fontWeight: 400, color: C.label, marginLeft: 6 }}>
                — {weekSelectLabel(weekIso)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Terminal filter */}
            <select
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              style={{
                fontSize: 11,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '4px 8px',
                color: C.label,
                background: '#f4f6fb',
                cursor: 'pointer',
              }}
            >
              {TERMINALS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Week selector */}
            <select
              value={weekIso}
              onChange={(e) => setSelectedWeek(e.target.value)}
              disabled={allLoading || availableWeeks.length === 0}
              style={{
                fontSize: 11,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '4px 8px',
                color: C.label,
                background: '#f4f6fb',
                cursor: 'pointer',
              }}
            >
              {availableWeeks.length === 0 && (
                <option value="">Loading weeks…</option>
              )}
              {availableWeeks.map((iso) => (
                <option key={iso} value={iso}>
                  {weekSelectLabel(iso)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DriverRevenueLeaderboard
          weekIso={weekIso}
          terminalFilter={terminalFilter}
          weeklyRows={allWeeklyRows}
          driverRows={driverRows}
          loading={driverLoading || allLoading}
        />
      </div>
    </div>
  );
}
