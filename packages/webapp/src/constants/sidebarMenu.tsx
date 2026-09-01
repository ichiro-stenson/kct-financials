import React from 'react';
import { DialogsName } from './dialogs';
import { FormattedMessage as T } from '@/components';
import {
  ReportsAction,
  AbilitySubject,
  SaleEstimateAction,
  SaleInvoiceAction,
  SaleReceiptAction,
  PaymentReceiveAction,
  BillAction,
  PaymentMadeAction,
  CustomerAction,
  VendorAction,
  AccountAction,
  ManualJournalAction,
  ExpenseAction,
  CashflowAction,
  PreferencesAbility,
} from '@/constants/abilityOption';
import {
  ISidebarMenuItemType,
  ISidebarMenuOverlayIds,
} from '@/containers/Dashboard/Sidebar/interfaces';

// KCT Financials — stripped sidebar.
// Removed: Inventory/Items, Inventory reports, Tax Rates (intl tax complexity),
//          Taxes > Sales Tax Liability Summary, Inventory reports group.
// POS and Manufacturing are not present in BigCapital upstream.

export interface SidebarMenuItemPermission {
  subject: string;
  ability: string;
}

export interface SidebarMenuItem {
  text: React.ReactNode;
  type: ISidebarMenuItemType;
  disabled?: boolean;
  href?: string;
  matchExact?: boolean;
  overlayId?: ISidebarMenuOverlayIds;
  dialogName?: DialogsName;
  divider?: boolean;
  feature?: string;
  permission?: SidebarMenuItemPermission;
  children?: SidebarMenuItem[];
}

