'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ContractEditorProps {
  onCompile: (sourceCode: string) => void;
  isCompiling: boolean;
  compileResult: any;
}

const ContractEditor: React.FC<ContractEditorProps> = ({ 
  onCompile, 
  isCompiling, 
  compileResult 
}) => {
  const t = useTranslations('contract');
  const [sourceCode, setSourceCode] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('simple');
  const [isLoading, setIsLoading] = useState(false);

  const templates = [
    { id: 'simple', name: 'Simple Contract' },
    { id: 'basic', name: 'Basic ERC721' },
    { id: 'mintable', name: 'Mintable ERC721' }
  ];

  const loadTemplate = async (templateId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates?id=${templateId}`);
      if (!response.ok) {
        throw new Error('Failed to load template');
      }
      const data = await response.json();
      setSourceCode(data.code);
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate(selectedTemplate);
  }, [selectedTemplate]);

  const handleCompile = () => {
    onCompile(sourceCode);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Contract Editor</h2>
        <div className="flex items-center space-x-2">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-3 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCompile}
            disabled={isCompiling || !sourceCode.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-zinc-400 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-zinc-500 dark:text-zinc-400">Loading template...</div>
          </div>
        ) : (
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            placeholder="Enter your Solidity contract code here..."
            className="w-full h-full p-4 border border-zinc-300 dark:border-zinc-700 rounded-md font-mono text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            spellCheck={false}
          />
        )}
      </div>

      {compileResult && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto">
          <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">Compilation Result:</h3>
          {compileResult.success ? (
            <div className="text-green-600 dark:text-green-400">
              <p>✓ Compilation successful</p>
              <p className="text-sm mt-1">Contract ABI available for deployment</p>
            </div>
          ) : (
            <div className="text-red-600 dark:text-red-400">
              <p>✗ Compilation failed</p>
              {compileResult.errors && compileResult.errors.length > 0 && (
                <div className="mt-2 text-sm">
                  {compileResult.errors.map((error: any, index: number) => (
                    <div key={index} className="mb-1">
                      <p className="font-medium">{error.type}:</p>
                      <p>{error.formattedMessage || error.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractEditor;