// @ts-nocheck
import classNames from 'classnames';
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import DashboardErrorBoundary from '@/components/Dashboard/DashboardErrorBoundary';
import PreferencesContentRoute from '@/components/Preferences/PreferencesContentRoute';
import PreferencesTopbar from '@/components/Preferences/PreferencesTopbar';
import { CLASSES } from '@/constants/classes';

import '@/style/pages/Preferences/Page.scss';

/**
 * Preferences page — sidebar navigation is handled by the main sidebar overlay.
 */
export default function PreferencesPage() {
  return (
    <ErrorBoundary FallbackComponent={DashboardErrorBoundary}>
      <div
        className={classNames(
          CLASSES.DASHBOARD_CONTENT,
          CLASSES.DASHBOARD_CONTENT_PREFERENCES,
        )}
      >
        <div className={classNames(CLASSES.PREFERENCES_PAGE)}>
          <div className={CLASSES.PREFERENCES_PAGE_CONTENT}>
            <PreferencesTopbar />
            <PreferencesContentRoute />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
