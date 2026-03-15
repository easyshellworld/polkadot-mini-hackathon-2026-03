'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '../contexts/WalletContext';
import { useAdmin } from '../hooks/useAdmin';
import SettingsModal from './SettingsModal';

export default function Header() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { wallet, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const { isAdmin } = useAdmin();

  const toggleLanguage = () => {
    const currentLocale = pathname.split('/')[1];
    const newLocale = currentLocale === 'en' ? 'zh' : 'en';
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold transition-transform duration-300 hover:scale-105">OpenPick</h1>
          <nav className="hidden md:flex items-center gap-6">
            <a
              href={`/${pathname.split('/')[1]}`}
              className={`text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 ${
                pathname === `/${pathname.split('/')[1]}` || pathname === `/${pathname.split('/')[1]}/`
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {t('home')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/counselors`}
              className={`text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 ${
                pathname.includes('/counselors')
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {t('counselors')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/discussions`}
              className={`text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 ${
                pathname.includes('/discussions')
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {t('discussions')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/leaderboard`}
              className={`text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 ${
                pathname.includes('/leaderboard')
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {t('leaderboard')}
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-300 hover:shadow-md"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
          <button
            onClick={toggleLanguage}
            className="px-3 py-1 rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-300 hover:shadow-md"
            aria-label="Toggle language"
          >
            {pathname.split('/')[1] === 'en' ? '中文' : 'English'}
          </button>
          {wallet ? (
            <div className="flex items-center gap-2 animate-fadeIn">
              <span className="text-sm font-medium truncate max-w-[150px] bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                {formatAddress(wallet.address)}
              </span>
              <button
                onClick={disconnectWallet}
                className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-all duration-300 hover:shadow-md"
              >
                {t('disconnect')}
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => connectWallet('injected')}
                disabled={isConnecting}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:shadow-md ${
                  isConnecting
                    ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                }`}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('loading')}
                  </span>
                ) : t('connect')}
              </button>
              {/* WalletConnect button can be added here in a dropdown menu */}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-300 hover:shadow-md"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 transition-all duration-300">
          <div className="container mx-auto px-4 py-3 space-y-2">
            <a
              href={`/${pathname.split('/')[1]}`}
              className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 ${
                pathname === `/${pathname.split('/')[1]}` || pathname === `/${pathname.split('/')[1]}/`
                  ? 'text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('home')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/counselors`}
              className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 ${
                pathname.includes('/counselors')
                  ? 'text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('counselors')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/discussions`}
              className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 ${
                pathname.includes('/discussions')
                  ? 'text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('discussions')}
            </a>
            <a
              href={`/${pathname.split('/')[1]}/leaderboard`}
              className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 ${
                pathname.includes('/leaderboard')
                  ? 'text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('leaderboard')}
            </a>
          </div>
        </div>
      )}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}