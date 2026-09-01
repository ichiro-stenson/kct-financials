import React from 'react';
import { DialogsName } from './dialogs';
import { FormattedMessage as T } from '@/components';
import {
  ReportsAction,
  AbilitySubject,
  SaleInvoiceAction,
  BillAction,
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

// KCT Financials — FedEx ISP sidebar.
// Sales      → FedEx Revenue (Charge Statements only — FedEx settlement invoices)
// Purchases  → Asset Purchases (depreciable assets: trucks, iPads, scanners, etc.)
// Contacts   → Suppliers (vendors only — FedEx is the only "customer")
// Expenses   → Plaid-linked bank transactions
// Items / Inventory / Estimates / Receipts / Credit Notes → removed

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
  // # FedEx Revenue
  // FedEx settlement charge statements only.
  // ---------------
  {
    text: 'FedEx Revenue',
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Sales,
    children: [
      {
        text: 'FedEx Revenue',
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'Charge Statements',
            href: '/invoices',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Invoice,
              ability: SaleInvoiceAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'New Charge Statement',
            href: '/invoices/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Invoice,
              ability: SaleInvoiceAction.Create,
            },
          },
        ],
      },
    ],
  },

  // ---------------
  // # Asset Purchases
  // Depreciable assets: trucks, iPads, scanners, hand carts, etc.
  // ---------------
  {
    text: 'Asset Purchases',
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Purchases,
    children: [
      {
        text: 'Asset Purchases',
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'Asset Purchases',
            href: '/bills',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Bill,
              ability: BillAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'New Asset Purchase',
            href: '/bills/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Bill,
              ability: BillAction.Create,
            },
          },
        ],
      },
    ],
  },

  // ---------------
  // # Suppliers
  // Vendors we purchase assets from (vehicle dealers, tech suppliers, etc.)
  // ---------------
  {
    text: 'Suppliers',
    type: ISidebarMenuItemType.Overlay,
    overlayId: ISidebarMenuOverlayIds.Contacts,
    children: [
      {
        text: 'Suppliers',
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'Suppliers',
            href: '/vendors',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Vendor,
              ability: VendorAction.View,
            },
          },
        ],
      },
      {
        text: <T id={'sidebar.new_tasks'} />,
        type: ISidebarMenuItemType.Group,
        children: [
          {
            text: 'New Supplier',
            href: '/vendors/new',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Vendor,
              ability: VendorAction.Create,
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
  // # Banking / Expenses (Plaid)
  // Connect bank accounts via Plaid → auto-import and categorize transactions.
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
        ],
      },
    ],
  },

  // ---------------
  // # Expenses
  // Manual expenses (supplements Plaid-imported transactions).
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
            text: <T id={'sidebar.general_ledger'} />,
            href: '/financial-reports/general-ledger',
            type: ISidebarMenuItemType.Link,
            permission: {
              subject: AbilitySubject.Report,
              ability: ReportsAction.READ_GENERAL_LEDGET,
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
        ],
      },
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
