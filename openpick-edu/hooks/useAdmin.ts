'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';

/**
 * useAdmin Hook - 检查当前用户是否为管理员
 * 
 * 注意：此Hook通过调用后端API来验证管理员权限，而不是在前端检查环境变量。
 * 这样可以避免在客户端暴露管理员地址，提高安全性。
 */
export const useAdmin = () => {
  const { wallet } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!wallet?.address) {
        setIsAdmin(false);
        return;
      }
      
      setIsChecking(true);
      try {
        // 调用后端API验证管理员权限
        const response = await fetch('/api/admin/verify', {
          method: 'GET',
          headers: {
            'x-wallet-address': wallet.address,
          },
        });
        
        const data = await response.json();
        setIsAdmin(data.isAdmin || false);
      } catch (error) {
        console.error('Failed to verify admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAdminStatus();
  }, [wallet?.address]);
  
  return { isAdmin, isChecking };
};