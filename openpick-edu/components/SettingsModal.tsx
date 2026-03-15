'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAIConfig } from '../contexts/AIConfigContext';
import { useAdmin } from '../hooks/useAdmin';
import { useWallet } from '../contexts/WalletContext';


interface ProjectItem {
  projectId: number;
  itemName: string;
  score: number;
  count: number;
  createdAt: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'ai' | 'blockchain' | 'contract' | 'projectItems';
}

export default function SettingsModal({ isOpen, onClose, initialTab = 'ai' }: SettingsModalProps) {
  const t = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'ai' | 'blockchain' | 'contract' | 'projectItems'>(initialTab);
  const { models, defaultModel, addModel, updateModel, deleteModel, setDefaultModel } = useAIConfig();
  const { isAdmin } = useAdmin();
  const { wallet } = useWallet();
  
  // Project Items State
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProjectItem, setNewProjectItem] = useState({
    itemName: '',
    score: 10,
    count: 1
  });
  const [editingProjectItem, setEditingProjectItem] = useState<ProjectItem | null>(null);
  
  // Other Settings State
  const [newModelForm, setNewModelForm] = useState({
    name: '',
    endpoint: '',
    model: '',
    apiKey: ''
  });
  const [blockchainSettings, setBlockchainSettings] = useState({
    defaultChainId: 11155111,
    chains: [
      { id: 11155111, name: 'Ethereum Sepolia Test' }
    ]
  });
  const [contractSettings, setContractSettings] = useState({
    factoryContractAddress: '',
    contracts: [
      { chainId: 11155111, address: '' }
    ]
  });
  

  
  // Update active tab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load contract settings from localStorage when modal opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedContractSettings = localStorage.getItem('contract-settings');
      if (savedContractSettings) {
        try {
          setContractSettings(JSON.parse(savedContractSettings));
        } catch (error) {
          console.error('Failed to parse contract settings:', error);
        }
      }
      

    }
  }, [isOpen]);
  
  // Fetch Project Items
  const fetchProjectItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/project-items');
      const data = await response.json();
      if (data.success) {
        setProjectItems(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch project items');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error fetching project items:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add Project Item
  const addProjectItem = async () => {
    if (!newProjectItem.itemName.trim()) {
      setError('Item name is required');
      return;
    }
    
    if (!isAdmin) {
      setError('没有权限修改');
      return;
    }
    
    try {
      const response = await fetch('/api/project-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet?.address || ''
        },
        body: JSON.stringify(newProjectItem)
      });
      
      const data = await response.json();
      if (data.success) {
        setProjectItems([...projectItems, data.data]);
        setNewProjectItem({ itemName: '', score: 10, count: 1 });
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to add project item');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error adding project item:', err);
    }
  };
  
  // Update Project Item
  const updateProjectItem = async () => {
    if (!editingProjectItem) return;
    
    if (!isAdmin) {
      setError('没有权限修改');
      return;
    }
    
    try {
      const response = await fetch(`/api/project-items/${editingProjectItem.projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet?.address || ''
        },
        body: JSON.stringify(editingProjectItem)
      });
      
      const data = await response.json();
      if (data.success) {
        setProjectItems(projectItems.map(item => 
          item.projectId === editingProjectItem.projectId ? data.data : item
        ));
        setEditingProjectItem(null);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to update project item');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error updating project item:', err);
    }
  };
  
  // Delete Project Item
  const deleteProjectItem = async (projectId: number) => {
    if (!isAdmin) {
      setError('没有权限修改');
      return;
    }
    
    try {
      const response = await fetch(`/api/project-items/${projectId}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': wallet?.address || ''
        }
      });
      
      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to delete project item';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setError(errorMessage);
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setProjectItems(projectItems.filter(item => item.projectId !== projectId));
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to delete project item');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error deleting project item:', err);
    }
  };
  
  // Load project items when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'projectItems') {
      fetchProjectItems();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl dark:bg-zinc-950 dark:shadow-zinc-800 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('settings')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('ai')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'ai'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              AI Models
            </button>
            <button
              onClick={() => setActiveTab('blockchain')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'blockchain'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Blockchain
            </button>
            <button
              onClick={() => setActiveTab('contract')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'contract'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Contracts
            </button>
            <button
              onClick={() => setActiveTab('projectItems')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'projectItems'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Project Items
            </button>

          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">AI Model Configuration</h3>
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`default-${model.id}`}
                          checked={model.isDefault}
                          onChange={() => isAdmin && setDefaultModel(model.id)}
                          disabled={!isAdmin}
                          className="text-blue-600 dark:text-blue-400"
                        />
                        <label htmlFor={`default-${model.id}`} className="font-medium">{model.name}</label>
                      </div>
                      <button 
                        onClick={() => isAdmin && deleteModel(model.id)}
                        disabled={!isAdmin}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={model.name}
                          onChange={(e) => isAdmin && updateModel(model.id, { name: e.target.value })}
                          disabled={!isAdmin}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">API Endpoint</label>
                        <input
                          type="url"
                          value={model.endpoint}
                          onChange={(e) => isAdmin && updateModel(model.id, { endpoint: e.target.value })}
                          disabled={!isAdmin}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Model Name</label>
                        <input
                          type="text"
                          value={model.model}
                          onChange={(e) => isAdmin && updateModel(model.id, { model: e.target.value })}
                          disabled={!isAdmin}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">API Key</label>
                        <input
                          type="password"
                          value={model.apiKey}
                          onChange={(e) => isAdmin && updateModel(model.id, { apiKey: e.target.value })}
                          disabled={!isAdmin}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add New Model Form */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <h4 className="font-medium mb-4">Add New Model</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={newModelForm.name}
                      onChange={(e) => isAdmin && setNewModelForm(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                      placeholder="e.g., OpenAI"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">API Endpoint</label>
                    <input
                      type="url"
                      value={newModelForm.endpoint}
                      onChange={(e) => isAdmin && setNewModelForm(prev => ({ ...prev, endpoint: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                      placeholder="e.g., https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Model Name</label>
                    <input
                      type="text"
                      value={newModelForm.model}
                      onChange={(e) => isAdmin && setNewModelForm(prev => ({ ...prev, model: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                      placeholder="e.g., gpt-4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <input
                      type="password"
                      value={newModelForm.apiKey}
                      onChange={(e) => isAdmin && setNewModelForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                      placeholder="Your API key"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (isAdmin && newModelForm.name && newModelForm.endpoint && newModelForm.model) {
                      addModel({
                        ...newModelForm,
                        isDefault: models.length === 0
                      });
                      setNewModelForm({ name: '', endpoint: '', model: '', apiKey: '' });
                    }
                  }}
                  disabled={!isAdmin}
                  className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  Add AI Model
                </button>
              </div>
            </div>
          )}

          {activeTab === 'blockchain' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Blockchain Configuration</h3>
              <div>
                <label className="block text-sm font-medium mb-2">Default Chain ID</label>
                <select
                  value={blockchainSettings.defaultChainId}
                  onChange={(e) => {
                    isAdmin && setBlockchainSettings(prev => ({ ...prev, defaultChainId: parseInt(e.target.value) }));
                  }}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                >
                  {blockchainSettings.chains.map(chain => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} (ID: {chain.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h4 className="text-md font-medium mb-3">Supported Chains</h4>
                <div className="space-y-3">
                  {blockchainSettings.chains.map(chain => (
                    <div key={chain.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <span>{chain.name} (ID: {chain.id})</span>
                      <button 
                        onClick={() => {
                          if (isAdmin) {
                            console.log('Remove chain:', chain.id);
                          }
                        }}
                        disabled={!isAdmin}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => {
                  if (isAdmin) {
                    console.log('Add chain');
                  }
                }}
                disabled={!isAdmin}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
              >
                Add Chain
              </button>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Contract Configuration</h3>
              <div>
                <label className="block text-sm font-medium mb-2">Factory Contract Address</label>
                <input
                  type="text"
                  value={contractSettings.factoryContractAddress}
                  onChange={(e) => {
                    isAdmin && setContractSettings(prev => ({ ...prev, factoryContractAddress: e.target.value }));
                  }}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 font-mono disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                  placeholder="0x..."
                />
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  This address will override the FACTORY_CONTRACT_ADDRESS environment variable for NFT collection creation
                </p>
              </div>
              <div>
                <h4 className="text-md font-medium mb-3">Chain-Specific Contracts</h4>
                <div className="space-y-3">
                  {contractSettings.contracts.map((contract, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium mb-1">Chain ID</label>
                        <input
                          type="number"
                          value={contract.chainId}
                          onChange={(e) => {
                            const newContracts = [...contractSettings.contracts];
                            newContracts[index] = { ...newContracts[index], chainId: parseInt(e.target.value) };
                            setContractSettings({ ...contractSettings, contracts: newContracts });
                          }}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Contract Address</label>
                        <input
                          type="text"
                          value={contract.address}
                          onChange={(e) => {
                            const newContracts = [...contractSettings.contracts];
                            newContracts[index] = { ...newContracts[index], address: e.target.value };
                            setContractSettings({ ...contractSettings, contracts: newContracts });
                          }}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 font-mono"
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => {
                    if (isAdmin) {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('contract-settings', JSON.stringify(contractSettings));
                      }
                      console.log('Contract settings saved:', contractSettings);
                    }
                  }}
                  disabled={!isAdmin}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  Save Settings
                </button>
                <button 
                  onClick={() => {
                    if (isAdmin) {
                      console.log('Add contract');
                    }
                  }}
                  disabled={!isAdmin}
                  className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  Add Contract
                </button>
              </div>
            </div>
          )}

          {activeTab === 'projectItems' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Project Items Configuration</h3>
              
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              
              {/* Add New Project Item */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <h4 className="font-medium mb-4">Add New Project Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Item Name</label>
                    <input
                      type="text"
                      value={newProjectItem.itemName}
                      onChange={(e) => isAdmin && setNewProjectItem(prev => ({ ...prev, itemName: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                      placeholder="e.g., whatIsNFT"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Score</label>
                    <input
                      type="number"
                      min="1"
                      value={newProjectItem.score}
                      onChange={(e) => isAdmin && setNewProjectItem(prev => ({ ...prev, score: parseInt(e.target.value) }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Count</label>
                    <input
                      type="number"
                      min="1"
                      value={newProjectItem.count}
                      onChange={(e) => isAdmin && setNewProjectItem(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => isAdmin && addProjectItem()}
                  disabled={!isAdmin}
                  className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  Add Project Item
                </button>
              </div>
              
              {/* Project Items List */}
              <div>
                <h4 className="text-md font-medium mb-3">Project Items</h4>
                
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2">Loading project items...</p>
                  </div>
                ) : projectItems.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    No project items found. Add your first project item above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectItems.map(item => (
                      <div key={item.projectId} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        {editingProjectItem?.projectId === item.projectId ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Item Name</label>
                                <input
                                  type="text"
                                  value={editingProjectItem.itemName}
                                  onChange={(e) => isAdmin && setEditingProjectItem(prev => prev ? { ...prev, itemName: e.target.value } : null)}
                                  disabled={!isAdmin}
                                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Score</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editingProjectItem.score}
                                  onChange={(e) => isAdmin && setEditingProjectItem(prev => prev ? { ...prev, score: parseInt(e.target.value) } : null)}
                                  disabled={!isAdmin}
                                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Max Count</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editingProjectItem.count}
                                  onChange={(e) => isAdmin && setEditingProjectItem(prev => prev ? { ...prev, count: parseInt(e.target.value) } : null)}
                                  disabled={!isAdmin}
                                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => isAdmin && setEditingProjectItem(null)}
                                disabled={!isAdmin}
                                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => isAdmin && updateProjectItem()}
                                disabled={!isAdmin}
                                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-medium">{item.itemName}</h5>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Created: {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-zinc-500 dark:text-zinc-400">Score:</span> {item.score}
                                </div>
                                <div>
                                  <span className="text-zinc-500 dark:text-zinc-400">Max Count:</span> {item.count}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => isAdmin && setEditingProjectItem(item)}
                                disabled={!isAdmin}
                                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => isAdmin && deleteProjectItem(item.projectId)}
                                disabled={!isAdmin}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors text-sm disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          

        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('cancel')}
          </button>
          {isAdmin ? (
            <button
              onClick={() => {

                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              {t('save')}
            </button>
          ) : (
            <button
              disabled
              className="px-4 py-2 rounded-lg bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed"
              title="Only administrators can save settings"
            >
              {t('save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}