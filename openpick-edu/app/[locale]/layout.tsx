import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { ClientWrapper } from './ClientWrapper';
import HtmlLangUpdater from '@/components/HtmlLangUpdater';

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  
  // 确保locale是有效的
  const validLocale = ['en', 'zh'].includes(locale) ? locale : 'en';
  
  // 使用validLocale获取消息
  const messages = await getMessages({ locale: validLocale });

  return (
    <NextIntlClientProvider messages={messages} locale={validLocale}>
      <HtmlLangUpdater locale={validLocale} />
      <ClientWrapper>
        {children}
      </ClientWrapper>
    </NextIntlClientProvider>
  );
}