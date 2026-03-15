'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAIConfig } from '../contexts/AIConfigContext';
import { useWallet } from '../contexts/WalletContext';
import { createCollection, mintNFT } from '../lib/contract';
import ChatMessage from './ChatMessage';
import InputArea from './InputArea';
import ContractModal from './ContractModal';

interface MessageAction {
  id: string;
  label: string;
  type: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  attachments?: Array<{url: string, type: string}>;
  actions?: MessageAction[];
}

export default function ChatContainer() {
  const t = useTranslations('chat');
  const locale = useLocale();
  const { defaultModel } = useAIConfig();
  const { wallet, connectWallet } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 初始化和更新欢迎消息
  useEffect(() => {
    // 使用翻译函数获取欢迎消息
    const welcomeMessage = t('welcome');
    
    // 直接设置消息，不依赖之前的状态
    setMessages([{
      id: 'welcome',
      role: 'bot' as const,
      content: welcomeMessage,
      timestamp: new Date()
    }]);
    
    setIsInitialized(true);
  }, [locale, t]); // 依赖locale和t函数
  
  // 控制快速操作按钮的显示
  const showQuickActions = messages.length === 1 && messages[0].id === 'welcome';
  
  // NFT创建弹窗状态
  const [isNFTModalOpen, setIsNFTModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'create' | 'mint'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [nftForm, setNftForm] = useState({
    name: '',
    symbol: '',
    baseURI: ''
  });
  const [error, setError] = useState<string | null>(null);
  
  // 自定义合约弹窗状态
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  
  // "即将到来"模态框状态
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState('');
  
  // 跟踪已点击的快速操作按钮
  const [clickedButtons, setClickedButtons] = useState<Set<string>>(new Set());
  
  // 用于生成唯一ID的计数器
  const [messageIdCounter, setMessageIdCounter] = useState(0);

  // 生成唯一消息ID的函数
  const generateMessageId = () => {
    const newId = `${Date.now()}-${messageIdCounter}`;
    setMessageIdCounter(prev => prev + 1);
    return newId;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup all attachment URLs when messages change or component unmounts
  useEffect(() => {
    return () => {
      messages.forEach(message => {
        if (message.attachments) {
          message.attachments.forEach(attachment => {
            URL.revokeObjectURL(attachment.url);
          });
        }
      });
    };
  }, [messages]);

  const scrollToBottom = () => {
    // Add debounce to avoid frequent scroll calls
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages]);

  // 处理快速操作按钮点击，发送消息并更新项目完成状态
  const handleQuickActionClick = async (buttonText: string) => {
    // 检查钱包连接状态
    if (!wallet?.address) {
      // 如果没有连接钱包，尝试连接钱包
      try {
        await connectWallet('injected');
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        // 显示错误消息
        const errorMessage: Message = {
          id: generateMessageId(),
          role: 'bot',
          content: t('connectWalletRequired') || '请先连接您的钱包',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
    }
    
    handleSendMessage(buttonText);
    // 将点击的按钮添加到已点击集合中
    setClickedButtons(prev => new Set(prev).add(buttonText));
    
    // 更新用户项目完成状态
    if (wallet?.address) {
      try {
        // 映射按钮文本到项目名称
        const projectNameMap: Record<string, string> = {
          [t('whatIsNFT')]: 'whatIsNFT',
          [t('nftUseCases')]: 'nftUseCases',
          [t('mintMyNFT')]: 'mintMyNFT',
          // [t('customNFTContract')]: 'customNFTContract',
          // [t('buildAIWeb3Platform')]: 'buildAIWeb3Platform'
        };
        
        const projectName = projectNameMap[buttonText];
        if (projectName) {
          // 调用API更新用户项目完成状态
          const response = await fetch('/api/user-project-entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              walletAddress: wallet.address,
              projectName: projectName
            })
          });
          
          const result = await response.json();
          if (result.success) {
            console.log('Project completion updated successfully:', result.data);
            // 即使达到限制，也允许前端状态改变
            if (result.data.limitReached) {
              console.log('Project completion limit reached, but frontend state change allowed');
            }
          } else {
            console.error('Failed to update project completion:', result.error);
          }
        }
      } catch (error) {
        console.error('Error updating project completion:', error);
      }
    }
  };

  // 快速操作按钮的显示文本与实际发送的消息映射
  const quickActionMessages = {
    [t('whatIsNFT')]: locale === 'zh' ? '用最简单的方式解释NFT是什么' : 'Explain what NFT is in the simplest way',
    [t('nftUseCases')]: locale === 'zh' ? '列举三个NFT的应用场景' : 'List the three most common use cases of NFT'
  };

  const handleSendMessage = async (content: string, attachments?: Array<{url: string, type: string}>) => {
    // 检查钱包连接状态
    if (!wallet?.address) {
      // 如果没有连接钱包，尝试连接钱包
      try {
        await connectWallet('injected');
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        // 显示错误消息
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: t('connectWalletRequired') || '请先连接您的钱包',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
    }

    // Check if we have a default model configured
    if (!defaultModel) {
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'bot',
        content: t('configureModelRequired'),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // 如果还没有初始化，先初始化欢迎消息
    if (!isInitialized) {
      const welcomeMessage = t('welcome');
      
      setMessages([{
        id: 'welcome',
        role: 'bot' as const,
        content: welcomeMessage,
        timestamp: new Date()
      }]);
      setIsInitialized(true);
      return; // 初始化后直接返回，不继续处理消息
    }

    // 检查是否是快速操作按钮的消息，如果是，则获取实际要发送的消息
    const actualMessage = quickActionMessages[content as keyof typeof quickActionMessages] || content;

    const newMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content, // 显示原始内容（按钮文本）
      timestamp: new Date(),
      attachments
    };

    // Add user message to the conversation
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];
      
      // 使用函数式更新来获取最新的消息列表
      return updatedMessages;
    });
    
    // 使用setTimeout确保状态更新后再发送请求
    setTimeout(async () => {
      try {
        // 获取最新的消息列表
        const currentMessages = await new Promise<Message[]>((resolve) => {
          setMessages(prev => {
            resolve(prev);
            return prev;
          });
        });
        
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: actualMessage, // 使用实际消息而不是显示文本
            history: currentMessages,
            model: defaultModel.model,
            apiKey: defaultModel.apiKey,
            endpoint: defaultModel.endpoint,
            locale
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        
        const botResponse: Message = {
          id: generateMessageId(),
          role: 'bot',
          content: data.response,
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, botResponse]);
      } catch (error) {
        console.error('Error getting AI response:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          role: 'bot',
          content: t('errorGettingResponse'),
          timestamp: new Date()
        };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      }
    }, 0);
  };



  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNftForm(prev => ({ ...prev, [name]: value }));
  };

  // 处理创建NFT集合
  const handleCreateCollection = async () => {
    if (!wallet?.provider || !nftForm.name || !nftForm.symbol) {
      setError(t('fillRequiredFields'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 调用createCollection函数
      const result = await createCollection({
        provider: wallet.provider,
        name: nftForm.name,
        symbol: nftForm.symbol,
        baseURI: nftForm.baseURI
      });

      // 存储collectionAddress到本地存储
      localStorage.setItem('collectionAddress', result.collectionAddress);

      // 在成功创建集合后调用handleQuickActionClick来更新mintMyNFT项目完成状态
      if (wallet.address) {
        try {
          // 调用API更新用户项目完成状态
          const response = await fetch('/api/user-project-entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              walletAddress: wallet.address,
              projectName: 'mintMyNFT'
            })
          });
          
          const apiResult = await response.json();
          if (apiResult.success) {
            console.log('mintMyNFT project completion updated successfully:', apiResult.data);
            // 更新按钮状态
            setClickedButtons(prev => new Set(prev).add(t('mintMyNFT')));
            // 即使达到限制，也允许前端状态改变
            if (apiResult.data.limitReached) {
              console.log('mintMyNFT project completion limit reached, but frontend state change allowed');
            }
          } else {
            console.error('Failed to update mintMyNFT project completion:', apiResult.error);
          }
        } catch (error) {
          console.error('Error updating mintMyNFT project completion:', error);
        }
      }

      // 切换到Mint NFT步骤
      setModalStep('mint');
    } catch (err) {
      console.error('Error creating collection:', err);
      setError(err instanceof Error ? err.message : t('failedToCreateCollection'));
    } finally {
      setIsLoading(false);
    }
  };

  // 处理Mint NFT
  const handleMintNFT = async (fromButton: boolean = false) => {
    if (!wallet?.provider || !wallet.address) {
      setError(t('connectWalletRequired'));
      return;
    }

    // 从本地存储读取collectionAddress
    const collectionAddress = localStorage.getItem('collectionAddress');
    if (!collectionAddress) {
      setError(t('noCollectionAddress'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 调用mintNFT函数
      const result = await mintNFT({
        provider: wallet.provider,
        contractAddress: collectionAddress,
        toAddress: wallet.address
      });

      // 只有在从弹窗调用时才关闭弹窗和重置状态
      if (!fromButton) {
        // 关闭弹窗
        setIsNFTModalOpen(false);
        
        // 重置状态
        setModalStep('create');
        setNftForm({ name: '', symbol: '', baseURI: '' });
      }
      
      // 如果是从按钮点击调用的，需要更新 mintNextNFT 的项目完成状态
      if (fromButton) {
        try {
          // 调用API更新用户项目完成状态
          const response = await fetch('/api/user-project-entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              walletAddress: wallet.address,
              projectName: 'mintNextNFT'
            })
          });
          
          const result = await response.json();
          if (result.success) {
            console.log('mintNextNFT project completion updated successfully:', result.data);
            // 即使达到限制，也允许前端状态改变
            if (result.data.limitReached) {
              console.log('mintNextNFT project completion limit reached, but frontend state change allowed');
            }
          } else {
            console.error('Failed to update mintNextNFT project completion:', result.error);
          }
        } catch (error) {
          console.error('Error updating mintNextNFT project completion:', error);
        }
      }
      
      // 添加系统消息，提示用户操作成功
      const successMessage: Message = {
        id: generateMessageId(),
        role: 'bot',
        content: `${t('nftCreatedSuccess')}\n- ${t('collectionAddress')}：${collectionAddress}\n- ${t('transactionHash')}：${result.transactionHash}\n- ${t('tokenId')}：${result.tokenId}`,
        timestamp: new Date(),
        actions: [{
          id: 'mint-next',
          label: t('mintNextNFT'),
          type: 'mintNextNFT'
        }]
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (err) {
      console.error('Error minting NFT:', err);
      setError(err instanceof Error ? err.message : t('failedToMintNFT'));
    } finally {
      setIsLoading(false);
    }
  };

  // 处理消息按钮点击事件
  useEffect(() => {
    const handleMessageAction = (event: CustomEvent) => {
      const action = event.detail;
      
      if (action && action.type === 'mintNextNFT') {
        // 铸造下一个NFT，传递fromButton=true表示从按钮点击
        handleMintNFT(true);
      }
    };
    
    // 添加事件监听器
    window.addEventListener('messageAction', handleMessageAction as EventListener);
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('messageAction', handleMessageAction as EventListener);
    };
  }, [handleMintNFT]); // 依赖handleMintNFT函数

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden dark:bg-zinc-950 dark:shadow-zinc-800">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map(message => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              attachments={message.attachments}
              actions={message.actions}
            />
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Quick action buttons above input area */}
      <div className="border-t border-zinc-200 px-4 py-2 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickActionClick(t('whatIsNFT'))}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${clickedButtons.has(t('whatIsNFT')) 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 cursor-default' 
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}`}
            disabled={clickedButtons.has(t('whatIsNFT'))}
          >
            {t('whatIsNFT')}
            {clickedButtons.has(t('whatIsNFT')) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
          <button
            onClick={() => handleQuickActionClick(t('nftUseCases'))}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${clickedButtons.has(t('nftUseCases')) 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 cursor-default' 
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}`}
            disabled={clickedButtons.has(t('nftUseCases'))}
          >
            {t('nftUseCases')}
            {clickedButtons.has(t('nftUseCases')) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
          <button
            onClick={async () => {
              // 检查钱包连接状态
              if (!wallet?.address) {
                // 如果没有连接钱包，尝试连接钱包
                try {
                  await connectWallet('injected');
                } catch (error) {
                  console.error('Failed to connect wallet:', error);
                  // 显示错误消息
                  const errorMessage: Message = {
                    id: generateMessageId(),
                    role: 'bot',
                    content: t('connectWalletRequired') || '请先连接您的钱包',
                    timestamp: new Date()
                  };
                  setMessages(prev => [...prev, errorMessage]);
                  return;
                }
              }
              
              // 只打开 NFT 创建弹窗，不调用 handleQuickActionClick
              setIsNFTModalOpen(true);
            }}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${clickedButtons.has(t('mintMyNFT')) 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 cursor-default' 
              : 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900 dark:text-sky-200 dark:hover:bg-sky-800'}`}
            disabled={clickedButtons.has(t('mintMyNFT'))}
          >
            {t('mintMyNFT')}
            {clickedButtons.has(t('mintMyNFT')) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
          <button
            onClick={async () => {
              // 检查钱包连接状态
              if (!wallet?.address) {
                // 如果没有连接钱包，尝试连接钱包
                try {
                  await connectWallet('injected');
                } catch (error) {
                  console.error('Failed to connect wallet:', error);
                  // 显示错误消息
                  const errorMessage: Message = {
                    id: generateMessageId(),
                    role: 'bot',
                    content: t('connectWalletRequired') || '请先连接您的钱包',
                    timestamp: new Date()
                  };
                  setMessages(prev => [...prev, errorMessage]);
                  return;
                }
              }
              
              // 打开自定义合约弹窗
              setIsContractModalOpen(true);
              // 将点击的按钮添加到已点击集合中
              setClickedButtons(prev => new Set(prev).add(t('customNFTContract')));
              
              // 更新用户项目完成状态
              if (wallet?.address) {
                try {
                  // 调用API更新用户项目完成状态
                  const response = await fetch('/api/user-project-entries', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      walletAddress: wallet.address,
                      projectName: 'customNFTContract'
                    })
                  });
                  
                  const result = await response.json();
                  if (result.success) {
                    console.log('customNFTContract project completion updated successfully:', result.data);
                    // 即使达到限制，也允许前端状态改变
                    if (result.data.limitReached) {
                      console.log('customNFTContract project completion limit reached, but frontend state change allowed');
                    }
                  } else {
                    console.error('Failed to update customNFTContract project completion:', result.error);
                  }
                } catch (error) {
                  console.error('Error updating customNFTContract project completion:', error);
                }
              }
            }}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${clickedButtons.has(t('customNFTContract')) 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 cursor-default' 
              : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900 dark:text-violet-200 dark:hover:bg-violet-800'}`}
            disabled={clickedButtons.has(t('customNFTContract'))}
          >
            {t('customNFTContract')}
            {clickedButtons.has(t('customNFTContract')) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
          <button
            onClick={async () => {
              // 检查钱包连接状态
              if (!wallet?.address) {
                // 如果没有连接钱包，尝试连接钱包
                try {
                  await connectWallet('injected');
                } catch (error) {
                  console.error('Failed to connect wallet:', error);
                  // 显示错误消息
                  const errorMessage: Message = {
                    id: generateMessageId(),
                    role: 'bot',
                    content: t('connectWalletRequired') || '请先连接您的钱包',
                    timestamp: new Date()
                  };
                  setMessages(prev => [...prev, errorMessage]);
                  return;
                }
              }
              
              setComingSoonTitle(t('buildAIWeb3Platform'));
              setIsComingSoonModalOpen(true);
              // 将点击的按钮添加到已点击集合中
              setClickedButtons(prev => new Set(prev).add(t('buildAIWeb3Platform')));
            }}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${clickedButtons.has(t('buildAIWeb3Platform')) 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 cursor-default' 
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'}`}
            disabled={clickedButtons.has(t('buildAIWeb3Platform'))}
          >
            {t('buildAIWeb3Platform')}
            {clickedButtons.has(t('buildAIWeb3Platform')) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <InputArea onSendMessage={handleSendMessage} />

      {/* NFT创建弹窗 */}
      {isNFTModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {modalStep === 'create' ? t('createNFTCollection') : t('mintNFT')}
              </h2>
              <button
                onClick={() => setIsNFTModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md dark:bg-red-900 dark:text-red-200">
                  {error}
                </div>
              )}

              {modalStep === 'create' ? (
                /* 创建NFT集合表单 */
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('name')} *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={nftForm.name}
                      onChange={handleInputChange}
                      placeholder={t('enterCollectionName')}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="symbol" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('symbol')} *
                    </label>
                    <input
                      type="text"
                      id="symbol"
                      name="symbol"
                      value={nftForm.symbol}
                      onChange={handleInputChange}
                      placeholder={t('enterCollectionSymbol')}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="baseURI" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('baseURI')} ({t('optional')})
                    </label>
                    <input
                      type="text"
                      id="baseURI"
                      name="baseURI"
                      value={nftForm.baseURI}
                      onChange={handleInputChange}
                      placeholder={t('enterBaseURI')}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {t('baseURIDescription')}
                    </p>
                  </div>
                </div>
              ) : (
                /* Mint NFT步骤 */
                <div className="text-center space-y-4">
                  <div className="text-4xl">
                    🎉
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                    {t('collectionCreatedSuccessfully')}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t('collectionCreatedDescription')}
                  </p>
                </div>
              )}
            </div>

            {/* 弹窗底部按钮 */}
            <div className="flex justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setIsNFTModalOpen(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={modalStep === 'create' ? handleCreateCollection : () => handleMintNFT()}
                disabled={isLoading}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${isLoading ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'}`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('processing')}
                  </span>
                ) : modalStep === 'create' ? t('confirm') : t('mintNFT')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* "即将到来"模态框 */}
      {isComingSoonModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {comingSoonTitle}
              </h2>
              <button
                onClick={() => setIsComingSoonModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* 模态框内容 */}
            <div className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <img src="/hamster-meme.svg" alt="Hamster Meme" className="max-w-full h-auto" style={{ maxWidth: '200px' }} />
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                {t('comingSoon')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('comingSoonDescription')}
              </p>
            </div>

            {/* 模态框底部按钮 */}
            <div className="flex justify-end p-6 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setIsComingSoonModalOpen(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 自定义合约弹窗 */}
      <ContractModal 
        isOpen={isContractModalOpen} 
        onClose={() => setIsContractModalOpen(false)} 
      />
    </div>
  );
}