import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Button,
  FormGroup,
  InputGroup,
  NumericInput,
  TextArea,
  HTMLSelect,
  Switch,
  Tag,
  Intent,
} from '@blueprintjs/core';
import type { Vehicle, VehicleLoan } from './useFleetData';

// DrawerSize may not exist in older Blueprint versions — use a string literal
const DRAWER_WIDTH = '480px';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    vehicle: Partial<Vehicle>,
    loan?: Partial<VehicleLoan> | null,
  ) => Promise<void>;
  entity: string;
  editVehicle?: Vehicle | null;
}

const TERM_OPTIONS = [24, 36, 48, 60, 72, 84];

function calcPMT(
  loanAmount: number,
  annualRate: number,
  termMonths: number,
): number {
  if (!loanAmount || !termMonths) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return loanAmount / termMonths;
  return (
    (loanAmount * r * Math.pow(1 + r, termMonths)) /
    (Math.pow(1 + r, termMonths) - 1)
  );
}

function calcPayoffDate(firstPaymentDate: string, termMonths: number): string {
  if (!firstPaymentDate || !termMonths) return '';
  const d = new Date(firstPaymentDate);
  d.setMonth(d.getMonth() + termMonths - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function calcTotalInterest(
  pmt: number,
  loanAmount: number,
  termMonths: number,
): number {
  return Math.max(pmt * termMonths - loanAmount, 0);
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const AddVehicleDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  entity,
  editVehicle,
}) => {
  const [year, setYear] = useState<number | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [financed, setFinanced] = useState(false);
  const [lender, setLender] = useState('');
  const [loanAmount, setLoanAmount] = useState<number | null>(null);
  const [downPayment, setDownPayment] = useState<number | null>(0);
  const [interestRate, setInterestRate] = useState<number | null>(null);
  const [termMonths, setTermMonths] = useState(60);
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editVehicle) {
      setYear(editVehicle.year);
      setMake(editVehicle.make || '');
      setModel(editVehicle.model || '');
      setColor(editVehicle.color || '');
      setPlate(editVehicle.license_plate || '');
      setVin(editVehicle.vin || '');
      setPurchaseDate(editVehicle.purchase_date || '');
      setPurchasePrice(editVehicle.purchase_price);
      setStatus(editVehicle.status);
      setNotes(editVehicle.notes || '');
      if (editVehicle.loan) {
        setFinanced(true);
        setLender(editVehicle.loan.lender || '');
        setLoanAmount(editVehicle.loan.loan_amount);
        setDownPayment(editVehicle.loan.down_payment);
        setInterestRate(
          editVehicle.loan.interest_rate
            ? editVehicle.loan.interest_rate * 100
            : null,
        );
        setTermMonths(editVehicle.loan.term_months || 60);
        setFirstPaymentDate(editVehicle.loan.first_payment_date || '');
      }
    } else {
      // Reset form when opening for new vehicle
      setYear(null);
      setMake('');
      setModel('');
      setColor('');
      setPlate('');
      setVin('');
      setPurchaseDate('');
      setPurchasePrice(null);
      setStatus('active');
      setNotes('');
      setFinanced(false);
      setLender('');
      setLoanAmount(null);
      setDownPayment(0);
      setInterestRate(null);
      setTermMonths(60);
      setFirstPaymentDate('');
    }
  }, [editVehicle, isOpen]);

  const effectiveLoan = loanAmount || 0;
  const effectiveRate = interestRate || 0;
  const pmt = financed ? calcPMT(effectiveLoan, effectiveRate, termMonths) : 0;
  const totalInterest = financed
    ? calcTotalInterest(pmt, effectiveLoan, termMonths)
    : 0;
  const payoffDate = financed
    ? calcPayoffDate(firstPaymentDate, termMonths)
    : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      const vehicle: Partial<Vehicle> = {
        entity,
        year,
        make,
        model,
        color,
        license_plate: plate,
        vin,
        purchase_date: purchaseDate || null,
        purchase_price: purchasePrice,
        status,
        notes,
      };
      const loan: Partial<VehicleLoan> | null = financed
        ? {
            lender,
            loan_amount: loanAmount,
            interest_rate: (interestRate || 0) / 100,
            term_months: termMonths,
            first_payment_date: firstPaymentDate || null,
            monthly_payment: Math.round(pmt * 100) / 100,
            down_payment: downPayment,
            status: 'active',
          }
        : null;
      await onSave(vehicle, loan);
      onClose();
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
      style={{ width: DRAWER_WIDTH, maxWidth: '100vw' }}
    >
      <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%' }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <FormGroup label="Year">
            <NumericInput
              fill
              value={year ?? ''}
              onValueChange={(v) => setYear(v || null)}
              placeholder="2024"
              min={1990}
              max={2030}
            />
          </FormGroup>
          <FormGroup label="Status">
            <HTMLSelect
              fill
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="out_of_service">Out of Service</option>
              <option value="sold">Sold</option>
              <option value="totaled">Totaled</option>
            </HTMLSelect>
          </FormGroup>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <FormGroup label="Make">
            <InputGroup
              fill
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Freightliner"
            />
          </FormGroup>
          <FormGroup label="Model">
            <InputGroup
              fill
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Cascadia"
            />
          </FormGroup>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <FormGroup label="Color">
            <InputGroup
              fill
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="White"
            />
          </FormGroup>
          <FormGroup label="License Plate">
            <InputGroup
              fill
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="TX-TRK001"
            />
          </FormGroup>
        </div>
        <FormGroup label="VIN">
          <InputGroup
            fill
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder="1FUJGHDV5NLAA0000"
          />
        </FormGroup>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <FormGroup label="Purchase Date">
            <InputGroup
              fill
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Purchase Price">
            <NumericInput
              fill
              value={purchasePrice ?? ''}
              onValueChange={(v) => setPurchasePrice(v || null)}
              placeholder="185000"
              leftIcon="dollar"
              min={0}
            />
          </FormGroup>
        </div>
        <FormGroup label="Notes">
          <TextArea
            fill
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </FormGroup>

        <div style={{ borderTop: '1px solid #e0e6ef', margin: '16px 0' }} />

        <Switch
          large
          checked={financed}
          onChange={(e) => setFinanced((e.target as HTMLInputElement).checked)}
          label="Financed?"
        />

        {financed && (
          <>
            <FormGroup label="Lender" style={{ marginTop: 12 }}>
              <InputGroup
                fill
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                placeholder="First National Bank"
              />
            </FormGroup>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <FormGroup label="Loan Amount">
                <NumericInput
                  fill
                  value={loanAmount ?? ''}
                  onValueChange={(v) => setLoanAmount(v || null)}
                  leftIcon="dollar"
                  min={0}
                />
              </FormGroup>
              <FormGroup label="Down Payment">
                <NumericInput
                  fill
                  value={downPayment ?? ''}
                  onValueChange={(v) => setDownPayment(v || null)}
                  leftIcon="dollar"
                  min={0}
                />
              </FormGroup>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <FormGroup label="Interest Rate (%)">
                <NumericInput
                  fill
                  value={interestRate ?? ''}
                  onValueChange={(v) => setInterestRate(v || null)}
                  placeholder="6.25"
                  min={0}
                  max={30}
                  stepSize={0.01}
                />
              </FormGroup>
              <FormGroup label="Term (months)">
                <HTMLSelect
                  fill
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t} months
                    </option>
                  ))}
                </HTMLSelect>
              </FormGroup>
            </div>
            <FormGroup label="First Payment Date">
              <InputGroup
                fill
                type="date"
                value={firstPaymentDate}
                onChange={(e) => setFirstPaymentDate(e.target.value)}
              />
            </FormGroup>
            <div
              style={{
                background: '#f0f4ff',
                border: '1px solid #c7d7f7',
                borderRadius: 6,
                padding: '12px 16px',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                    Monthly Payment
                  </div>
                  <Tag large intent={Intent.PRIMARY}>
                    {fmt(pmt)}
                  </Tag>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                    Total Interest
                  </div>
                  <Tag large intent={Intent.WARNING}>
                    {fmt(totalInterest)}
                  </Tag>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                    Payoff
                  </div>
                  <Tag large>{payoffDate || '—'}</Tag>
                </div>
              </div>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            intent={Intent.PRIMARY}
            onClick={handleSave}
            loading={saving}
            style={{ background: '#1B3A6B' }}
          >
            {editVehicle ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

export default AddVehicleDrawer;
