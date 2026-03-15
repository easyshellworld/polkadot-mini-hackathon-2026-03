'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  hasPrev,
  hasNext,
  onPageChange
}) => {
  const t = useTranslations('leaderboard');

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    // If total pages is small, show all pages
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show current page with some surrounding pages
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 sm:px-6 rounded-lg shadow-md">
      <div className="flex items-center">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {t('pageOf', {
            current: currentPage,
            total: totalPages
          })}
        </p>
      </div>
      <div className="flex-1 flex justify-center sm:justify-end">
        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          {/* Previous Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrev}
            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors duration-200 ${!hasPrev ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="sr-only">{t('prevPage')}</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Page Numbers */}
          {pageNumbers.map((page, index) => (
            <React.Fragment key={index}>
              {typeof page === 'number' ? (
                <button
                  onClick={() => onPageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 border ${page === currentPage ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'} text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors duration-200`}
                >
                  {page}
                </button>
              ) : (
                <span className="relative inline-flex items-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {page}
                </span>
              )}
            </React.Fragment>
          ))}
          
          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext}
            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors duration-200 ${!hasNext ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="sr-only">{t('nextPage')}</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Pagination;
