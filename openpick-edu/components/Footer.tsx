'use client';

import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('common');

  return (
    <footer className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="container mx-auto flex items-center justify-between text-sm text-zinc-500">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>{t('network')}:</span>
            <span className="font-mono">Ethereum</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{t('gasPrice')}:</span>
            <span className="font-mono">10 Gwei</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>{t('version')}:</span>
            <span>1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}