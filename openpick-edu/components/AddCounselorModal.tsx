'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';

interface AddCounselorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCounselorModal({ isOpen, onClose, onSuccess }: AddCounselorModalProps) {
  const { wallet } = useWallet();
  const [formData, setFormData] = useState({
    name: '',
    skills: [{ name: '', level: 'intermediate' }],
    remark: '',
    telegram: '',
    wechat: '',
    walletAddress: '',
    priceUsd: 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

  const handleAddSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, { name: '', level: 'intermediate' }],
    });
  };

  const handleRemoveSkill = (index: number) => {
    const newSkills = formData.skills.filter((_, i) => i !== index);
    setFormData({ ...formData, skills: newSkills });
  };

  const handleSkillChange = (index: number, field: 'name' | 'level', value: string) => {
    const newSkills = [...formData.skills];
    newSkills[index][field] = value;
    setFormData({ ...formData, skills: newSkills });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证必填字段
      if (!formData.name || !formData.walletAddress || !formData.telegram || !formData.wechat) {
        setError('请填写所有必填字段');
        setLoading(false);
        return;
      }

      // 验证至少有一个技能
      const validSkills = formData.skills.filter(skill => skill.name.trim());
      if (validSkills.length === 0) {
        setError('请至少添加一项技能');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/counselors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet?.address || '',
        },
        body: JSON.stringify({
          ...formData,
          skills: validSkills,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '添加顾问失败');
      }

      // 重置表单
      setFormData({
        name: '',
        skills: [{ name: '', level: 'intermediate' }],
        remark: '',
        telegram: '',
        wechat: '',
        walletAddress: '',
        priceUsd: 10,
      });
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加顾问失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">添加新顾问</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：Alice Chen"
              required
            />
          </div>

          {/* 技能 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              技能 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {formData.skills.map((skill, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={skill.name}
                    onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="技能名称"
                  />
                  <select
                    value={skill.level}
                    onChange={(e) => handleSkillChange(index, 'level', e.target.value)}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {skillLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  {formData.skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(index)}
                      className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm font-medium"
              >
                + 添加技能
              </button>
            </div>
          </div>

          {/* 简介 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              简介
            </label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="简要介绍顾问的专业经验和特长..."
            />
          </div>

          {/* Telegram */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Telegram <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.telegram}
              onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="@username"
              required
            />
          </div>

          {/* 微信 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              微信 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.wechat}
              onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="微信号"
              required
            />
          </div>

          {/* 钱包地址 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              钱包地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.walletAddress}
              onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
              required
            />
          </div>

          {/* 价格 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              价格 (USD)
            </label>
            <input
              type="number"
              value={formData.priceUsd}
              onChange={(e) => setFormData({ ...formData, priceUsd: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              step="0.01"
            />
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:bg-zinc-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? '添加中...' : '添加顾问'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
