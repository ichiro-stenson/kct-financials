// @ts-nocheck
import React from 'react';
import { useRequestQuery } from '@/hooks/useQueryRequest';

// ─── Benchmark definitions ────────────────────────────────────────────────────

const BENCHMARKS = [
  { category: 'Wages - Direct', target: 43.5, tolerance: 3 },
  { category: 'Employer Payroll Taxes', target: 4.0, tolerance: 1 },
  { category: 'Fuel', target: 10.75, tolerance: 2 },
  { category: 'Maintenance', target: 7.5, tolerance: 2 },
  { category: 'Insurance - Workers Comp', target: 4.25, tolerance: 1 },
  { category: 'Insurance - Other', target: 1.0, tolerance: 0.5 },
  { category: 'Truck Rentals', target: 1.0, tolerance: 0.5 },
  { category: 'Scanners/VEDR/Technology', target: 1.25, tolerance: 0.5 },
  { category: 'License/Tags', target: 1.0, tolerance: 0.5 },
  { category: 'Uniforms', target: 0.1, tolerance: 0.1 },
  { category: 'Mgt / Administrative Wages', target: 4.5, tolerance: 1 },
  { category: 'Employee Benefits', target: 1.3, tolerance: 0.5 },
  { category: 'Recruiting/Hiring', target: 0.62, tolerance: 0.3 },
  { category: 'Accounting', target: 0.58, tolerance: 0.2 },
  { category: 'Legal & Professional', target: 0.25, tolerance: 0.1 },
  {
    category: 'Net Profit/EBITDA',
    target: 15.55,
    tolerance: 3,
    isProfit: true,
  },
] as const;

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

const KEYWORD_MAP: { keywords: string[]; category: string }[] = [
  {
    keywords: [
      'direct wage',
      'driver wage',
      'driver pay',
      'courier wage',
      'delivery wage',
    ],
    category: 'Wages - Direct',
  },
  {
    keywords: [
      'payroll tax',
      'employer tax',
      'fica',
      'futa',
      'suta',
      'social security',
      'medicare tax',
    ],
    category: 'Employer Payroll Taxes',
  },
  {
    keywords: ['fuel', 'gasoline', 'diesel', 'petrol'],
    category: 'Fuel',
  },
  {
    keywords: [
      'maintenance',
      'repair',
      'vehicle maintenance',
      'truck maintenance',
      'vehicle repair',
      'oil change',
    ],
    category: 'Maintenance',
  },
  {
    keywords: [
      'workers comp',
      'workers compensation',
      'worker compensation',
      "worker's comp",
    ],
    category: 'Insurance - Workers Comp',
  },
  {
    keywords: [
      'insurance',
      'liability',
      'vehicle insurance',
      'auto insurance',
      'commercial insurance',
    ],
    category: 'Insurance - Other',
  },
  {
    keywords: [
      'truck rental',
      'vehicle rental',
      'van rental',
      'equipment rental',
      'lease',
    ],
    category: 'Truck Rentals',
  },
  {
    keywords: [
      'scanner',
      'vedr',
      'technology',
      'software',
      'telematics',
      'gps',
      'tablet',
      'device',
    ],
    category: 'Scanners/VEDR/Technology',
  },
  {
    keywords: ['license', 'tag', 'registration', 'permit', 'dot fee', 'ifta'],
    category: 'License/Tags',
  },
  {
    keywords: ['uniform', 'clothing', 'apparel', 'workwear'],
    category: 'Uniforms',
  },
  {
    keywords: [
      'management wage',
      'admin wage',
      'administrative wage',
      'manager pay',
      'office wage',
      'supervisor pay',
      'management salary',
      'admin salary',
    ],
    category: 'Mgt / Administrative Wages',
  },
  {
    keywords: [
      'benefit',
      'health insurance',
      'dental',
      'vision',
      '401k',
      'retirement',
      'pto',
      'vacation pay',
    ],
    category: 'Employee Benefits',
  },
  {
    keywords: [
      'recruit',
      'hiring',
      'job posting',
      'background check',
      'drug test',
      'onboarding',
    ],
    category: 'Recruiting/Hiring',
  },
  {
    keywords: [
      'accounting',
      'bookkeeping',
      'cpa',
      'tax prep',
      'tax preparation',
    ],
    category: 'Accounting',
  },
  {
    keywords: [
      'legal',
      'attorney',
      'professional fee',
      'consulting',
      'counsel',
    ],
    category: 'Legal & Professional',
  },
];

