'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
  isDefault: boolean;
}

interface AIConfigContextType {
  models: ModelConfig[];
  defaultModel: ModelConfig | null;
  addModel: (model: Omit<ModelConfig, 'id'>) => void;
  updateModel: (id: string, model: Partial<ModelConfig>) => void;
  deleteModel: (id: string) => void;
  setDefaultModel: (id: string) => void;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

export function useAIConfig() {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error('useAIConfig must be used within an AIConfigProvider');
  }
  return context;
}

interface AIConfigProviderProps {
  children: ReactNode;
}

export function AIConfigProvider({ children }: AIConfigProviderProps) {
  const [models, setModels] = useState<ModelConfig[]>([
    {
      id: 'deepseek',
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      apiKey: '',
      isDefault: true
    },
    {
      id: 'openai',
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4',
      apiKey: '',
      isDefault: false
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      endpoint: 'https://api.anthropic.com',
      model: 'claude-3-sonnet-20240229',
      apiKey: '',
      isDefault: false
    }
  ]);

  // Load models from localStorage on mount
  useEffect(() => {
    const savedModels = localStorage.getItem('ai-models');
    if (savedModels) {
      try {
        const parsedModels = JSON.parse(savedModels);
        setModels(parsedModels);
      } catch (error) {
        console.error('Failed to parse saved AI models:', error);
      }
    }
  }, []);

  // Save models to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai-models', JSON.stringify(models));
  }, [models]);

  const defaultModel = models.find(model => model.isDefault) || null;

  const addModel = (model: Omit<ModelConfig, 'id'>) => {
    const newModel: ModelConfig = {
      ...model,
      id: Date.now().toString()
    };
    setModels(prev => [...prev, newModel]);
  };

  const updateModel = (id: string, updatedModel: Partial<ModelConfig>) => {
    setModels(prev => 
      prev.map(model => 
        model.id === id ? { ...model, ...updatedModel } : model
      )
    );
  };

  const deleteModel = (id: string) => {
    setModels(prev => {
      const filtered = prev.filter(model => model.id !== id);
      // If we deleted the default model, set the first one as default
      const deletedWasDefault = prev.find(model => model.id === id)?.isDefault;
      if (deletedWasDefault && filtered.length > 0) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const setDefaultModel = (id: string) => {
    setModels(prev => 
      prev.map(model => ({
        ...model,
        isDefault: model.id === id
      }))
    );
  };

  return (
    <AIConfigContext.Provider value={{
      models,
      defaultModel,
      addModel,
      updateModel,
      deleteModel,
      setDefaultModel
    }}>
      {children}
    </AIConfigContext.Provider>
  );
}