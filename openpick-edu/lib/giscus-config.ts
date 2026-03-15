export interface GiscusConfig {
  repo: `${string}/${string}`;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: 'pathname' | 'url' | 'title' | 'og:title' | 'specific';
  term?: string;
  strict?: '0' | '1';
  reactionsEnabled?: '0' | '1';
  emitMetadata?: '0' | '1';
  inputPosition?: 'top' | 'bottom';
  theme?: 'light' | 'dark' | 'dark_dimmed' | 'transparent_dark' | 'preferred_color_scheme';
  lang?: string;
  lazyLoading?: boolean;
}

export const saveGiscusConfig = (config: GiscusConfig): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('giscus-config', JSON.stringify(config));
  }
};

export const loadGiscusConfig = (): GiscusConfig | null => {
  if (typeof window !== 'undefined') {
    const config = localStorage.getItem('giscus-config');
    return config ? JSON.parse(config) : null;
  }
  return null;
};

export const clearGiscusConfig = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('giscus-config');
  }
};