function matchBenchmarkCategory(accountName: string): string | null {
  if (!accountName) return null;
  const lower = accountName.toLowerCase();
  // Priority: longer/more-specific keywords win first
  for (const { keywords, category } of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  // Fallback: check if it's wages (catch-all for unspecified wages)
  if (lower.includes('wage') || lower.includes('salary')) {
    return 'Wages - Direct';
  }
  return null;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useYTDRevenue() {
  const year = new Date().getFullYear();
  return useRequestQuery(
    ['bench-ytd-revenue', year],
    {
      method: 'get',
      url: 'sale-invoices',
      params: {
        from_date: `${year}-01-01`,
        to_date: `${year}-12-31`,
        page_size: 1000,
      },
    },
    {
      select: (res: any) => {
        const list = res?.data?.saleInvoices ?? res?.data ?? [];
        return Array.isArray(list)
          ? list.reduce(
              (s: number, inv: any) => s + (inv.total ?? inv.amount ?? 0),
              0,
            )
          : 0;
      },
      defaultData: 0,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

function useYTDExpenses() {
  const year = new Date().getFullYear();
  return useRequestQuery(
    ['bench-ytd-expenses', year],
    {
      method: 'get',
      url: 'expenses',
      params: { from_date: `${year}-01-01`, page_size: 500 },
    },
    {
      select: (res: any) => res?.data?.expenses ?? res?.data ?? [],
      defaultData: [],
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  );
}

// ─── Compute benchmark results ────────────────────────────────────────────────

type Status = 'green' | 'yellow' | 'red' | 'unknown';

interface BenchmarkResult {
  category: string;
  target: number;
  tolerance: number;
  isProfit: boolean;
  actualPct: number | null;
  matched: boolean;
  status: Status;
}

function computeStatus(
  actualPct: number,
  target: number,
  tolerance: number,
  isProfit: boolean,
): Status {
  if (isProfit) {
    if (actualPct >= target) return 'green';
    if (actualPct >= target - tolerance) return 'yellow';
    return 'red';
  }
  const over = actualPct - target;
  if (over <= 0) return 'green'; // at or under target
  if (over <= tolerance) return 'green'; // within tolerance
  if (over <= tolerance * 1.5) return 'yellow'; // 0–50% over tolerance
  return 'red'; // >50% over tolerance
}

function computeBenchmarks(
  expenses: any[],
  totalRevenue: number,
): { results: BenchmarkResult[]; unmatchedCategories: string[] } {
  const byCategory = new Map<string, number>();
  const unmatchedSet = new Map<string, number>(); // name -> amount

  for (const exp of expenses) {
    const acct =
      exp.expenseAccount ??
      exp.account?.name ??
      exp.accountName ??
      exp.categoryName ??
      '';
    const amt = Number(exp.totalAmount ?? exp.amount ?? exp.total ?? 0);
    if (amt <= 0) continue;
    const cat = matchBenchmarkCategory(acct);
    if (cat) {
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + amt);
    } else if (acct) {
      unmatchedSet.set(acct, (unmatchedSet.get(acct) ?? 0) + amt);
    }
  }

  const totalMatchedExpenses = [...byCategory.values()].reduce(
    (s, v) => s + v,
    0,
  );
  const estimatedProfit =
    totalRevenue > 0 ? totalRevenue - totalMatchedExpenses : 0;
  const profitPct =
    totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : null;

  const results: BenchmarkResult[] = BENCHMARKS.map((b) => {
    const isProfit = (b as any).isProfit ?? false;
    let actualPct: number | null = null;
    let matched = false;

    if (isProfit) {
      actualPct = byCategory.size > 0 ? profitPct : null;
      matched = byCategory.size > 0 && totalRevenue > 0;
    } else {
      const amt = byCategory.get(b.category);
      if (amt !== undefined && totalRevenue > 0) {
        actualPct = (amt / totalRevenue) * 100;
        matched = true;
      }
    }

    const status: Status =
      actualPct != null
        ? computeStatus(actualPct, b.target, b.tolerance, isProfit)
        : 'unknown';

    return {
      category: b.category,
      target: b.target,
      tolerance: b.tolerance,
      isProfit,
      actualPct,
      matched,
      status,
    };
  });

  // Sort: red first, yellow, green, unknown
  const order: Record<Status, number> = {
    red: 0,
    yellow: 1,
    green: 2,
    unknown: 3,
  };
  results.sort((a, b) => order[a.status] - order[b.status]);

  // Unmatched: only show categories with meaningful amounts
  const unmatchedCategories = [...unmatchedSet.entries()]
    .filter(([, amt]) => totalRevenue > 0 && (amt / totalRevenue) * 100 >= 0.1)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return { results, unmatchedCategories };
}

// ─── Benchmark row ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Status, string> = {
  green: '#27ae60',
  yellow: '#E8A020',
  red: '#e74c3c',
  unknown: '#d0d7e3',
};

const STATUS_ICONS: Record<Status, string> = {
  green: '✓',
  yellow: '⚠',
  red: '✗',
  unknown: '—',
};

function BenchmarkRow({
  item,
  barMaxPct,
}: {
  item: BenchmarkResult;
  barMaxPct: number;
}) {
  const actualW =
    item.actualPct != null
      ? Math.min((item.actualPct / barMaxPct) * 100, 100)
      : 0;
  const targetW = Math.min((item.target / barMaxPct) * 100, 100);
  const barColor = STATUS_COLORS[item.status];

  const statusLabel =
    item.status === 'yellow'
      ? 'WATCH'
      : item.status === 'red'
        ? 'OVER'
        : undefined;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '186px 1fr 110px 48px',
        alignItems: 'center',
        gap: 10,
        padding: '7px 0',
        borderBottom: '1px solid #f0f3f8',
      }}
    >
      {/* Category */}
      <div
        style={{
          fontSize: 12,
          color: '#1A1A2E',
          fontWeight: item.isProfit ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={item.category}
      >
        {item.category}
      </div>

      {/* Bar */}
      <div
        style={{
          position: 'relative',
          height: 13,
          background: '#f0f3f8',
          borderRadius: 3,
          overflow: 'visible',
        }}
      >
        {/* Actual fill */}
        {item.actualPct != null && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${actualW}%`,
              background: barColor,
              borderRadius: 3,
              transition: 'width 0.35s ease',
              opacity: 0.85,
            }}
          />
        )}
        {/* Target marker */}
        <div
          style={{
            position: 'absolute',
            left: `${targetW}%`,
            top: -2,
            bottom: -2,
            width: 2,
            background: 'rgba(27,58,107,0.35)',
            borderRadius: 1,
            zIndex: 2,
          }}
        />
      </div>

      {/* Values */}
      <div
        style={{
          fontSize: 11,
          color: '#6b7a99',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {item.actualPct != null ? (
          <>
            <span style={{ color: '#1A1A2E', fontWeight: 600 }}>
              {item.actualPct.toFixed(1)}%
            </span>
            <span style={{ color: '#b0bad0' }}>
              {' '}
              / {item.target.toFixed(2)}%
            </span>
          </>
        ) : (
          <span style={{ color: '#b0bad0' }}>
            — / {item.target.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Status badge */}
      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: barColor,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {STATUS_ICONS[item.status]}
        </span>
        {statusLabel && (
          <span
            style={{
              fontSize: 9,
              color: barColor,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '186px 1fr 110px 48px',
        alignItems: 'center',
        gap: 10,
        padding: '7px 0',
        borderBottom: '1px solid #f0f3f8',
      }}
    >
      <div
        style={{
          height: 10,
          background: '#e0e6ef',
          borderRadius: 3,
          width: '75%',
        }}
      />
      <div style={{ height: 10, background: '#e0e6ef', borderRadius: 3 }} />
      <div
        style={{
          height: 10,
          background: '#e0e6ef',
          borderRadius: 3,
          marginLeft: 'auto',
          width: 64,
        }}
      />
      <div
        style={{
          height: 10,
          background: '#e0e6ef',
          borderRadius: 3,
          width: 20,
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function ExpenseBenchmarkSection() {
  const { data: totalRevenue = 0, isLoading: revLoading } = useYTDRevenue();
  const { data: expenses = [], isLoading: expLoading } = useYTDExpenses();
  const loading = revLoading || expLoading;

  const { results, unmatchedCategories } =
    loading || !Array.isArray(expenses) || (totalRevenue as number) <= 0
      ? {
          results: [] as BenchmarkResult[],
          unmatchedCategories: [] as string[],
        }
      : computeBenchmarks(expenses as any[], totalRevenue as number);

  // Bar scale: max target * 2 (so bars never overflow for reasonable data)
  const barMaxPct = Math.max(...BENCHMARKS.map((b) => b.target)) * 2;

  const redCount = results.filter((r) => r.status === 'red').length;
  const yellowCount = results.filter((r) => r.status === 'yellow').length;
  const greenCount = results.filter((r) => r.status === 'green').length;

  return (
    <div style={{ margin: '18px 32px 0' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e0e6ef',
          borderRadius: 8,
          padding: '18px 20px 16px',
          boxShadow: '0 1px 4px rgba(27,58,107,0.06)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>
              Expense Benchmark Health
            </div>
            <div style={{ fontSize: 11, color: '#9aa5bc', marginTop: 2 }}>
              Category % of YTD revenue vs FedEx recommended benchmarks
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {!loading && results.length > 0 && (
              <>
                {[
                  { color: '#27ae60', label: 'On target', count: greenCount },
                  { color: '#E8A020', label: 'Watch', count: yellowCount },
                  { color: '#e74c3c', label: 'Over', count: redCount },
                ].map(({ color, label, count }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: '#6b7a99',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: color,
                        display: 'inline-block',
                      }}
                    />
                    {count} {label}
                  </div>
                ))}
              </>
            )}
            {!loading && (
              <div style={{ fontSize: 11, color: '#9aa5bc', marginLeft: 4 }}>
                YTD Revenue:{' '}
                <strong style={{ color: '#1A1A2E' }}>
                  ${((totalRevenue as number) / 1000).toFixed(0)}K
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '186px 1fr 110px 48px',
            gap: 10,
            padding: '0 0 6px',
            borderBottom: '2px solid #e0e6ef',
            marginBottom: 2,
          }}
        >
          {['Category', 'Actual vs Target', 'Actual / Target', ''].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#9aa5bc',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                textAlign: h === 'Actual / Target' ? 'right' : 'left',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
        ) : results.length > 0 ? (
          results.map((item) => (
            <BenchmarkRow
              key={item.category}
              item={item}
              barMaxPct={barMaxPct}
            />
          ))
        ) : (
          <div
            style={{
              textAlign: 'center',
              color: '#9aa5bc',
              fontSize: 13,
              padding: '28px 0',
            }}
          >
            {(totalRevenue as number) <= 0
              ? 'No YTD invoice data — add invoices to see benchmark comparison'
              : 'No expense categories matched — check BigCapital expense account names'}
          </div>
        )}

        {/* Unmatched categories note */}
        {!loading && unmatchedCategories.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#f8f9fc',
              borderRadius: 4,
              fontSize: 11,
              color: '#9aa5bc',
              borderLeft: '3px solid #e0e6ef',
            }}
          >
            <strong style={{ color: '#6b7a99' }}>
              Categories not matched to benchmarks:
            </strong>{' '}
            {unmatchedCategories.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
