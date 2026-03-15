'use client';

import { useState, useEffect } from 'react';
import { useCounselor } from '@/hooks/useCounselor';

interface ServiceStatusProps {
  order: {
    id: number;
    counselor_name: string;
    expires_at: string;
    status: string;
  };
  onStatusChange: () => void;
}

export default function ServiceStatus({ order, onStatusChange }: ServiceStatusProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const { confirmOrder, rejectOrder } = useCounselor();

  useEffect(() => {
    const remaining = Math.max(0, 
      Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000)
    );
    setRemainingSeconds(remaining);

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order.expires_at]);

  const formatTime = (s: number) => {
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    
    if (days > 0) return `${days}天 ${hours}时 ${minutes}分`;
    if (hours > 0) return `${hours}时 ${minutes}分`;
    if (minutes > 0) return `${minutes}分`;
    return `${s}秒`;
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmOrder(order.id);
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('请填写拒绝原因');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await rejectOrder(order.id, rejectionReason);
      setShowRejectModal(false);
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (order.status !== 'paid') {
    return (
      <div className={`px-3 py-1 rounded text-sm font-medium ${
        order.status === 'completed' 
          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      }`}>
        {order.status === 'completed' ? '服务已完成' : '服务已拒绝'}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          剩余时间: <span className="font-medium text-zinc-900 dark:text-white">{formatTime(remainingSeconds)}</span>
        </div>
        
        {error && (
          <div className="p-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button 
            onClick={handleConfirm} 
            disabled={loading}
            className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            确认完成服务
          </button>
          <button 
            onClick={() => setShowRejectModal(true)} 
            disabled={loading}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            拒绝
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">拒绝完成服务</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-3">请说明无法确认服务完成的原因：</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="例如：顾问未在约定时间内回复，无法完成咨询服务"
              rows={4}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white resize-none"
            />
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 mb-4">
              注意：拒绝后订单状态将变为 rejected，退款需联系客服人工处理
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setError(null);
                }}
                className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleReject} 
                disabled={loading || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
