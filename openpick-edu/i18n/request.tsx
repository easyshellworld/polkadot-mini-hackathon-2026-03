import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  // Ensure locale is a string, default to 'en' if undefined
  const resolvedLocale = locale || 'en';
  return {
    locale: resolvedLocale,
    messages: {
      common: (await import(`../public/locales/${resolvedLocale}/common.json`)).default,
      chat: (await import(`../public/locales/${resolvedLocale}/chat.json`)).default,
      wallet: (await import(`../public/locales/${resolvedLocale}/wallet.json`)).default,
      mint: (await import(`../public/locales/${resolvedLocale}/mint.json`)).default,
      leaderboard: (await import(`../public/locales/${resolvedLocale}/leaderboard.json`)).default,
      counselors: (await import(`../public/locales/${resolvedLocale}/counselors.json`)).default,
      // settings: (await import(`../public/locales/${resolvedLocale}/settings.json`)).default,
      discussions: (await import(`../public/locales/${resolvedLocale}/discussions.json`)).default,
    },
  };
});