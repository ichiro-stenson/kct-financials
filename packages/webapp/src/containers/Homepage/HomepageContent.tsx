// @ts-nocheck
import React from 'react';
import { AccountsPayableSection } from './AccountsPayableSection';
import { AccountsReceivableSection } from './AccountsReceivableSection';
import { FinancialAccountingSection } from './FinancialAccountingSection';
import { ProductsServicesSection } from './ProductsServicesSection';
import {
  RevenueChartsSection,
  DispatchChartsSection,
} from './RevenueChartsSection';
import '@/style/pages/HomePage/HomePage.scss';

export function HomepageContent() {
  return (
    <div className="financial-reports">
      <RevenueChartsSection />
      <DispatchChartsSection />
      <AccountsReceivableSection />
      <AccountsPayableSection />
      <FinancialAccountingSection />
      <ProductsServicesSection />
    </div>
  );
}
