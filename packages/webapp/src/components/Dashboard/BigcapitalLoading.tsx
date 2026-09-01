import classNames from 'classnames';
import React from 'react';
import { BigcapitalAlt } from '@/components/Icons/BigcapitalAlt';
import { useIsDarkMode } from '@/hooks/useDarkMode';

import '@/style/components/BigcapitalLoading.scss';

interface BigcapitalLoadingProps {
  className?: string;
}

/**
 * KCT Financials logo loading screen.
 */
export default function BigcapitalLoading({
  className,
}: BigcapitalLoadingProps) {
  const isDarkmode = useIsDarkMode();

  return (
    <div className={classNames('bigcapital-loading', className)}>
      <div className="center">
        <BigcapitalAlt
          height={37}
          width={228}
          color={isDarkmode ? '#fff' : undefined}
          className="bigcapital-logo"
        />
      </div>
    </div>
  );
}
