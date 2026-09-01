import moment from 'moment';
import React, { useCallback, useEffect } from 'react';
import { JournalSheetLoadingBar, JournalSheetAlerts } from './components';
import { JournalActionsBar } from './JournalActionsBar';
import { JournalBody } from './JournalBody';
import { JournalDialogs } from './JournalDialogs';
import { JournalHeader } from './JournalHeader';
import { JournalSheetProvider } from './JournalProvider';
import { useJournalQuery } from './utils';
import { withJournalActions } from './withJournalActions';
import type { WithJournalActionsProps } from './withJournalActions';
import { FinancialStatement, DashboardPageContent } from '@/components';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { TransactionDetailDrawers } from '@/containers/FinancialStatements/TransactionDetailDrawers';
import { compose } from '@/utils';

type JournalProps = WithJournalActionsProps;

/**
 * Journal sheet.
 */
function JournalInner({
  // #withJournalActions
  toggleJournalSheetFilter,
}: JournalProps) {
  const { query, setLocationQuery } = useJournalQuery();

  // Handle financial statement filter change.
  const handleFilterSubmit = useCallback(
    (filter: Record<string, unknown>) => {
      const _filter = {
        ...filter,
        fromDate: moment(filter.fromDate as string).format('YYYY-MM-DD'),
        toDate: moment(filter.toDate as string).format('YYYY-MM-DD'),
      };
      setLocationQuery(_filter);
    },
    [setLocationQuery],
  );
  // Hide the journal sheet filter drawer once the page unmount.
  useEffect(
    () => () => {
      toggleJournalSheetFilter(false);
    },
    [toggleJournalSheetFilter],
  );

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <JournalSheetProvider query={query as any}>
      <JournalActionsBar />

      <DashboardPageContent>
        <FinancialStatement>
          <JournalHeader
            onSubmitFilter={handleFilterSubmit}
            pageFilter={query}
          />
          <JournalSheetLoadingBar />
          <JournalSheetAlerts />
          <JournalBody />
        </FinancialStatement>
      </DashboardPageContent>

      <JournalDialogs />

      <TransactionDetailDrawers />
    </JournalSheetProvider>
  );
}

export const Journal = compose(
  withDashboardActions,
  withJournalActions,
)(JournalInner);
