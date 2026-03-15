import { GiscusConfig } from './giscus-config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateGiscusConfig = (config: Partial<GiscusConfig>): ValidationResult => {
  const errors: string[] = [];
  
  if (!config.repo) errors.push('Repository is required');
  if (!config.repoId) errors.push('Repository ID is required');
  if (!config.category) errors.push('Category is required');
  if (!config.categoryId) errors.push('Category ID is required');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};