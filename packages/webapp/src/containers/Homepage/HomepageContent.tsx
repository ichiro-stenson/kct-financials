// @ts-nocheck
import React from 'react';
import { AccountsPayableSection } from './AccountsPayableSection';
import { AccountsReceivableSection } from './AccountsReceivableSection';
import { FinancialAccountingSection } from './FinancialAccountingSection';
import { ProductsServicesSection } from './ProductsServicesSection';
import { RevenueChartsSection } from './RevenueChartsSection';
import '@/style/pages/HomePage/HomePage.scss';

export function HomepageContent() {
  return (
    <div className="financial-reports">
      <RevenueChartsSection />
      <AccountsReceivableSection />
      <AccountsPayableSection />
      <FinancialAccountingSection />
      <ProductsServicesSection />
    </div>
  );
}
