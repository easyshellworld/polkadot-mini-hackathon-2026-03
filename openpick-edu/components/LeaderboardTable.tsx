'use client';

import { useTranslations } from 'next-intl';

interface LeaderboardUser {
  rank: number;
  walletAddress: string;
  originalAddress: string;
  score: number;
  entriesCount: number;
  lastInteraction: string;
  firstInteraction: string;
}

interface LeaderboardTableProps {
  leaderboard: LeaderboardUser[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ leaderboard }) => {
  const t = useTranslations('leaderboard');

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('rank')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('members')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('score')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('entries')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('last')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t('join')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
            {leaderboard.map((user) => (
              <tr
                key={user.originalAddress}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors duration-200"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className={`text-sm font-medium ${user.rank <= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {user.rank}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {user.walletAddress}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {user.score}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">
                      {user.entriesCount}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.lastInteraction}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.firstInteraction}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardTable;