export const SidebarMenu: SidebarMenuItem[] = [
  // ---------------
  // # Homepage
  // ---------------
  {
    text: <T id={'sidebar.homepage'} />,
    type: ISidebarMenuItemType.Link,
    disabled: false,
    href: '/',
    matchExact: true,
  },
  // ---------------
  // # Sales
  // ---------------
  {
    text: <T id={'sidebar.sales'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Sales,
    children: [
      {
        text: <T id={'sidebar.sales'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.estimates'} />,
            href: '/estimates',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Estimate,
              ability: SaleEstimateAction.View,
            },
          },
          {
            text: <T id={'sidebar.invoices'} />,
            href: '/invoices',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Invoice,
              ability: SaleInvoiceAction.View,
            },
          },
          {
            text: <T id={'sidebar.receipts'} />,
            href: '/receipts',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Receipt,
              ability: SaleReceiptAction.View,
            },
          },
          {
            text: <T id={'sidebar.credit_notes'} />,
            href: '/credit-notes',
            type: ISidebarMenuItemType.Link,
          },
          {
            text: <T id={'sidebar.payments_received'} />,
            href: '/payments-received',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.PaymentReceive,
              ability: PaymentReceiveAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.new_estimate'} />,
            href: '/estimates/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Estimate,
              ability: SaleEstimateAction.Create,
            },
          },
          {
            text: <T id={'sidebar.new_invoice'} />,
            href: '/invoices/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Invoice,
              ability: SaleInvoiceAction.Create,
            },
          },
          {
            text: <T id={'sidebar.new_receipt'} />,
            href: '/receipts/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Receipt,
              ability: SaleReceiptAction.Create,
            },
          },
          {
            text: <T id={'sidebar.new_credit_note'} />,
            href: '/credit-notes/new',
            type: ISidebarMenuItemType.Link,
          },
          {
            text: <T id={'sidebar.new_payment_received'} />,
            href: '/payment-received/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.PaymentReceive,
              ability: PaymentReceiveAction.Create,
            },
          },
        ],
      },
    ],
  },
  // ---------------
  // # Purchases
  // ---------------
  {
    text: <T id={'sidebar.purchases'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Purchases,
    children: [
      {
        text: <T id={'sidebar.purchases'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'bills'} />,
            href: '/bills',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Bill,
              ability: BillAction.View,
            },
          },
          {
            text: <T id={'sidebar_vendor_credits'} />,
            href: '/vendor-credits',
            type: ISidebarMenuItemType.Link,
          },
          {
            text: <T id={'payments_made'} />,
            href: '/payments-made',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.PaymentMade,
              ability: PaymentMadeAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.new_purchase_invoice'} />,
            href: '/bills/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Bill,
              ability: BillAction.Create,
            },
          },
          {
            text: <T id={'sidebar.new_vendor_credit'} />,
            href: '/vendor-credits/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Bill,
              ability: BillAction.Create,
            },
          },
          {
            text: <T id={'sidebar.new_payment_made'} />,
            href: '/payments-made/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.PaymentMade,
              ability: PaymentMadeAction.Create,
            },
          },
        ],
      },
    ],
  },
  // ---------------
  // # Contacts
  // ---------------
  {
    text: <T id={'sidebar.contacts'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Contacts,
    children: [
      {
        text: <T id={'sidebar.contacts'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.customers'} />,
            href: '/customers',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Customer,
              ability: CustomerAction.View,
            },
          },
          {
            text: <T id={'sidebar.vendors'} />,
            href: '/vendors',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Vendor,
              ability: VendorAction.Create,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.new_customer'} />,
            href: '/customers/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Customer,
              ability: CustomerAction.View,
            },
          },
          {
            text: <T id={'sidebar.new_vendor'} />,
            href: '/vendors/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Vendor,
              ability: VendorAction.View,
            },
          },
        ],
      },
    ],
  },
  // ---------------
  // # Accounting
  // ---------------
  {
    text: <T id={'sidebar.accounting'} />,
    type: ISidebarMenuItemType.Group,
    children: [
      {
        text: <T id={'sidebar.financial'} />,
        type: ISidebarMenuItemType.Overlay,
        overlayId: ISidebarMenuOverlayIds.Financial,
        children: [
          {
            text: <T id={'sidebar.financial'} />,
            type: ISidebarMenuItemType.Group,
            children: [
              {
                text: <T id={'sidebar.accounts_chart'} />,
                href: '/accounts',
                type: ISidebarMenuItemType.Link,
                permission: {
                  subject: AbilitySubject.Account,
                  ability: AccountAction.View,
                },
              },
              {
                text: <T id={'sidebar.manual_journals'} />,
                href: '/manual-journals',
                type: ISidebarMenuItemType.Link,
                permission: {
                  subject: AbilitySubject.ManualJournal,
                  ability: ManualJournalAction.View,
                },
              },
              {
                text: <T id={'sidebar.transactions_locaking'} />,
                href: '/transactions-locking',
                type: ISidebarMenuItemType.Link,
              },
              // KCT: Tax Rates hidden (international tax complexity not needed for ISP ops)
              // Re-enable by adding the Tax Rates entry here if needed later.
            ],
          },
          {
            text: <T id={'sidebar.new_tasks'} />,
            type: ISidebarMenuItemType.Group,
            children: [
              {
                text: <T id={'sidebar.make_journal_entry'} />,
                href: '/make-journal-entry',
                type: ISidebarMenuItemType.Link,
                permission: {
                  subject: AbilitySubject.ManualJournal,
                  ability: ManualJournalAction.Create,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  // ---------------
  // # Banking / Cashflow
  // ---------------
  {
    text: <T id={'sidebar.banking'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Cashflow,
    children: [
      {
        text: <T id={'sidebar.banking'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.cash_bank_accounts'} />,
            href: '/cashflow-accounts',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Cashflow,
              ability: CashflowAction.View,
            },
          },
          {
            text: 'Rules',
            href: '/bank-rules',
            type: ISidebarMenuItemType.Link,
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        divider: true,
        children: [
          {
            text: <T id={'sidebar.add_money_in'} />,
            href: '/cashflow-accounts',
            type: ISidebarMenuItemType.Dialog,
            dialogName: DialogsName.MoneyInForm,
            permission: {
              subject: AbilitySubject.Cashflow,
              ability: CashflowAction.Create,
            },
          },
          {
            text: <T id={'sidebar.add_money_out'} />,
            href: '/cashflow-accounts',
            type: ISidebarMenuItemType.Dialog,
            dialogName: DialogsName.MoneyOutForm,
            permission: {
              subject: AbilitySubject.Cashflow,
              ability: CashflowAction.Create,
            },
          },
          {
            text: <T id={'sidebar.add_cash_account'} />,
            href: '/cashflow-accounts',
            type: ISidebarMenuItemType.Dialog,
            dialogName: DialogsName.AccountForm,
            permission: {
              subject: AbilitySubject.Cashflow,
              ability: CashflowAction.Create,
            },
          },
          {
            text: <T id={'sidebar.add_bank_account'} />,
            href: '/cashflow-accounts',
            type: ISidebarMenuItemType.Dialog,
            dialogName: DialogsName.AccountForm,
            permission: {
              subject: AbilitySubject.Cashflow,
              ability: CashflowAction.Create,
            },
          },
        ],
      },
    ],
  },
  // ---------------
  // # Expenses
  // ---------------
  {
    text: <T id={'sidebar.expenses'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Expenses,
    children: [
      {
        text: <T id={'sidebar.expenses'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.expenses'} />,
            href: '/expenses',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Expense,
              ability: ExpenseAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.new_expense'} />,
            href: '/expenses/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Expense,
              ability: ExpenseAction.Create,
            },
          },
        ],
      },
    ],
  },
  // ---------------
  // # Reports
  // ---------------
  {
    text: <T id={'sidebar.reports'} />,
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Reports,
    children: [
      {
        text: <T id={'sidebar.reports'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.balance_sheet'} />,
            href: '/financial-reports/balance-sheet',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_BALANCE_SHEET,
            },
          },
          {
            text: <T id={'sidebar.trial_balance_sheet'} />,
            href: '/financial-reports/trial-balance-sheet',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_TRIAL_BALANCE_SHEET,
            },
          },
          {
            text: <T id={'sidebar.journal'} />,
            href: '/financial-reports/journal-sheet',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_JOURNAL,
            },
          },
          {
            text: <T id={'sidebar.general_ledger'} />,
            href: '/financial-reports/general-ledger',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_GENERAL_LEDGET,
            },
          },
          {
            text: <T id={'sidebar.profit_loss_sheet'} />,
            href: '/financial-reports/profit-loss-sheet',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_PROFIT_LOSS,
            },
          },
          {
            text: <T id={'sidebar.cash_flow_statement'} />,
            href: '/financial-reports/cash-flow',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_CASHFLOW_ACCOUNT_TRANSACTION,
            },
          },
          {
            text: <T id={'sidebar.ar_aging_Summary'} />,
            href: '/financial-reports/receivable-aging-summary',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_AR_AGING_SUMMARY,
            },
          },
          {
            text: <T id={'sidebar.ap_aging_summary'} />,
            href: '/financial-reports/payable-aging-summary',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_AP_AGING_SUMMARY,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.sales_purchases'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: <T id={'sidebar.customers_transactions'} />,
            href: '/financial-reports/transactions-by-customers',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_CUSTOMERS_TRANSACTIONS,
            },
          },
          {
            text: <T id={'sidebar.vendors_transactions'} />,
            href: '/financial-reports/transactions-by-vendors',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_VENDORS_TRANSACTIONS,
            },
          },
          {
            text: <T id={'sidebar.customers_balance_summary'} />,
            href: '/financial-reports/customers-balance-summary',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_CUSTOMERS_SUMMARY_BALANCE,
            },
          },
          {
            text: <T id={'sidebar.vendors_balance_summary'} />,
            href: '/financial-reports/vendors-balance-summary',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_VENDORS_SUMMARY_BALANCE,
            },
          },
        ],
      },
      // KCT: Inventory reports group hidden (no physical inventory for ISPs).
      // KCT: Taxes > Sales Tax Liability Summary hidden (international tax not needed).
      // Re-enable by restoring these groups from git history if needed.
    ],
  },
  {
    text: <T id={'sidebar.system'} />,
    type: ISidebarMenuItemType.Group,
    children: [
      {
        text: <T id={'sidebar.preferences'} />,
        href: '/preferences',
        type: ISidebarMenuItemType.Link,
        permission: {
          subject: AbilitySubject.Preferences,
          ability: PreferencesAbility.Mutate,
        },
      },
    ],
  },
];
