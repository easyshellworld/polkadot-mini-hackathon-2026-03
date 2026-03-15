'use client';

import React, { useEffect } from 'react';
import { WalletProvider } from '@/contexts/WalletContext';
import { AIConfigProvider } from '@/contexts/AIConfigContext';

interface ClientWrapperProps {
  children: React.ReactNode;
}

export function ClientWrapper({ children }: ClientWrapperProps) {
  // useEffect(() => {
  //   // 全局错误处理程序，捕获来自外部脚本（如浏览器扩展）的错误
  //   const handleGlobalError = (event: ErrorEvent) => {
  //     // 检查错误是否来自inject.js或类似的注入脚本
  //     if (event.filename && event.filename.includes('inject.js')) {
  //       console.warn('捕获到来自外部脚本(inject.js)的错误，已阻止其影响应用:', event.error);
  //       event.preventDefault();
  //       event.stopPropagation();
  //       return false;
  //     }
      
  //     // 检查错误消息中是否包含className.indexOf
  //     if (event.message && event.message.includes('className.indexOf')) {
  //       console.warn('捕获到className.indexOf错误，已阻止其影响应用:', event.error);
  //       event.preventDefault();
  //       event.stopPropagation();
  //       return false;
  //     }
  //   };

  //   // 添加全局错误监听器
  //   window.addEventListener('error', handleGlobalError, true);
    
  //   // 添加未处理的Promise拒绝监听器
  //   const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  //     console.warn('捕获到未处理的Promise拒绝:', event.reason);
  //     event.preventDefault();
  //   };
    
  //   window.addEventListener('unhandledrejection', handleUnhandledRejection);

  //   // 清理函数
  //   return () => {
  //     window.removeEventListener('error', handleGlobalError, true);
  //     window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  //   };
  // }, []);

  return (
    <WalletProvider>
      <AIConfigProvider>
        {children}
      </AIConfigProvider>
    </WalletProvider>
  );
}
