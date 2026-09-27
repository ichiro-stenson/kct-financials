import React from 'react';
import type { PreferencesMenuItem } from './types';
import { FormattedMessage as T } from '@/components';

export const PreferencesMenu: PreferencesMenuItem[] = [
  {
    text: <T id={'general'} />,
    disabled: false,
    href: '/preferences/general',
  },
  {
    text: <T id={'users'} />,
    href: '/preferences/users',
  },
  {
    text: 'Payment Methods',
    href: '/preferences/payment-methods',
  },
  {
    text: <T id={'preferences.invoices'} />,
    href: '/preferences/invoices',
  },
  {
    text: <T id={'preferences.receipts'} />,
    href: '/preferences/receipts',
  },
  {
    text: <T id={'preferences.creditNotes'} />,
    href: '/preferences/credit-notes',
  },
  {
    text: <T id={'items'} />,
    disabled: false,
    href: '/preferences/items',
  },
  {
    text: 'API Keys',
    disabled: false,
    href: '/preferences/api-keys',
  },
  {
    text: <T id={'accountant'} />,
    disabled: false,
    href: '/preferences/accountant',
  },
  {
    text: <T id={'features.label'} />,
    disabled: false,
    href: '/preferences/features',
  },
];
