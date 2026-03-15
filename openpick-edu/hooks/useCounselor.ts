'use client';

import { useWallet } from '@/contexts/WalletContext';

export function useCounselor() {
  const { wallet } = useWallet();

  const getCounselorInfo = async (counselorId: number) => {
    const response = await fetch(`/api/counselors/${counselorId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get counselor info');
    }
    
    return response.json();
  };

  const purchaseCounselor = async (counselorId: number) => {
    if (!wallet?.address) {
      throw new Error('Wallet not connected');
    }

    const response = await fetch(`/api/counselors/${counselorId}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userWalletAddress: wallet.address
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Purchase failed');
    }
    
    return response.json();
  };

  const downloadCounselorInfo = async (counselorId: number) => {
    const response = await fetch(`/api/counselors/${counselorId}/download`, {
      headers: {
        'x-wallet-address': wallet?.address || ''
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to download counselor info');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counselor_info_${counselorId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const confirmOrder = async (orderId: number) => {
    const response = await fetch(`/api/counselors/orders/${orderId}/complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-wallet-address': wallet?.address || ''
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm order');
    }
    
    return response.json();
  };

  const rejectOrder = async (orderId: number, rejectionReason: string) => {
    const response = await fetch(`/api/counselors/orders/${orderId}/reject`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-wallet-address': wallet?.address || ''
      },
      body: JSON.stringify({ 
        rejectionReason 
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject order');
    }
    
    return response.json();
  };

  return { 
    getCounselorInfo, 
    purchaseCounselor,
    downloadCounselorInfo, 
    confirmOrder, 
    rejectOrder 
  };
}
