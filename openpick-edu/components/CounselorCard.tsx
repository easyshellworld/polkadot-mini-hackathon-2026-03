'use client';

import { useState } from 'react';
import { useCounselor } from '@/hooks/useCounselor';
import { useWallet } from '@/contexts/WalletContext';

interface Counselor {
  id: number;
  name: string;
  skills: Array<{ name: string; level: string }>;
  remark: string;
  priceUsd: number;
  servedTimes: number;
}

interface CounselorCardProps {
  counselor: Counselor;
  activeOrder: any;
  onPurchaseSuccess: () => void;
}

export default function CounselorCard({ counselor, activeOrder, onPurchaseSuccess }: CounselorCardProps) {
  const { wallet, connectWallet } = useWallet();
  const { purchaseCounselor, downloadCounselorInfo } = useCounselor();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!wallet) {
      connectWallet('injected');
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const result = await purchaseCounselor(counselor.id);
      setPurchaseResult(result.data);
      onPurchaseSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '购买失败');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadCounselorInfo(counselor.id);
      setShowPurchaseModal(false);
      setPurchaseResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {counselor.name}
            </h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {counselor.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm"
                >
                  {skill.name} - {skill.level}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${counselor.priceUsd}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              已服务 {counselor.servedTimes} 次
            </div>
          </div>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400 mb-4">{counselor.remark}</p>

        {activeOrder ? (
          <div className="text-green-600 dark:text-green-400 font-medium">
            ✓ 已购买此顾问的咨询服务
          </div>
        ) : (
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors font-medium"
          >
            获取顾问信息
          </button>
        )}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6">
            {!purchaseResult ? (
              <>
                <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">
                  购买咨询服务
                </h3>
                <div className="mb-4">
                  <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                    顾问: <span className="font-medium text-zinc-900 dark:text-white">{counselor.name}</span>
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                    价格: <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${counselor.priceUsd} USDC</span>
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    服务期限：7天
                  </p>
                </div>
                {error && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                    {error}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPurchasing ? '处理中...' : '确认购买'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold mb-4 text-green-600 dark:text-green-400">
                  ✓ 购买成功！
                </h3>
                <div className="mb-4 space-y-2">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">顾问信息</p>
                    <p className="font-medium text-zinc-900 dark:text-white">姓名: {purchaseResult.name}</p>
                    <p className="text-zinc-900 dark:text-white">技能: {purchaseResult.skills.map((s: any) => s.name).join(', ')}</p>
                    <p className="text-zinc-900 dark:text-white">Telegram: {purchaseResult.telegram}</p>
                    <p className="text-zinc-900 dark:text-white">WeChat: {purchaseResult.wechat}</p>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    服务到期: {new Date(purchaseResult.expiresAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                  >
                    下载详细信息
                  </button>
                  <button
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setPurchaseResult(null);
                    }}
                    className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
