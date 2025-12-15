import type { QuickLink } from './types';

// ==================== 常量配置 ====================

export const DEFAULT_URL = 'https://www.google.com/';
export const START_PAGE_MARKER = 'about:start';

// AsyncStorage 的存储键名
export const QUICK_LINK_STORAGE_KEY = 'browser.customQuickLinks.v1';
export const BOOKMARKS_STORAGE_KEY = 'browser.bookmarks.v1';
export const START_PAGE_BG_STORAGE_KEY = 'browser.startPageBgImage.v1';
export const BACKEND_URL_STORAGE_KEY = 'browser.backend.url.v1';

// 预设的快捷链接列表
export const defaultQuickLinks: QuickLink[] = [
  { label: 'IT之家', url: 'https://www.ithome.com/', icon: '📰' },
  { label: 'Google', url: 'https://www.google.com/', icon: '🔍' },
  { label: 'Apple', url: 'https://www.apple.com/', icon: '🍎' },
];

// RSS 新闻源地址
export const RSS_URL = 'https://www.chinanews.com.cn/rss/scroll-news.xml';

// ==================== 导航栏动画配置 ====================
export const NAVBAR_HIDE_OFFSET = 180;

// ==================== 滑动手势常量 ====================
export const SWIPE_MIN_DRAG = 0;
export const SWIPE_DIRECTION_RATIO = 0;
export const SWIPE_RELEASE_VELOCITY = 0;
export const SWIPE_CLOSE_DISTANCE = 100;

// ==================== 标签页切换器布局常量 ====================
export const TAB_CARD_SPACING = 0.8;

// ==================== 提取页面内容的脚本 ====================
export const EXTRACT_CONTENT_SCRIPT = `
(function() {
  try {
    // 移除脚本、样式等标签
    const clone = document.body.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, noscript, iframe, svg');
    scripts.forEach(el => el.remove());
    
    // 处理图片：将有意义的图片转换为文本描述
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      const alt = img.alt || img.title;
      if (alt && alt.length > 2) {
        const textNode = document.createTextNode(\` [图片: \${alt}] \`);
        img.parentNode.replaceChild(textNode, img);
      } else {
        img.remove();
      }
    });

    // 处理视频：标记视频位置
    const videos = clone.querySelectorAll('video');
    videos.forEach(video => {
      const textNode = document.createTextNode(' [视频内容] ');
      video.parentNode.replaceChild(textNode, video);
    });
    
    // 获取纯文本
    let text = clone.innerText || clone.textContent || '';
    
    // 清理多余空白
    text = text.replace(/\\s+/g, ' ').trim();
    
    // 限制长度（避免超过 API 限制）
    const maxLength = 12000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_CONTENT',
      content: text
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_CONTENT_ERROR',
      error: e.message
    }));
  }
})();
true;
`;
