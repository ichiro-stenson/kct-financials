import intl from 'react-intl-universal';

export const getFooterLinks = (): Array<{ title: string; link: string }> => [
  {
    title: intl.get('support'),
    link: 'mailto:ichiro@kingcapitalgrp.com',
  },
];
