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
