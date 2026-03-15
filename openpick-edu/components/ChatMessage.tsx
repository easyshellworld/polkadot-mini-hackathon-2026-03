'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MessageAction {
  id: string;
  label: string;
  type: string;
}

interface ChatMessageProps {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  attachments?: Array<{url: string, type: string}>;
  actions?: MessageAction[];
}

export default function ChatMessage({ role, content, timestamp, attachments, actions }: ChatMessageProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className={`flex gap-3 mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex flex-col gap-1 max-w-[80%] ${
        role === 'user'
          ? 'items-end ml-auto'
          : 'items-start mr-auto'
      }`}>
        <div className={`px-4 py-3 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md ${
          role === 'user'
            ? 'bg-blue-50 text-blue-900 dark:bg-blue-900 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-800'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        }`}>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap animate-fadeIn">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded bg-white dark:bg-zinc-700 shadow-sm hover:shadow-md transition-all duration-300">
                  <span className="text-xs text-zinc-500">{attachment.type}</span>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                  >
                    {attachment.url.split('/').pop()}
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* 渲染消息中的按钮 */}
          {actions && actions.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap animate-fadeIn">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    // 创建自定义事件，将action信息传递给父组件
                    const event = new CustomEvent('messageAction', {
                      detail: action
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors duration-300 shadow-sm hover:shadow-md"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-500 opacity-70">
          {isClient ? timestamp.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }) : ''}
        </span>
      </div>
    </div>
  );
}