import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'zh'],
  defaultLocale: 'en',
  // 移除 localePrefix: 'as-needed' 配置，确保所有路由都需要locale前缀
  pathnames: {
    // 可以在这里定义路径名映射，例如：
    // '/': '/',
    // '/about': '/about'
  }
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);