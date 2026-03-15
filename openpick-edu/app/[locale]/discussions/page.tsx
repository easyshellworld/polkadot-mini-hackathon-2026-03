'use client';

import { GiscusComments } from '../../../components/GiscusComments';
import { GiscusConfig } from '../../../lib/giscus-config';
import { useTranslations } from 'next-intl';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';

export default function DiscussionsPage() {
  const t = useTranslations('discussions');
  
  // 默认配置
  const giscusConfig: GiscusConfig = {
    repo: 'openpick/openpick-discussions' as `${string}/${string}`,
    repoId: 'R_kgDOPodq0Q',
    category: 'General',
    categoryId: 'DIC_kwDOPodq0c4Cu4XR',
    mapping: 'pathname',
    term: '',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'bottom',
    theme: 'preferred_color_scheme' as const,
    lang: 'en',
    lazyLoading: true
  };
  
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{t('joinDiscussion')}</h2>
            <GiscusComments config={giscusConfig} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}