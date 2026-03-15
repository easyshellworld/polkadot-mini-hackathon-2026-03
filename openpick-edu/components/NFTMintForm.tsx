'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '../contexts/WalletContext';

interface NFTMintFormProps {
  onMintComplete?: (result: any) => void;
  onCancel?: () => void;
}

interface Attribute {
  traitType: string;
  value: string;
}

export default function NFTMintForm({ onMintComplete, onCancel }: NFTMintFormProps) {
  const t = useTranslations('mint');
  const { wallet } = useWallet();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    attributes: [] as Attribute[]
  });
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  // Cleanup object URL when fileUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type with more descriptive error message
      if (!['image/', 'video/', 'audio/'].some(type => selectedFile.type.startsWith(type))) {
        setError(t('fileTypeError', { allowedTypes: 'image, video, audio' }));
        return;
      }
      // Validate file size (100MB) with more descriptive error message
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError(t('fileSizeError', { maxSize: '100MB' }));
        return;
      }
      
      setFile(selectedFile);
      setFileUrl(URL.createObjectURL(selectedFile));
      setError(null);
    }
  };

  const handleAddAttribute = () => {
    setMetadata(prev => ({
      ...prev,
      attributes: [...prev.attributes, { traitType: '', value: '' }]
    }));
  };

  const handleRemoveAttribute = (index: number) => {
    setMetadata(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index)
    }));
  };

  const handleAttributeChange = (index: number, field: keyof Attribute, value: string) => {
    setMetadata(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) => 
        i === index ? { ...attr, [field]: value } : attr
      )
    }));
  };

  const handleMint = async () => {
    // Validate all required fields with more descriptive error messages
    if (!file) {
      setError('Please upload a file first.');
      return;
    }
    if (!metadata.name) {
      setError('Please enter a name for your NFT.');
      return;
    }
    if (!metadata.description) {
      setError('Please enter a description for your NFT.');
      return;
    }
    if (!wallet) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!wallet.provider) {
      setError('Wallet provider is not available. Please try reconnecting.');
      return;
    }

    setIsMinting(true);
    setError(null);
    setResult(null);

    try {
      // Import mintNFT function dynamically to avoid SSR issues
      const { mintNFT } = await import('../lib/contract');
      
      // Use the file URL from state
      const nftFileUrl = fileUrl;

      // Prepare NFT metadata with file URL
      const nftMetadata = {
        name: metadata.name,
        description: metadata.description,
        image: nftFileUrl,
        attributes: metadata.attributes
      };

      // Call smart contract mint function directly
      const result = await mintNFT({
        provider: wallet.provider,
        contractAddress: '0x1234567890123456789012345678901234567890', // Mock contract address
        toAddress: wallet.address
      });

      setResult(result);
      onMintComplete?.(result);
    } catch (err) {
      console.error('Error minting NFT:', err);
      if (err instanceof Error) {
        if (err.message.includes('user rejected transaction')) {
          setError('Transaction rejected by user. Please try again.');
        } else if (err.message.includes('insufficient funds')) {
          setError('Insufficient funds for transaction. Please check your balance.');
        } else if (err.message.includes('invalid address')) {
          setError('Invalid contract address. Please check the contract address.');
        } else if (err.message.includes('execution reverted')) {
          setError('Smart contract execution reverted. Please check the contract and try again.');
        } else if (err.message.includes('network')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(`Failed to mint NFT: ${err.message}`);
        }
      } else {
        setError('Failed to mint NFT: An unknown error occurred.');
      }
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md dark:bg-zinc-950 dark:shadow-zinc-800">
      <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-green-600 dark:text-green-400">{t('mintingSuccess')}</h3>
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
            <div className="mb-2">
              <strong>Transaction Hash:</strong>
              <p className="font-mono text-sm break-all">{result.transactionHash}</p>
            </div>
            <div className="mb-2">
              <strong>Token ID:</strong>
              <p className="font-mono text-sm">{result.tokenId}</p>
            </div>
            <div>
              <strong>NFT URL:</strong>
              <a
                href={result.nftUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline ml-2"
              >
                {result.nftUrl}
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('close')}
            </button>
            <button
              onClick={() => window.open(result.nftUrl, '_blank')}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              {t('viewNFT')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('uploadFile')}</label>
            <div className="flex gap-4">
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
                className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200"
              />
              {file && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                  {file.name}
                </span>
              )}
            </div>
            {fileUrl && (
              <div className="mt-4">
                <img
                  src={fileUrl}
                  alt="Preview"
                  className="max-w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Metadata Form */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('metadata')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('name')}</label>
                <input
                  type="text"
                  value={metadata.name}
                  onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder={t('name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('description')}</label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 resize-none h-24"
                  placeholder={t('description')}
                />
              </div>

              {/* Attributes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium">{t('attributes')}</h4>
                  <button
                    onClick={handleAddAttribute}
                    className="px-3 py-1 rounded-lg bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 transition-colors text-sm font-medium"
                  >
                    {t('addAttribute')}
                  </button>
                </div>
                <div className="space-y-3">
                  {metadata.attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('traitType')}
                        value={attr.traitType}
                        onChange={(e) => handleAttributeChange(index, 'traitType', e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200"
                      />
                      <input
                        type="text"
                        placeholder={t('value')}
                        value={attr.value}
                        onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200"
                      />
                      <button
                        onClick={() => handleRemoveAttribute(index)}
                        className="p-2 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                        aria-label={t('removeAttribute')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('cancel')}
              </button>
            )}
            <button
              onClick={handleMint}
              disabled={isMinting || !file || !metadata.name || !metadata.description || !wallet}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isMinting || !file || !metadata.name || !metadata.description || !wallet
                  ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {isMinting ? t('minting') : t('start')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}