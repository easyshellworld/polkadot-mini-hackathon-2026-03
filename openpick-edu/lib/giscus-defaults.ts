import { GiscusConfig } from './giscus-config';

export const defaultGiscusConfig: GiscusConfig = {
  repo: 'owner/repo' as `${string}/${string}`,
  repoId: '',
  category: 'General',
  categoryId: '',
  mapping: 'pathname',
  term: '',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'bottom',
  theme: 'preferred_color_scheme',
  lang: 'en',
  lazyLoading: true
};