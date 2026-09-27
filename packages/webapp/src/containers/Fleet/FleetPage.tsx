import React, { useState, useMemo } from 'react';
import {
  Button,
  HTMLTable,
  Tag,
  Intent,
  NonIdealState,
  Spinner,
} from '@blueprintjs/core';
import { useVehicles, useAddVehicle } from './useFleetData';
import type { Vehicle } from './useFleetData';
import { AddVehicleDrawer } from './AddVehicleDrawer';
import { VehicleAmortization } from './VehicleAmortization';

// Determine entity from org context — check how BigCapital exposes current org.
// org 8on8u91mti2udiv → KCT-1, org kjmwhhwbgjuo2p2 → KCT-2
function useCurrentEntity(): string {
  if (typeof window !== 'undefined') {
    const orgId =
      (window as any).__BIGCAPITAL_ORG_ID__ ||
      localStorage.getItem('orgId') ||
      '';
    if (orgId === 'kjmwhhwbgjuo2p2') return 'KCT-2';
  }
  return 'KCT-1';
}

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e6ef',
  borderRadius: 8,
  padding: '18px 20px',
  flex: 1,
  minWidth: 140,
};

const fmt = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

const statusColor: Record<string, Intent> = {
  active: Intent.SUCCESS,
  out_of_service: Intent.WARNING,
  sold: Intent.NONE,
  totaled: Intent.DANGER,
};
const statusLabel: Record<string, string> = {
  active: 'Active',
  out_of_service: 'Out of Service',
  sold: 'Sold',
  totaled: 'Totaled',
};

function estimatePayoff(loan: Vehicle['loan']): string {
  if (!loan?.first_payment_date || !loan.term_months) return '—';
  const d = new Date(loan.first_payment_date);
  d.setMonth(d.getMonth() + loan.term_months - 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const FleetPage: React.FC = () => {
  const entity = useCurrentEntity();
  const { vehicles, loading, error, refetch } = useVehicles(entity);
  const { addVehicle } = useAddVehicle();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const summary = useMemo(() => {
    const totalValue = vehicles.reduce(
      (s, v) => s + (v.purchase_price || 0),
      0,
    );
    const totalDebt = vehicles.reduce(
      (s, v) => s + (v.loan?.loan_amount || 0),
      0,
    );
    const monthlyDebt = vehicles.reduce(
      (s, v) => s + (v.loan?.monthly_payment || 0),
      0,
    );
    return { count: vehicles.length, totalValue, totalDebt, monthlyDebt };
  }, [vehicles]);

  const handleSave = async (vehicle: Partial<Vehicle>, loan?: any) => {
    await addVehicle(vehicle, loan);
    refetch();
  };

  const orgLabel =
    entity === 'KCT-2'
      ? 'KCT Logistics (40 Trucks)'
      : 'KCT Capital Transport (100 Trucks)';

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: '#1B3A6B',
            }}
          >
            🚛 Fleet Assets
          </h1>
          <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            {orgLabel}
          </div>
        </div>
        <Button
          intent={Intent.PRIMARY}
          icon="plus"
          onClick={() => {
            setEditVehicle(null);
            setDrawerOpen(true);
          }}
          style={{ background: '#1B3A6B' }}
        >
          Add Vehicle
        </Button>
      </div>

      {/* Summary Cards */}
      <div
        style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}
      >
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            TOTAL VEHICLES
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1B3A6B' }}>
            {summary.count}
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            TOTAL PURCHASE VALUE
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1B3A6B' }}>
            {fmtM(summary.totalValue)}
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            OUTSTANDING DEBT
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d9534f' }}>
            {fmtM(summary.totalDebt)}
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            MONTHLY DEBT SERVICE
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e67e22' }}>
            {fmt(summary.monthlyDebt)}
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            ACTIVE LOANS
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2ecc71' }}>
            {vehicles.filter((v) => v.loan?.status === 'active').length}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠️ Using mock data — Supabase connection issue: {error}
          <br />
          <em>
            TODO: Ensure kct_vehicles table exists in Supabase and
            VITE_SUPABASE_KEY is set.
          </em>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <NonIdealState icon={<Spinner />} title="Loading fleet data..." />
      ) : vehicles.length === 0 ? (
        <NonIdealState
          icon="drive-time"
          title="No vehicles yet"
          description="Add your first vehicle to get started."
          action={
            <Button
              intent={Intent.PRIMARY}
              onClick={() => setDrawerOpen(true)}
              style={{ background: '#1B3A6B' }}
            >
              Add Vehicle
            </Button>
          }
        />
      ) : (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e0e6ef',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <HTMLTable bordered style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#1B3A6B' }}>
                {[
                  'Year',
                  'Make / Model',
                  'VIN',
                  'Purchase Price',
                  'Monthly Payment',
                  'Est. Payoff',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: '#fff',
                      padding: '10px 14px',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <React.Fragment key={v.id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      setExpandedId(expandedId === v.id ? null : v.id)
                    }
                  >
                    <td style={{ padding: '10px 14px' }}>{v.year || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                      {v.make} {v.model}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                    >
                      {v.vin || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {v.purchase_price ? fmt(v.purchase_price) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {v.loan?.monthly_payment
                        ? fmt(v.loan.monthly_payment)
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {estimatePayoff(v.loan)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Tag
                        intent={statusColor[v.status] || Intent.NONE}
                        minimal
                      >
                        {statusLabel[v.status] || v.status}
                      </Tag>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Button
                        small
                        icon="edit"
                        minimal
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditVehicle(v);
                          setDrawerOpen(true);
                        }}
                      />
                    </td>
                  </tr>
                  {expandedId === v.id && v.loan && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: '0 14px 14px',
                          background: '#f8faff',
                        }}
                      >
                        <div style={{ paddingTop: 12 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 8,
                              color: '#1B3A6B',
                              fontSize: 14,
                            }}
                          >
                            Amortization Schedule — {v.loan.lender}
                          </div>
                          <VehicleAmortization loan={v.loan} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </HTMLTable>
        </div>
      )}

      <AddVehicleDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditVehicle(null);
        }}
        onSave={handleSave}
        entity={entity}
        editVehicle={editVehicle}
      />
    </div>
  );
};

export default FleetPage;
