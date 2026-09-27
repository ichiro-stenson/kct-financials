// useFleetData.ts
import { useState, useEffect, useCallback } from 'react';

const SUPABASE_URL = 'https://iprxetnntchgsekdbyon.supabase.co';
// TODO: move to env var - REACT_APP_SUPABASE_KEY
const SUPABASE_KEY =
  (process.env as any).REACT_APP_SUPABASE_KEY ||
  (process.env as any).REACT_APP_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  '';

const supabaseHeaders: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

export interface Vehicle {
  id: number;
  entity: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  color: string | null;
  license_plate: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  odometer_at_purchase: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  loan?: VehicleLoan | null;
}

export interface VehicleLoan {
  id: number;
  vehicle_id: number;
  lender: string | null;
  loan_amount: number | null;
  interest_rate: number | null;
  term_months: number | null;
  first_payment_date: string | null;
  monthly_payment: number | null;
  down_payment: number | null;
  status: string;
}

export function useVehicles(entity: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loans, setLoans] = useState<VehicleLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, lRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/kct_vehicles?entity=eq.${entity}&order=id.asc`,
          { headers: supabaseHeaders },
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/kct_vehicle_loans?status=eq.active&order=vehicle_id.asc`,
          { headers: supabaseHeaders },
        ),
      ]);
      if (!vRes.ok) throw new Error(`Vehicles fetch failed: ${vRes.status}`);
      const vData: Vehicle[] = await vRes.json();
      const lData: VehicleLoan[] = lRes.ok ? await lRes.json() : [];

      // Join loans to vehicles
      const loanMap = new Map<number, VehicleLoan>();
      lData.forEach((l) => loanMap.set(l.vehicle_id, l));
      setVehicles(
        vData.map((v) => ({ ...v, loan: loanMap.get(v.id) || null })),
      );
      setLoans(lData);
    } catch (e: any) {
      setError(e.message);
      // Fallback to mock data if Supabase tables don't exist yet
      setVehicles(MOCK_VEHICLES.map((v) => ({ ...v, entity })));
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { vehicles, loans, loading, error, refetch: fetchData };
}

export function useAddVehicle() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addVehicle = async (
    vehicle: Partial<Vehicle>,
    loan?: Partial<VehicleLoan> | null,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const vRes = await fetch(`${SUPABASE_URL}/rest/v1/kct_vehicles`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(vehicle),
      });
      if (!vRes.ok) throw new Error(`Failed to save vehicle: ${vRes.status}`);
      const [newVehicle] = await vRes.json();
      if (loan && newVehicle?.id) {
        const lRes = await fetch(`${SUPABASE_URL}/rest/v1/kct_vehicle_loans`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({ ...loan, vehicle_id: newVehicle.id }),
        });
        if (!lRes.ok) throw new Error(`Failed to save loan: ${lRes.status}`);
      }
      return newVehicle;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return { addVehicle, saving, error };
}

export function useUpdateVehicle(id: number) {
  const [saving, setSaving] = useState(false);

  const updateVehicle = async (updates: Partial<Vehicle>) => {
    setSaving(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/kct_vehicles?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    } finally {
      setSaving(false);
    }
  };

  return { updateVehicle, saving };
}

// TODO: Remove mock data once kct_vehicles table is created in Supabase
const MOCK_VEHICLES: Vehicle[] = [
  {
    id: 1,
    entity: 'KCT-1',
    year: 2022,
    make: 'Freightliner',
    model: 'Cascadia',
    vin: '1FUJGHDV5NLAA1234',
    color: 'White',
    license_plate: 'TX-TRK001',
    purchase_date: '2022-03-15',
    purchase_price: 185000,
    odometer_at_purchase: 0,
    status: 'active',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    loan: {
      id: 1,
      vehicle_id: 1,
      lender: 'First National Bank',
      loan_amount: 160000,
      interest_rate: 0.0625,
      term_months: 84,
      first_payment_date: '2022-04-15',
      monthly_payment: 2350,
      down_payment: 25000,
      status: 'active',
    },
  },
  {
    id: 2,
    entity: 'KCT-1',
    year: 2021,
    make: 'Kenworth',
    model: 'T680',
    vin: '1XKYDP9X5MJ123456',
    color: 'White',
    license_plate: 'TX-TRK002',
    purchase_date: '2021-06-01',
    purchase_price: 172000,
    odometer_at_purchase: 0,
    status: 'active',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    loan: {
      id: 2,
      vehicle_id: 2,
      lender: 'BMO Harris',
      loan_amount: 145000,
      interest_rate: 0.0699,
      term_months: 72,
      first_payment_date: '2021-07-01',
      monthly_payment: 2480,
      down_payment: 27000,
      status: 'active',
    },
  },
];
