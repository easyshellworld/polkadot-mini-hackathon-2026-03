'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface HtmlLangUpdaterProps {
  locale?: string;
}

export default function HtmlLangUpdater({ locale: propLocale }: HtmlLangUpdaterProps) {
  const pathname = usePathname();
  
  useEffect(() => {
    // 使用传入的locale参数，如果没有则从pathname中提取
    const locale = propLocale || pathname.split('/')[1] || 'en';
    console.log('HtmlLangUpdater: Setting lang to', locale);
    document.documentElement.lang = locale;
  }, [pathname, propLocale]);

  return null;
}