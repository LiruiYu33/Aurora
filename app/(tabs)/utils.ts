import type { BrowserTab } from './types';
import { START_PAGE_MARKER } from './constants';

/**
 * 创建新标签页
 */
export const createTab = (): BrowserTab => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  url: START_PAGE_MARKER,
  title: '启动页',
  input: '',
  isStartPage: true,
  canGoBack: false,
  canGoForward: false,
  snapshot: null,
});

/**
 * 格式化用户输入的地址
 * @param rawValue - 用户在地址栏输入的原始内容
 * @returns 格式化后的 URL 字符串
 */
export const formatInput = (rawValue: string): string => {
  const value = rawValue.trim();
  if (!value) {
    return 'https://www.google.com/';
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.includes('.') && !value.includes(' ')) {
    return `https://${value}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
};
