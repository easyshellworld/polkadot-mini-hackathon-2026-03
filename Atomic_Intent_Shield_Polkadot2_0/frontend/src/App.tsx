import React, { useState } from 'react';
import { PolkadotProvider } from './providers/PolkadotProvider';
import { EvmProvider } from './providers/EvmProvider';
import TradePanel from './components/TradePanel';
import AdminDashboard from './components/AdminDashboard';

type Page = 'trade' | 'transaction';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('trade');

  return (
    <PolkadotProvider>
      <EvmProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <main className="container mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2">
                Atomic Intent <span className="text-pink-500">Shield</span>
              </h1>
              <p className="text-gray-400 text-lg">
                A ZK-Powered Intent Layer for Private, MEV-Free Swaps on Polkadot Revive
              </p>
              {/* Page tabs */}
              <div className="flex justify-center mt-4 space-x-2">
                <button
                  onClick={() => setPage('trade')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    page === 'trade' ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Trade
                </button>
                <button
                  onClick={() => setPage('transaction')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    page === 'transaction' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Transaction
                </button>
              </div>
            </div>

            {page === 'trade' ? (
              <div className="max-w-3xl mx-auto">
                <TradePanel />
              </div>
            ) : (
              <AdminDashboard />
            )}
          </main>
        </div>
      </EvmProvider>
    </PolkadotProvider>
  );
};

export default App;
