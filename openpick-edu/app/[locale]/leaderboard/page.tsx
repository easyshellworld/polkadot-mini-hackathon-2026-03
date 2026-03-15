'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import LeaderboardTable from '../../../components/LeaderboardTable';
import Pagination from '../../../components/Pagination';

interface LeaderboardUser {
  rank: number;
  walletAddress: string;
  originalAddress: string;
  score: number;
  entriesCount: number;
  lastInteraction: string;
  firstInteraction: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardUser[];
  pagination: PaginationInfo;
}

export default function Leaderboard() {
  const t = useTranslations('leaderboard');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch leaderboard data
  const fetchLeaderboard = async (page: number = 1, search: string = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setLeaderboardData(result.data);
      } else {
        setError(t('error'));
      }
    } catch (err) {
      setError(t('error'));
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and when page or search term changes
  useEffect(() => {
    fetchLeaderboard(currentPage, searchTerm);
  }, [currentPage]);

  // Debounce search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      fetchLeaderboard(1, searchTerm);
      setCurrentPage(1);
    }, 300);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchTerm]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          {/* <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('subtitle', {
                totalUsers: leaderboardData?.pagination.totalUsers || 0
              })}
            </p>
          </div> */}

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full px-4 py-3 pl-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {/* Leaderboard Content */}
          {loading ? (
            // Loading Skeleton
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6">
              <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4"></div>
                    </div>
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            // Error State
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-8 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => fetchLeaderboard(currentPage, searchTerm)}
                className="px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors duration-300"
              >
                {t('retry')}
              </button>
            </div>
          ) : leaderboardData && leaderboardData.leaderboard.length > 0 ? (
            // Leaderboard Table and Pagination
            <>
              <LeaderboardTable leaderboard={leaderboardData.leaderboard} />
              <div className="mt-6">
                <Pagination
                  currentPage={leaderboardData.pagination.currentPage}
                  totalPages={leaderboardData.pagination.totalPages}
                  hasPrev={leaderboardData.pagination.hasPrev}
                  hasNext={leaderboardData.pagination.hasNext}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          ) : (
            // Empty State
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-8 text-center">
              <p className="text-zinc-600 dark:text-zinc-400">{t('noData')}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
