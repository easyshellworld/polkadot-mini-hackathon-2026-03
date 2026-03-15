'use client';

import { useEffect, useState } from 'react';
import Giscus from '@giscus/react';
import { GiscusConfig } from '../lib/giscus-config';

interface GiscusCommentsProps {
  config: GiscusConfig;
  className?: string;
}

export function GiscusComments({ config, className = '' }: GiscusCommentsProps) {
  const [theme, setTheme] = useState('preferred_color_scheme');

  // 根据系统主题设置 giscus 主题
  useEffect(() => {
    const getTheme = () => {
      if (config.theme === 'preferred_color_scheme') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return config.theme || 'preferred_color_scheme';
    };

    setTheme(getTheme());

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      if (config.theme === 'preferred_color_scheme') {
        setTheme(getTheme());
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [config.theme]);

  return (
    <div className={`giscus-container ${className}`}>
      <Giscus
        repo={config.repo || 'openpick/openpick-discussions'}
        repoId={config.repoId || 'R_kgDOPodq0Q'}
        category={config.category || 'General'}
        categoryId={config.categoryId || 'DIC_kwDOPodq0c4Cu4XR'}
        mapping={config.mapping || 'pathname'}
        term={config.term || ''}
        strict={config.strict || '0'}
        reactionsEnabled={config.reactionsEnabled || '1'}
        emitMetadata={config.emitMetadata || '0'}
        inputPosition={config.inputPosition || 'bottom'}
        theme={theme || 'preferred_color_scheme'}
        lang={config.lang || 'en'}
      />
    </div>
  );
}