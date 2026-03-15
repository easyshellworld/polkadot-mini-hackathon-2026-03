'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface InputAreaProps {
  onSendMessage: (message: string, attachments?: Array<{url: string, type: string}>) => void;
}

export default function InputArea({ onSendMessage }: InputAreaProps) {
  const t = useTranslations('chat');
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<Array<{url: string, type: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cleanup object URLs when attachments change or component unmounts
  useEffect(() => {
    return () => {
      attachments.forEach(attachment => {
        URL.revokeObjectURL(attachment.url);
      });
    };
  }, [attachments]);

  const handleSendMessage = () => {
    if (inputValue.trim() || attachments.length > 0) {
      setIsSending(true);
      onSendMessage(inputValue.trim(), attachments);
      setInputValue('');
      // Cleanup attachments after sending
      attachments.forEach(attachment => {
        URL.revokeObjectURL(attachment.url);
      });
      setAttachments([]);
      setTimeout(() => setIsSending(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: Array<{url: string, type: string}> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        newAttachments.push({
          url,
          type: file.type
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      // Get the attachment to remove
      const attachmentToRemove = prev[index];
      // Cleanup the object URL
      URL.revokeObjectURL(attachmentToRemove.url);
      // Return new array without the removed attachment
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      {attachments.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {attachments.map((attachment, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded bg-zinc-100 dark:bg-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-500">{attachment.type}</span>
              <span className="text-sm font-medium">{attachment.url.split('/').pop()}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                aria-label="Remove attachment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center"
          aria-label={t('attach')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          className="flex-1 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32"
          rows={1}
        />
        <button
          onClick={handleSendMessage}
          disabled={isSending || (!inputValue.trim() && attachments.length === 0)}
          className={`p-3 rounded-full transition-colors ${isSending || (!inputValue.trim() && attachments.length === 0)
              ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
            } flex items-center justify-center`}
          aria-label={t('send')}
        >
          {isSending ? (
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
        <button
          className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center"
          aria-label={t('voice')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}