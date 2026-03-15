'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CounselorCard from '@/components/CounselorCard';
import ServiceStatus from '@/components/ServiceStatus';
import AddCounselorModal from '@/components/AddCounselorModal';

export default function CounselorsPage() {
  const t = useTranslations('counselors');
  const { wallet } = useWallet();
  const { isAdmin } = useAdmin();
  const [counselors, setCounselors] = useState([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchCounselors();
    if (wallet?.address) {
      fetchActiveOrders(wallet.address);
    }
  }, [wallet?.address]);

  const fetchCounselors = async () => {
    try {
      const res = await fetch('/api/counselors');
      const data = await res.json();
      setCounselors(data.data.counselors || []);
    } catch (error) {
      console.error('Failed to fetch counselors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveOrders = async (userWalletAddress: string) => {
    try {
      const res = await fetch('/api/counselors/orders', {
        headers: {
          'x-wallet-address': userWalletAddress,
        },
      });
      const data = await res.json();
      setActiveOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const getActiveOrderForCounselor = (counselorId: number) => {
    return activeOrders.find((order: any) => 
      order.counselor_id === counselorId && 
      (order.status === 'paid' || order.status === 'completed')
    );
  };

  const handlePurchaseSuccess = () => {
    if (wallet?.address) {
      fetchActiveOrders(wallet.address);
    }
  };

  const handleStatusChange = () => {
    if (wallet?.address) {
      fetchActiveOrders(wallet.address);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center text-zinc-600 dark:text-zinc-400">
            {t('loading')}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
              {t('title')}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('subtitle')}
            </p>
          </div>

          {/* 管理员按钮区域 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              {wallet?.address && activeOrders.length > 0 && (
                <button
                  onClick={() => setShowMyOrders(!showMyOrders)}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors font-medium"
                >
                  {showMyOrders ? t('hideMyOrders') : `${t('viewMyOrders')} (${activeOrders.length})`}
                </button>
              )}
            </div>
            
            {/* 添加顾问按钮 - 仅管理员可见 */}
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                {t('addNewCounselor')}
              </button>
            )}
          </div>

          {showMyOrders && wallet?.address && (
            <div className="mb-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
                {t('myOrders')}
              </h2>
              <div className="space-y-4">
                {activeOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                          {order.counselor_name}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {t('orderId')}: {order.id}
                        </p>
                      </div>
                    </div>
                    <ServiceStatus order={order} onStatusChange={handleStatusChange} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {counselors.map((counselor: any) => (
              <CounselorCard
                key={counselor.id}
                counselor={counselor}
                activeOrder={getActiveOrderForCounselor(counselor.id)}
                onPurchaseSuccess={handlePurchaseSuccess}
              />
            ))}
          </div>

          {counselors.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-600 dark:text-zinc-400 text-lg">
                {t('noCounselorsAvailable')}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
      
      {/* 添加顾问模态框 */}
      <AddCounselorModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchCounselors();
        }}
      />
    </div>
  );
}
