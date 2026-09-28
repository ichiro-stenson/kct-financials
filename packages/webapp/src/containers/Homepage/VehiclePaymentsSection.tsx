// @ts-nocheck
import React, { useState, useEffect } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://iprxetnntchgsekdbyon.supabase.co';
const SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_KEY ||
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

const TERMINAL_MAP: Record<string, string> = {
  '532': 'Milwaukee',
  '537': 'Madison',
  '585': 'Bismarck',
  '590': 'Billings',
  '658': 'Springfield',
  '824': 'Cody',
  '633': 'North St. Louis',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface TerminalStat {
  domicile: string;
  name: string;
  totalVehicles: number;
  vehiclesWithPayment: number;
  monthlyTotal: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePayment(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function isUnpaid(raw: string): boolean {
  if (!raw || raw.trim() === '') return true;
  const n = parsePayment(raw);
  return n === 0;
}

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtDollarsWithCents(n: number): string {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useVehiclePayments(): { stats: TerminalStat[]; loading: boolean } {
  const [stats, setStats] = useState<TerminalStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${SUPABASE_URL}/rest/v1/fleet_vehicles` +
        `?select=unit_number,payment,domicile,active` +
        `&active=eq.true` +
        `&limit=10000`,
      { headers: supaHeaders },
    )
      .then((r) => r.json())
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) {
          setStats([]);
          return;
        }

        const byDomicile = new Map<
          string,
          { total: number; withPayment: number; monthlyTotal: number }
        >();

        for (const row of rows) {
          const dom = String(row.domicile ?? '');
          const rawPay = String(row.payment ?? '');
          const payment = parsePayment(rawPay);
          const hasPayment = !isUnpaid(rawPay);

          const cur = byDomicile.get(dom) ?? {
            total: 0,
            withPayment: 0,
            monthlyTotal: 0,
          };
          cur.total += 1;
          if (hasPayment) cur.withPayment += 1;
          cur.monthlyTotal += payment;
          byDomicile.set(dom, cur);
        }

        const result: TerminalStat[] = Array.from(byDomicile.entries()).map(
          ([domicile, v]) => ({
            domicile,
            name: TERMINAL_MAP[domicile] ?? `Terminal ${domicile}`,
            totalVehicles: v.total,
            vehiclesWithPayment: v.withPayment,
            monthlyTotal: v.monthlyTotal,
          }),
        );

        result.sort((a, b) => b.monthlyTotal - a.monthlyTotal);
        setStats(result);
      })
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HorizontalBarChart({
  stats,
  loading,
}: {
  stats: TerminalStat[];
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const ROW_H = 34;
  const BAR_H = 20;
  const PAD = { top: 8, right: 90, bottom: 8, left: 116 };
  const W = 500;
  const skeletonRows = 6;
  const n = loading ? skeletonRows : Math.max(stats.length, 1);
  const H = PAD.top + n * ROW_H + PAD.bottom;
  const cW = W - PAD.left - PAD.right;

  if (loading) {
    return (
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        {Array.from({ length: skeletonRows }, (_, i) => {
          const y = PAD.top + i * ROW_H + (ROW_H - BAR_H) / 2;
          const bw = cW * Math.max(0.8 - i * 0.1, 0.15);
          return (
            <g key={i}>
              <rect
                x={PAD.left - 110}
                y={y + 3}
                width={104}
                height={14}
                rx={2}
                fill="#e0e6ef"
                opacity={0.5}
              />
              <rect
                x={PAD.left}
                y={y}
                width={bw}
                height={BAR_H}
                rx={3}
                fill="#e0e6ef"
                opacity={Math.max(0.55 - i * 0.06, 0.15)}
              />
            </g>
          );
        })}
      </svg>
    );
  }

  if (!stats.length) return null;

  const maxVal = Math.max(...stats.map((s) => s.monthlyTotal), 0.01);

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      {stats.map((s, i) => {
        const rowY = PAD.top + i * ROW_H;
        const barY = rowY + (ROW_H - BAR_H) / 2;
        const barW = Math.max(
          maxVal > 0 ? (s.monthlyTotal / maxVal) * cW : 0,
          s.monthlyTotal > 0 ? 4 : 0,
        );
        const isHov = hovered === i;
        const tooltipX = Math.min(
          Math.max(PAD.left + barW / 2, PAD.left + 46),
          PAD.left + cW - 46,
        );

        return (
          <g
            key={s.domicile}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            {/* Terminal name */}
            <text
              x={PAD.left - 8}
              y={barY + BAR_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill={C.text}
              fontWeight={500}
            >
              {s.name}
            </text>

            {/* Background track */}
            <rect
              x={PAD.left}
              y={barY}
              width={cW}
              height={BAR_H}
              rx={3}
              fill="#f4f6fb"
            />

            {/* Amber bar */}
            <rect
              x={PAD.left}
              y={barY}
              width={barW}
              height={BAR_H}
              rx={3}
              fill={C.amber}
              opacity={isHov ? 1 : 0.85}
              style={{ transition: 'opacity 0.12s' }}
            />

            {/* Dollar label to the right */}
            <text
              x={PAD.left + cW + 8}
              y={barY + BAR_H / 2 + 4}
              fontSize={11}
              fill={C.text}
              fontWeight={600}
            >
              {fmtDollars(s.monthlyTotal)}
            </text>

            {/* Hover tooltip */}
            {isHov && s.monthlyTotal > 0 && (
              <g>
                <rect
                  x={tooltipX - 46}
                  y={barY - 22}
                  width={92}
                  height={16}
                  rx={3}
                  fill="#1A1A2E"
                  opacity={0.88}
                />
                <text
                  x={tooltipX}
                  y={barY - 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#fff"
                  fontWeight={600}
                >
                  {fmtDollarsWithCents(s.monthlyTotal)}
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.label,
          marginBottom: 5,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: C.text,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '4px 0',
      }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          style={{
            height: 20,
            borderRadius: 3,
            background: '#e0e6ef',
            opacity: Math.max(0.5 - i * 0.05, 0.1),
          }}
        />
      ))}
    </div>
  );
}

// ─── VehiclePaymentsSection ───────────────────────────────────────────────────

export function VehiclePaymentsSection() {
  const { stats, loading } = useVehiclePayments();

  const totalMonthly = stats.reduce((s, t) => s + t.monthlyTotal, 0);
  const totalVehicles = stats.reduce((s, t) => s + t.totalVehicles, 0);
  const vehiclesWithPayment = stats.reduce(
    (s, t) => s + t.vehiclesWithPayment,
    0,
  );
  const avgPayment =
    vehiclesWithPayment > 0 ? totalMonthly / vehiclesWithPayment : 0;

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
        Vehicle Payments
      </div>

      {/* Charts row */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Left: horizontal bar chart */}
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
              fontWeight: 600,
              fontSize: 13,
              color: C.text,
              marginBottom: 14,
            }}
          >
            Monthly Payments by Terminal
          </div>
          <HorizontalBarChart stats={stats} loading={loading} />
        </div>

        {/* Right: KPI summary cards */}
        <div
          style={{
            flex: '1 1 160px',
            minWidth: 160,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <KpiCard
            label="Total Monthly"
            value={loading ? '—' : fmtDollarsWithCents(totalMonthly)}
          />
          <KpiCard
            label="Annual Total"
            value={loading ? '—' : fmtDollars(totalMonthly * 12)}
          />
          <KpiCard
            label="Active Vehicles"
            value={loading ? '—' : String(totalVehicles)}
          />
          <KpiCard
            label="Avg Payment"
            value={loading ? '—' : fmtDollarsWithCents(avgPayment)}
          />
        </div>
      </div>

      {/* Below: terminal breakdown table */}
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '18px 20px 16px',
          marginTop: 16,
          boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <TableSkeleton />
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                {[
                  'Terminal',
                  'Vehicles',
                  'With Payment',
                  'Monthly Total',
                  'Annual Total',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Terminal' ? 'left' : 'right',
                      padding: '6px 10px',
                      color: C.label,
                      fontWeight: 600,
                      fontSize: 11,
                      borderBottom: `1px solid ${C.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((t, i) => (
                <tr
                  key={t.domicile}
                  style={{ background: i % 2 === 0 ? '#f9fafc' : C.bg }}
                >
                  <td
                    style={{
                      padding: '7px 10px',
                      color: C.text,
                      fontWeight: 500,
                    }}
                  >
                    {t.name}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      color: C.text,
                    }}
                  >
                    {t.totalVehicles}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      color: C.text,
                    }}
                  >
                    {t.vehiclesWithPayment}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      color: C.text,
                      fontWeight: 500,
                    }}
                  >
                    {fmtDollarsWithCents(t.monthlyTotal)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      color: C.text,
                      fontWeight: 500,
                    }}
                  >
                    {fmtDollarsWithCents(t.monthlyTotal * 12)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}` }}>
                <td
                  style={{
                    padding: '8px 10px',
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  {totalVehicles}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  {vehiclesWithPayment}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  {fmtDollarsWithCents(totalMonthly)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  {fmtDollarsWithCents(totalMonthly * 12)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
