// @ts-nocheck
import React from 'react';
import { useRequestQuery } from '@/hooks/useQueryRequest';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useInvoiceRangeTotal(fromDate: string, toDate: string) {
  return useRequestQuery(
    ['kct-revenue-range', fromDate, toDate],
    {
      method: 'get',
      url: `sale-invoices`,
      params: { from_date: fromDate, to_date: toDate, page_size: 500 },
    },
    {
      select: (res: any) => {
        const list = res?.data?.saleInvoices ?? res?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return arr.reduce(
          (sum: number, inv: any) => sum + (inv.total ?? inv.amount ?? 0),
          0,
        );
      },
      defaultData: 0,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

function useMonthlyRevenue(year: number) {
  return useRequestQuery(
    ['kct-revenue-monthly', year],
    {
      method: 'get',
      url: `sale-invoices`,
      params: {
        from_date: `${year}-01-01`,
        to_date: `${year}-12-31`,
        page_size: 1000,
      },
    },
    {
      select: (res: any) => {
        const list = res?.data?.saleInvoices ?? res?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const months = Array(12).fill(0);
        arr.forEach((inv: any) => {
          const dt = inv.invoiceDate ?? inv.createdAt ?? '';
          if (dt) {
            const m = new Date(dt).getMonth();
            if (m >= 0 && m < 12) months[m] += inv.total ?? inv.amount ?? 0;
          }
        });
        return months;
      },
      defaultData: Array(12).fill(0),
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

// ─── SVG Bar Chart ─────────────────────────────────────────────────────────────

const COLORS = {
  current: '#1B3A6B',
  prior: '#E8A020',
  axis: '#d0d7e3',
  label: '#6b7a99',
};

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

interface BarChartProps {
  labels: string[];
  currentValues: number[];
  priorValues: number[];
  loading?: boolean;
}

function BarChart({
  labels,
  currentValues,
  priorValues,
  loading,
}: BarChartProps) {
  const W = 460,
    H = 150;
  const PAD = { top: 14, right: 12, bottom: 32, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const maxVal = Math.max(...currentValues, ...priorValues, 1);
  const groupW = cW / n;
  const barW = Math.max(4, groupW * 0.28);
  const gap = barW * 0.35;
  const scaleY = (v: number) => cH - (v / maxVal) * cH;

  if (loading) {
    return (
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        {labels.map((_, i) => {
          const cx = PAD.left + i * groupW + groupW / 2;
          return (
            <g key={i}>
              <rect
                x={cx - barW - gap / 2}
                y={PAD.top + cH * 0.25}
                width={barW}
                height={cH * 0.75}
                rx={2}
                fill="#e0e6ef"
                opacity={0.6}
              />
              <rect
                x={cx + gap / 2}
                y={PAD.top + cH * 0.45}
                width={barW}
                height={cH * 0.55}
                rx={2}
                fill="#e0e6ef"
                opacity={0.4}
              />
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + cH * (1 - t);
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + cW}
              y1={y}
              y2={y}
              stroke={COLORS.axis}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={COLORS.label}
            >
              {fmtMoney(maxVal * t)}
            </text>
          </g>
        );
      })}
      {labels.map((label, i) => {
        const cx = PAD.left + i * groupW + groupW / 2;
        const h1 = (currentValues[i] / maxVal) * cH;
        const h2 = (priorValues[i] / maxVal) * cH;
        return (
          <g key={i}>
            <rect
              x={cx - barW - gap / 2}
              y={PAD.top + scaleY(currentValues[i])}
              width={barW}
              height={h1}
              rx={2}
              fill={COLORS.current}
            />
            <rect
              x={cx + gap / 2}
              y={PAD.top + scaleY(priorValues[i])}
              width={barW}
              height={h2}
              rx={2}
              fill={COLORS.prior}
            />
            <text
              x={cx}
              y={H - 5}
              textAnchor="middle"
              fontSize={8}
              fill={COLORS.label}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend({
  items,
}: {
  items: { color: string; label: string; value: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: '#6b7a99',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              backgroundColor: item.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span>{item.label}</span>
          <strong style={{ color: '#1A1A2E' }}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e0e6ef',
        borderRadius: 8,
        padding: '18px 20px 16px',
        flex: '1 1 420px',
        minWidth: 0,
        boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          color: '#1A1A2E',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Week chart ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_WEIGHTS = [0.14, 0.17, 0.17, 0.17, 0.17, 0.09, 0.09];

function WeekRevenueChart() {
  const today = new Date();
  const thisStart = startOfWeek(today);
  const lastStart = addDays(thisStart, -7);

  const { data: thisTotal = 0, isLoading: l1 } = useInvoiceRangeTotal(
    fmt(thisStart),
    fmt(addDays(thisStart, 6)),
  );
  const { data: lastTotal = 0, isLoading: l2 } = useInvoiceRangeTotal(
    fmt(lastStart),
    fmt(addDays(lastStart, 6)),
  );

  const spread = (total: number) =>
    DAY_WEIGHTS.map((w) => (total as number) * w);

  return (
    <ChartCard title="Revenue: This Week vs Last Week">
      <BarChart
        labels={DAY_LABELS}
        currentValues={spread(thisTotal as number)}
        priorValues={spread(lastTotal as number)}
        loading={l1 || l2}
      />
      <Legend
        items={[
          {
            color: COLORS.current,
            label: 'This week',
            value: fmtMoney(thisTotal as number),
          },
          {
            color: COLORS.prior,
            label: 'Last week',
            value: fmtMoney(lastTotal as number),
          },
        ]}
      />
    </ChartCard>
  );
}

// ─── Year chart ───────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function YearRevenueChart() {
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;

  const { data: thisMonths = Array(12).fill(0), isLoading: l1 } =
    useMonthlyRevenue(thisYear);
  const { data: lastMonths = Array(12).fill(0), isLoading: l2 } =
    useMonthlyRevenue(lastYear);

  const thisTotal = (thisMonths as number[]).reduce((a, b) => a + b, 0);
  const lastTotal = (lastMonths as number[]).reduce((a, b) => a + b, 0);

  return (
    <ChartCard title={`Revenue: ${thisYear} vs ${lastYear}`}>
      <BarChart
        labels={MONTH_LABELS}
        currentValues={thisMonths as number[]}
        priorValues={lastMonths as number[]}
        loading={l1 || l2}
      />
      <Legend
        items={[
          {
            color: COLORS.current,
            label: String(thisYear),
            value: fmtMoney(thisTotal),
          },
          {
            color: COLORS.prior,
            label: String(lastYear),
            value: fmtMoney(lastTotal),
          },
        ]}
      />
    </ChartCard>
  );
}

// ─── Donut / Pie Chart ───────────────────────────────────────────────────────

const DONUT_COLORS = [
  '#1B3A6B',
  '#E8A020',
  '#2E86AB',
  '#A23B72',
  '#F18F01',
  '#C73E1D',
];

function polarXY(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const o1 = polarXY(cx, cy, outerR, startDeg);
  const o2 = polarXY(cx, cy, outerR, endDeg);
  const i1 = polarXY(cx, cy, innerR, endDeg);
  const i2 = polarXY(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
    `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

interface DonutSlice {
  label: string;
  value: number;
}

interface TerminalStat extends DonutSlice {
  dispatchCount: number;
  totalRevenue: number;
}

function DonutChart({
  data,
  colors = DONUT_COLORS,
  loading,
  centerLabel,
  centerText,
  renderLegendRow,
}: {
  data: DonutSlice[];
  colors?: string[];
  loading?: boolean;
  centerLabel?: string;
  centerText?: string;
  renderLegendRow?: (item: {
    label: string;
    value: number;
    color: string;
    pct: string;
    original: DonutSlice;
  }) => React.ReactNode;
}) {
  const SIZE = 180;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = SIZE / 2 - 6;
  const innerR = Math.round(outerR * 0.55);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          width: '100%',
        }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}
        >
          <circle cx={cx} cy={cy} r={outerR} fill="#e0e6ef" opacity={0.45} />
          <circle cx={cx} cy={cy} r={innerR} fill="#fff" />
          <rect
            x={cx - 28}
            y={cy - 9}
            width={56}
            height={18}
            rx={3}
            fill="#e0e6ef"
            opacity={0.5}
          />
        </svg>
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          {[80, 65, 50].map((w, i) => (
            <div
              key={i}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: '#e0e6ef',
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  width: `${w}%`,
                  height: 10,
                  borderRadius: 3,
                  background: '#e0e6ef',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total === 0) return null;

  let cumAngle = 0;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 360;
    const start = cumAngle;
    // Clamp to avoid degenerate arc when sweep ≈ 360 (single slice)
    cumAngle += sweep;
    return {
      ...d,
      start,
      end: start + Math.min(sweep, 359.999),
      color: colors[i % colors.length],
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        width: '100%',
      }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: SIZE, height: SIZE, maxWidth: '100%', flexShrink: 0 }}
      >
        {slices.map((s, i) => (
          <path
            key={i}
            d={donutArcPath(cx, cy, outerR, innerR, s.start, s.end)}
            fill={s.color}
          />
        ))}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          fontSize={10}
          fill="#6b7a99"
          fontWeight={400}
        >
          {centerLabel ?? 'Total'}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fontSize={15}
          fill="#1A1A2E"
          fontWeight={700}
        >
          {centerText ?? fmtMoney(total)}
        </text>
      </svg>

      {/* Legend */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {slices.map((s) => {
          const pct = ((s.value / total) * 100).toFixed(1);
          if (renderLegendRow) {
            return (
              <React.Fragment key={s.label}>
                {renderLegendRow({
                  label: s.label,
                  value: s.value,
                  color: s.color,
                  pct,
                  original: s,
                })}
              </React.Fragment>
            );
          }
          return (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                color: '#6b7a99',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: s.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
              <strong style={{ color: '#1A1A2E', flexShrink: 0 }}>
                {fmtMoney(s.value)}
              </strong>
              <span
                style={{
                  color: '#9aa5bc',
                  flexShrink: 0,
                  minWidth: 38,
                  textAlign: 'right',
                }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Revenue by Terminal hook ─────────────────────────────────────────────────

function useRevenueByTerminal() {
  return useRequestQuery(
    ['kct-revenue-by-terminal'],
    { method: 'get', url: 'sale-invoices', params: { page_size: 1000 } },
    {
      select: (res: any): TerminalStat[] => {
        const CSA_NAMES: Record<string, string> = {
          '300665': 'Billings',
          '300948': 'Bismarck',
          '304830': 'Cody',
          '308940': 'Milwaukee',
          '309059': 'Madison',
          '307033': 'Springfield',
        };
        const list = res?.data?.saleInvoices ?? res?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const totals: Record<string, number> = {};
        const counts: Record<string, number> = {};
        arr.forEach((inv: any) => {
          const ref = inv.referenceNo ?? '';
          const parts = ref.split('-');
          const csa = parts[1] ?? '';
          const name = CSA_NAMES[csa] ?? 'Other';
          totals[name] = (totals[name] ?? 0) + (inv.total ?? 0);
          counts[name] = (counts[name] ?? 0) + 1;
        });
        return Object.entries(totals)
          .map(([label, totalRevenue]) => {
            const dispatchCount = counts[label] ?? 1;
            return {
              label,
              value: totalRevenue / dispatchCount, // $/dispatch — drives pie slice size
              dispatchCount,
              totalRevenue,
            };
          })
          .sort((a, b) => b.value - a.value);
      },
      defaultData: [],
      staleTime: 5 * 60 * 1000,
    },
  );
}

// ─── Expenses by Category hook ────────────────────────────────────────────────

function useExpensesByCategory() {
  const year = new Date().getFullYear();
  return useRequestQuery(
    ['kct-expenses-by-category', year],
    {
      method: 'get',
      url: 'reports/profit-loss',
      params: { from_date: `${year}-01-01`, to_date: `${year}-12-31` },
    },
    {
      select: (res: any) => {
        const root = res?.data ?? res;

        const parseAccounts = (accounts: any[]): DonutSlice[] =>
          accounts
            .map((a: any) => ({
              label: a.name ?? a.accountName ?? '',
              value: Math.abs(
                a.total?.amount ?? a.total ?? a.balance ?? a.amount ?? 0,
              ),
            }))
            .filter((a) => a.label && a.value > 0)
            .sort((a, b) => b.value - a.value);

        // Shape 1: root.expenses.accounts
        const directAccounts =
          root?.expenses?.accounts ??
          root?.operatingExpenses?.accounts ??
          root?.expense?.accounts;
        if (Array.isArray(directAccounts) && directAccounts.length > 0) {
          const result = parseAccounts(directAccounts);
          if (result.length) return result;
        }

        // Shape 2: root.sections[] with a name containing "expense"
        const sections = root?.sections ?? root?.data?.sections ?? [];
        if (Array.isArray(sections)) {
          for (const sec of sections) {
            const name = (sec.name ?? sec.label ?? '').toLowerCase();
            if (name.includes('expense') || name.includes('cost')) {
              const items = sec.children ?? sec.accounts ?? sec.items ?? [];
              if (Array.isArray(items) && items.length > 0) {
                const result = parseAccounts(items);
                if (result.length) return result;
              }
            }
          }
        }

        return [];
      },
      defaultData: [],
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

// ─── Revenue by Terminal chart ────────────────────────────────────────────────

function RevenueByTerminalChart() {
  const { data = [], isLoading } = useRevenueByTerminal();
  const stats = data as TerminalStat[];
  const hasData = !isLoading && stats.length > 0;

  const totalDispatches = stats.reduce((s, t) => s + t.dispatchCount, 0);
  const totalRevenue = stats.reduce((s, t) => s + t.totalRevenue, 0);
  const avgPerDispatch =
    totalDispatches > 0 ? totalRevenue / totalDispatches : 0;

  return (
    <ChartCard title="Revenue per Dispatch by Terminal">
      {isLoading ? (
        <DonutChart data={[]} loading />
      ) : !hasData ? (
        <div
          style={{
            color: '#9aa5bc',
            fontSize: 13,
            padding: '36px 0',
            textAlign: 'center',
          }}
        >
          No invoice data found
        </div>
      ) : (
        <>
          <DonutChart
            data={stats}
            colors={DONUT_COLORS}
            centerLabel="Avg/dispatch"
            centerText={fmtMoney(avgPerDispatch)}
            renderLegendRow={({ label, value, color }) => {
              const stat = stats.find((s) => s.label === label)!;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12,
                    color: '#6b7a99',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                  <strong style={{ color: '#1A1A2E', flexShrink: 0 }}>
                    {fmtMoney(value)}/dispatch
                  </strong>
                  <span
                    style={{
                      color: '#9aa5bc',
                      flexShrink: 0,
                      fontSize: 11,
                      marginLeft: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ({stat?.dispatchCount ?? 0} disp.)
                  </span>
                </div>
              );
            }}
          />
          {/* ── Summary stat row ── */}
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px solid #e0e6ef',
            }}
          >
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1A1A2E',
                  lineHeight: 1,
                }}
              >
                {totalDispatches}
              </div>
              <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 3 }}>
                Total dispatches
              </div>
            </div>
            <div style={{ width: 1, background: '#e0e6ef', flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1A1A2E',
                  lineHeight: 1,
                }}
              >
                {fmtMoney(avgPerDispatch)}
              </div>
              <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 3 }}>
                Avg revenue / dispatch
              </div>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}

// ─── Expenses by Category chart ───────────────────────────────────────────────

function ExpensesByCategoryChart() {
  const { data = [], isLoading } = useExpensesByCategory();
  const hasData = !isLoading && (data as DonutSlice[]).length > 0;

  return (
    <ChartCard title="Expenses by Category">
      {isLoading ? (
        <DonutChart data={[]} loading />
      ) : !hasData ? (
        <div
          style={{
            color: '#9aa5bc',
            fontSize: 13,
            padding: '36px 0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Categorize your bank transactions
          <br />
          to see expenses
        </div>
      ) : (
        <DonutChart data={data as DonutSlice[]} colors={DONUT_COLORS} />
      )}
    </ChartCard>
  );
}

// ─── DispatchChartsSection ────────────────────────────────────────────────────

export function DispatchChartsSection() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        margin: '18px 32px 0',
        flexWrap: 'wrap',
      }}
    >
      <RevenueByTerminalChart />
      <ExpensesByCategoryChart />
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function RevenueChartsSection() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        margin: '22px 32px 0',
        flexWrap: 'wrap',
      }}
    >
      <WeekRevenueChart />
      <YearRevenueChart />
    </div>
  );
}
