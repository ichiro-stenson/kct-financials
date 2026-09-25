import React, { useMemo } from 'react';
import { HTMLTable, Tag } from '@blueprintjs/core';
import type { VehicleLoan } from './useFleetData';

interface Props {
  loan: VehicleLoan;
}

interface AmortRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  isPast: boolean;
  isCurrent: boolean;
}

function buildSchedule(loan: VehicleLoan): AmortRow[] {
  const {
    loan_amount,
    interest_rate,
    term_months,
    first_payment_date,
    monthly_payment,
  } = loan;
  if (!loan_amount || !term_months || !first_payment_date) return [];
  const r = (interest_rate || 0) / 12;
  const pmt =
    monthly_payment ||
    (r === 0
      ? loan_amount / term_months
      : (loan_amount * r * Math.pow(1 + r, term_months)) /
        (Math.pow(1 + r, term_months) - 1));
  const now = new Date();
  let balance = loan_amount;
  const rows: AmortRow[] = [];
  const startDate = new Date(first_payment_date);

  for (let i = 1; i <= term_months; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i - 1);
    const interest = balance * r;
    const principal = Math.min(pmt - interest, balance);
    balance = Math.max(balance - principal, 0);
    const isPast = d < now && d.getMonth() !== now.getMonth();
    const isCurrent =
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    rows.push({
      month: i,
      date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      payment: Math.round(pmt * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      isPast,
      isCurrent,
    });
  }
  return rows;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const VehicleAmortization: React.FC<Props> = ({ loan }) => {
  const rows = useMemo(() => buildSchedule(loan), [loan]);

  return (
    <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 12 }}>
      <HTMLTable bordered striped style={{ fontSize: 13, width: '100%' }}>
        <thead>
          <tr style={{ background: '#1B3A6B', color: '#fff' }}>
            <th>#</th>
            <th>Date</th>
            <th>Payment</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.month}
              style={{
                background: r.isCurrent
                  ? '#e8f0fe'
                  : r.isPast
                    ? '#f8f9fa'
                    : undefined,
                fontWeight: r.isCurrent ? 600 : undefined,
                color: r.isPast ? '#888' : undefined,
              }}
            >
              <td>{r.month}</td>
              <td>
                {r.date}{' '}
                {r.isCurrent && (
                  <Tag intent="primary" minimal style={{ marginLeft: 4 }}>
                    Now
                  </Tag>
                )}
              </td>
              <td>{fmt(r.payment)}</td>
              <td>{fmt(r.principal)}</td>
              <td>{fmt(r.interest)}</td>
              <td>
                {r.balance === 0 ? (
                  <Tag intent="success" minimal>
                    Paid off
                  </Tag>
                ) : (
                  fmt(r.balance)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
    </div>
  );
};

export default VehicleAmortization;
