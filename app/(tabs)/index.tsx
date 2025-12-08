// ==================== 导入依赖 ====================
// 从 Expo 图标库导入 Ionicons 组件，用于显示各种图标
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ==================== 类型定义 ====================
type BrowserTab = {
  id: string;
  url: string;
  title: string;      // 网页标题
  input: string;
  isStartPage: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  snapshot: string | null;
};

type QuickLink = {
  label: string;
  url: string;
  icon?: string;
};

// ==================== 常量配置 ====================
const DEFAULT_URL = 'https://www.google.com/';
// 启动页标记（用于逻辑判断）
const START_PAGE_MARKER = 'about:start';

const createTab = (): BrowserTab => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  url: START_PAGE_MARKER,
  title: '启动页',
  input: '',
  isStartPage: true,
  canGoBack: false,
  canGoForward: false,
  snapshot: null,
});

// 预设的快捷链接列表（这些是默认显示的）
const defaultQuickLinks: QuickLink[] = [
  { label: 'IT之家', url: 'https://www.ithome.com/', icon: '📰' },
  { label: 'Google', url: 'https://www.google.com/', icon: '🔍' },
  { label: 'Apple', url: 'https://www.apple.com/', icon: '🍎' },
];

// RSS 新闻源地址
const RSS_URL = 'https://www.chinanews.com.cn/rss/scroll-news.xml';

// RSS 新闻条目类型
type RssNewsItem = {
  title: string;   // 新闻标题
  link: string;    // 新闻链接
};

// AsyncStorage 的存储键名，用于保存用户自定义的快捷链接
const QUICK_LINK_STORAGE_KEY = 'browser.customQuickLinks.v1';
// AsyncStorage 的存储键名，用于保存用户收藏夹
const BOOKMARKS_STORAGE_KEY = 'browser.bookmarks.v1';
// AsyncStorage 的存储键名，用于保存启动页背景图片 URI
const START_PAGE_BG_STORAGE_KEY = 'browser.startPageBgImage.v1';

// 收藏夹项目类型
type BookmarkItem = {
  id: string;       // 唯一标识符
  title: string;    // 收藏标题
  url: string;      // 收藏网址
  createdAt: number; // 创建时间戳
};

// ==================== 导航栏动画配置 ====================
// 导航栏隐藏位移（要足够大确保完全隐藏，包括底部安全区域）
const NAVBAR_HIDE_OFFSET = 180;

// ==================== 工具函数 ====================
/**
 * 格式化用户输入的地址
 * @param rawValue - 用户在地址栏输入的原始内容
 * @returns 格式化后的 URL 字符串
 * 
 * 处理逻辑：
 * 1. 如果是空输入，返回默认 URL
 * 2. 如果已有 http:// 或 https://，直接返回
 * 3. 如果包含点号且无空格（疑似域名），自动添加 https://
 * 4. 其他情况视为搜索关键词，通过 Google 搜索
 */
const formatInput = (rawValue: string) => {
  const value = rawValue.trim();  // 去除首尾空格
  if (!value) {
    return DEFAULT_URL;  // 空输入返回默认地址
  }
  // 检查是否已包含协议头
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;  // 已有协议，直接返回
  }
  // 判断是否像域名（包含点号且无空格）
  if (value.includes('.') && !value.includes(' ')) {
    return `https://${value}`;  // 自动添加 https://
  }
  // 其他情况当作搜索词，使用 Google 搜索
  // encodeURIComponent 将搜索词转义为 URL 安全格式
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
};

// ==================== 滑动手势常量 ====================
// 手势调节常量（便于手动调参）
// 需要更灵敏就调小数值，需要更稳就调大
const SWIPE_MIN_DRAG = 0;              // 识别向上滑动的最小距离，0=任何向上移动都响应
const SWIPE_DIRECTION_RATIO = 0;       // 横向/纵向的容错比，0=只要有向上分量就拦截（未使用，保留）
const SWIPE_RELEASE_VELOCITY = 0;      // 松手时的向上速度阈值，0=任何向上速度都触发
const SWIPE_CLOSE_DISTANCE = 8;        // 上滑超过该距离即可判定关闭（越小越容易关闭）

// ==================== 标签页切换器布局常量 ====================
// 调整这个值来控制左右标签页的间距，越小越近（可以看到更多相邻卡片）
const TAB_CARD_SPACING = 0.8;         // 卡片间距系数，1=整屏宽度，0.85=可以微微看到两侧卡片

// ==================== 主浏览器组件 ====================
/**
 * SimpleBrowser - 简易浏览器组件
 * 
 * 功能特性：
 * - 多标签页管理（新建、关闭、切换）
 * - WebView 网页加载
 * - 地址栏输入和搜索
 * - 前进/后退导航
 * - 刷新页面
 * - 标签页滑动关闭
 * - 自定义快捷链接并持久化存储
 */
export default function SimpleBrowser() {
  // ==================== 状态管理 ====================
  
  // 使用 useRef 保存初始标签页，避免每次渲染重新创建
  // ref.current 在组件整个生命周期中保持不变
  const initialTabRef = useRef<BrowserTab>(createTab());
  
  // tabs: 所有标签页的数组
  // useState 返回 [state, setState]，用于管理可变状态
  // 初始值为包含一个初始标签页的数组
  const [tabs, setTabs] = useState<BrowserTab[]>([initialTabRef.current]);
  
  // activeTabId: 当前激活的标签页 ID
  const [activeTabId, setActiveTabId] = useState(initialTabRef.current.id);
  
  // isSwitcherVisible: 标签页切换器是否可见（全屏浮层）
  const [isSwitcherVisible, setSwitcherVisible] = useState(false);
  
  // canGoBack: 当前页面是否可以后退
  const [canGoBack, setCanGoBack] = useState(false);
  
  // canGoForward: 当前页面是否可以前进
  const [canGoForward, setCanGoForward] = useState(false);
  
  // isLoading: 页面是否正在加载
  const [isLoading, setIsLoading] = useState(false);
  
  // customQuickLinks: 用户自定义的快捷链接数组
  const [customQuickLinks, setCustomQuickLinks] = useState<QuickLink[]>([]);
  
  // startPageBgImage: 启动页背景图片 URI
  const [startPageBgImage, setStartPageBgImage] = useState<string | null>(null);
  
  // rssNews: 从 RSS 拉取的新闻列表
  const [rssNews, setRssNews] = useState<RssNewsItem[]>([]);
  // isLoadingRss: RSS 是否正在加载
  const [isLoadingRss, setIsLoadingRss] = useState(true);
  
  // 启动页 HTML 文件的本地 URI
  const [startPageUrl, setStartPageUrl] = useState<string | null>(null);

  // 主题
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 加载启动页资源和背景图片
  useEffect(() => {
    const loadStartPage = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/start-page.html'));
        await asset.downloadAsync();
        setStartPageUrl(asset.localUri || asset.uri);
      } catch (e) {
        console.warn('Failed to load start page asset', e);
      }
    };
    
    const loadBackgroundImage = async () => {
      try {
        const bgImage = await AsyncStorage.getItem(START_PAGE_BG_STORAGE_KEY);
        if (bgImage) {
          setStartPageBgImage(bgImage);
        }
      } catch (e) {
        console.warn('Failed to load background image', e);
      }
    };
    
    loadStartPage();
    loadBackgroundImage();
  }, []);

  // ==================== 派生状态（计算值） ====================
  
  // currentInput: 当前激活标签页的地址栏输入内容
  // array.find() 查找第一个匹配的元素
  // ?. 可选链操作符，如果前面的值为 null/undefined，返回 undefined
  // ?? '' 空值合并操作符，左侧为 null/undefined 时使用右侧的默认值
  const currentInput = tabs.find((tab) => tab.id === activeTabId)?.input ?? '';
  
  // activeTab: 当前激活的标签页对象
  // 如果找不到，fallback 到第一个标签页
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  
  // combinedQuickLinks: 合并默认快捷链接和用户自定义快捷链接
  const combinedQuickLinks = [...defaultQuickLinks, ...customQuickLinks];
  
  // webViewRef: WebView 组件的引用，用于调用其方法（如 goBack、reload）
  // useRef<WebView>(null) 创建一个可存储 WebView 实例的引用
  const webViewRef = useRef<WebView>(null);
  // 存储所有标签页对应的包装 View 引用，用于截图（captureRef 不能直接捕获 WebView）
  const webViewWrapperRefs = useRef<Record<string, View | null>>({});
  // 防止导航时隐藏导航栏的标志
  const isNavigatingRef = useRef(false);

  // 将已保存的启动页背景同步给 WebView（处理首屏加载和切换回启动页的场景）
  const activeStartTabId = activeTab?.id;
  const isActiveTabStartPage = activeTab?.isStartPage;
  useEffect(() => {
    if (!startPageUrl || !isActiveTabStartPage || !webViewRef.current) return;
    const uri = startPageBgImage || '';
    console.log('Setting background image:', uri ? 'Has URI' : 'Empty');
    setTimeout(() => {
      const message = JSON.stringify({
        type: 'SET_BACKGROUND',
        payload: uri
      });
      webViewRef.current?.postMessage(message);
    }, 500);
  }, [startPageBgImage, startPageUrl, activeStartTabId, isActiveTabStartPage]);
  
  // ==================== 导航栏显示/隐藏状态 ====================
  // 导航栏是否可见
  const [isNavBarVisible, setIsNavBarVisible] = useState(true);
  // 导航栏位移动画值
  const navBarTranslateY = useRef(new Animated.Value(0)).current;
  // WebView 容器淡入淡出动画
  const webViewOpacity = useRef(new Animated.Value(1)).current;
  // 标签页切换缩放和淡入淡出
  const tabSwitchScale = useRef(new Animated.Value(1)).current;
  const tabSwitchOpacity = useRef(new Animated.Value(1)).current;
  // 标签页展开动画（从卡片到全屏）
  const tabExpandScale = useRef(new Animated.Value(1)).current;
  const tabExpandOpacity = useRef(new Animated.Value(1)).current;
  // 导航栏按钮点击动画值（每个按钮一个）
  const buttonAnimations = useRef<Record<string, { scale: Animated.Value; opacity: Animated.Value }>>({}).current;
  
  // ==================== 收藏夹状态 ====================
  // 收藏夹列表
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  // 收藏夹面板是否可见
  const [isBookmarksPanelVisible, setBookmarksPanelVisible] = useState(false);
  
  // ==================== 键盘状态 ====================
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // ==================== 副作用：监听键盘 ====================
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        // use native driver because we only consume this value in translateY
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: e.duration || 250,
          useNativeDriver: true,
        }).start();
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: e.duration || 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // ==================== 快捷链接管理函数 ====================
  
  /**
   * 持久化保存自定义快捷链接到本地存储
   * @param next - 要保存的快捷链接数组
   */
  const persistCustomQuickLinks = async (next: QuickLink[]) => {
    try {
      // JSON.stringify() 将对象转为 JSON 字符串
      // AsyncStorage.setItem() 异步保存键值对
      await AsyncStorage.setItem(QUICK_LINK_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('保存快捷网址失败', error);
    }
  };

  /**
   * 添加新的自定义快捷链接
   * @param label - 链接名称
   * @param rawUrl - 原始 URL（可能不完整）
   * @throws {Error} 当输入为空或名称重复时抛出错误
   */
  const handleAddQuickLink = async (label: string, rawUrl: string) => {
    // 去除首尾空格，规范化输入
    const normalizedLabel = label.trim();
    const normalizedRawUrl = rawUrl.trim();
    
    // 验证：不能为空
    if (!normalizedLabel || !normalizedRawUrl) {
      throw new Error('请输入名称和网址');
    }
    
    // 使用 formatInput 格式化 URL（自动添加 https:// 等）
    const formattedUrl = formatInput(normalizedRawUrl);
    
    // array.some() 检查数组中是否有元素满足条件
    // 这里检查是否存在同名链接（不区分大小写）
    const duplicate = combinedQuickLinks.some(
      (item) => item.label.toLowerCase() === normalizedLabel.toLowerCase(),
    );
    
    if (duplicate) {
      // 存在重复，抛出错误
      throw new Error('已存在同名快捷方式');
    }
    
    // 创建新数组：展开现有链接 + 新链接
    const next = [...customQuickLinks, { label: normalizedLabel, url: formattedUrl }];
    
    // 更新状态（触发重新渲染）
    setCustomQuickLinks(next);
    
    // 异步保存到本地存储
    await persistCustomQuickLinks(next);
  };

  // ==================== 启动页背景图片管理函数 ====================
  
  /**
   * 选择背景图片
   */
  const handleSelectBackgroundImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('需要相册权限才能选择背景图片');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        const pickedUri = result.assets[0].uri;
        
        // 读取图片为 base64，转换为 data URL
        const base64 = await FileSystem.readAsStringAsync(pickedUri, {
          encoding: 'base64',
        });
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        
        setStartPageBgImage(dataUrl);
        
        // 保存到本地存储
        try {
          await AsyncStorage.setItem(START_PAGE_BG_STORAGE_KEY, dataUrl);
          
          // 立即刷新页面显示背景 - 使用 postMessage 发送大数据
          setTimeout(() => {
            const message = JSON.stringify({
              type: 'SET_BACKGROUND',
              payload: dataUrl
            });
            webViewRef.current?.postMessage(message);
          }, 100);
        } catch (e) {
          console.warn('Failed to save background image', e);
        }
      }
    } catch (e) {
      console.warn('Error selecting background image', e);
    }
  };
  
  /**
   * 重置背景图片
   */
  const handleResetBackground = async () => {
    setStartPageBgImage(null);
    try {
      await AsyncStorage.removeItem(START_PAGE_BG_STORAGE_KEY);
      
      // 立即刷新页面恢复默认背景
      setTimeout(() => {
        const message = JSON.stringify({
          type: 'SET_BACKGROUND',
          payload: ''
        });
        webViewRef.current?.postMessage(message);
      }, 100);
    } catch (e) {
      console.warn('Failed to reset background image', e);
    }
  };

  // ==================== 收藏夹管理函数 ====================
  
  /**
   * 持久化保存收藏夹到本地存储
   * @param next - 要保存的收藏夹数组
   */
  const persistBookmarks = async (next: BookmarkItem[]) => {
    try {
      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('保存收藏夹失败', error);
    }
  };

  /**
   * 添加当前页面到收藏夹
   */
  const handleAddBookmark = async () => {
    if (!activeTab || activeTab.isStartPage || !activeTab.url) {
      return; // 启动页或无URL时不能收藏
    }
    
    // 检查是否已收藏
    const exists = bookmarks.some(b => b.url === activeTab.url);
    if (exists) {
      return; // 已存在，不重复添加
    }
    
    const newBookmark: BookmarkItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: activeTab.title || activeTab.url.replace(/^https?:\/\//, '').split('/')[0], // 使用页面标题
      url: activeTab.url,
      createdAt: Date.now(),
    };
    
    const next = [newBookmark, ...bookmarks];
    setBookmarks(next);
    await persistBookmarks(next);
  };

  /**
   * 从收藏夹删除
   * @param bookmarkId - 要删除的收藏ID
   */
  const handleDeleteBookmark = async (bookmarkId: string) => {
    const next = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(next);
    await persistBookmarks(next);
  };

  /**
   * 打开收藏的页面
   * @param url - 收藏的网址
   */
  const handleOpenBookmark = (url: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { url, input: url, isStartPage: false });
    }
    setBookmarksPanelVisible(false);
  };

  /**
   * 检查当前页面是否已收藏
   */
  const isCurrentPageBookmarked = useMemo(() => {
    if (!activeTab || activeTab.isStartPage || !activeTab.url) return false;
    return bookmarks.some(b => b.url === activeTab.url);
  }, [activeTab, bookmarks]);

  // ==================== 标签页管理函数 ====================
  
  /**
   * 更新指定标签页的部分属性
   * @param tabId - 要更新的标签页 ID
   * @param updates - 部分更新的属性（Partial<BrowserTab> 表示所有属性都是可选的）
   */
  const updateTab = (tabId: string, updates: Partial<BrowserTab>) => {
    // setTabs 接受函数参数，prev 是当前状态值
    // array.map() 遍历数组，对每个元素执行转换
    // tab.id === tabId ? {...tab, ...updates} : tab
    //   - 如果是目标标签页，使用对象展开合并更新
    //   - 否则保持原样
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)));
  };

  /**
   * 为当前活跃标签页捕获截图（切换标签页前调用）
   */
  const captureCurrentTabSnapshot = async () => {
    if (!activeTab) return;
    const wrapperRef = webViewWrapperRefs.current[activeTab.id];
    if (!wrapperRef) return;
    try {
      // 等待一帧确保渲染完成
      await new Promise(requestAnimationFrame);
      const uri = await captureRef(wrapperRef, {
        format: 'jpg',
        quality: 0.5,
        result: 'tmpfile',
      });
      updateTab(activeTab.id, { snapshot: uri });
    } catch (e) {
      console.log('Snapshot failed for current tab', e);
    }
  };

  /**
   * 创建新标签页
   * @param stayInSwitcher - 是否停留在标签页切换器中（默认 false，会关闭切换器）
   */
  const handleNewTab = async (stayInSwitcher = false) => {
    // 只有在非切换器模式下才截图当前标签页
    if (!isSwitcherVisible) {
      await captureCurrentTabSnapshot();
    }
    
    // 重置动画值确保新标签页正确显示
    tabSwitchScale.setValue(1);
    tabSwitchOpacity.setValue(1);
    tabExpandScale.setValue(1);
    tabExpandOpacity.setValue(1);
    
    // 创建新标签页
    const nextTab = createTab();
    
    // 将新标签页添加到数组末尾
    setTabs((prev) => [...prev, nextTab]);
    
    // 激活新标签页
    setActiveTabId(nextTab.id);
    
    // 新标签页为启动页，无历史记录
    setCanGoBack(false);
    setCanGoForward(false);
    
    // 根据参数决定是否关闭切换器
    if (!stayInSwitcher) {
      setSwitcherVisible(false);
    }
  };

  /**
   * 关闭指定标签页
   * @param targetId - 要关闭的标签页 ID
   * @param stayInSwitcher - 是否停留在标签页切换器中
   */
  const handleCloseTab = (targetId: string, stayInSwitcher = false) => {
    setTabs((prev) => {
      // 如果只剩一个标签页，不关闭，而是替换为新的空白标签页
      if (prev.length === 1) {
        const fresh = createTab();  // 创建新标签页
        setActiveTabId(fresh.id);   // 激活新标签页
        setCanGoBack(false);
        setCanGoForward(false);
        return [fresh];
      }
      // 过滤掉目标标签页
      // array.filter() 返回满足条件的元素组成的新数组
      const filtered = prev.filter((tab) => tab.id !== targetId);
      
      // 如果关闭的是当前激活的标签页，需要切换到其他标签页
      if (targetId === activeTabId) {
        // 选择 fallback 标签页：优先选最后一个，否则选第一个
        // filtered[filtered.length - 1] 获取数组最后一个元素
        const fallbackId = filtered[filtered.length - 1]?.id ?? filtered[0]?.id;
        
        if (fallbackId) {
          setActiveTabId(fallbackId);  // 激活 fallback 标签页
        }
        
        // 重置导航状态（新激活的标签页可能无历史记录）
        setCanGoBack(false);
        setCanGoForward(false);
      }
      
      // 返回过滤后的数组（这会成为新的 tabs 状态）
      return filtered;
    });
    
    // 根据参数决定是否关闭切换器
    if (!stayInSwitcher) {
      setSwitcherVisible(false);
    }
  };

  // 关闭所有标签页并回到一个全新的启动页
  const handleCloseAllTabs = () => {
    const fresh = createTab();
    setTabs([fresh]);
    setActiveTabId(fresh.id);
    setCanGoBack(false);
    setCanGoForward(false);
    setSwitcherVisible(false);
  };

  // 长按标签页按钮弹出操作：关闭当前或全部标签页
  const handleTabButtonLongPress = () => {
    const closeCurrent = () => {
      if (activeTabId) {
        handleCloseTab(activeTabId);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['关闭当前标签页', '关闭所有标签页', '取消'],
          destructiveButtonIndices: [0, 1],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) closeCurrent();
          if (buttonIndex === 1) handleCloseAllTabs();
        }
      );
    } else {
      Alert.alert('标签页', '选择操作', [
        { text: '关闭当前标签页', onPress: closeCurrent },
        { text: '关闭所有标签页', style: 'destructive', onPress: handleCloseAllTabs },
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  // ==================== 地址栏和导航事件处理 ====================
  
  /**
   * 处理地址栏提交（用户按下回车或"前往"按钮）
   */
  const handleSubmit = () => {
    // 验证：activeTab 存在且输入不为空
    if (!activeTab || !activeTab.input.trim()) {
      return;  // 无效输入，直接返回
    }
    
    // 格式化输入为完整 URL
    const target = formatInput(activeTab.input);
    
    // 导航前淡出动画
    Animated.timing(webViewOpacity, {
      toValue: 0.6,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    // 更新标签页：设置 url、input，并标记为非启动页
    updateTab(activeTab.id, { url: target, input: target, isStartPage: false });
  };

  /**
   * 处理地址栏文本变化（用户正在输入）
   * @param text - 最新的输入文本
   */
  const handleAddressChange = (text: string) => {
    if (activeTab) {
      // 只更新 input 字段，不更新 url（不立即导航）
      updateTab(activeTab.id, { input: text });
    }
  };

  /**
   * 处理快捷链接点击（从启动页或预设链接）
   * @param rawValue - 链接地址（可能不完整）
   */
  const handleOpenPreset = (rawValue: string) => {
    if (!activeTab) {
      return;
    }
    
    // 点击快捷链接时的淡出淡入动画
    Animated.timing(webViewOpacity, {
      toValue: 0.4,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    // 格式化地址
    const target = formatInput(rawValue);
    
    // 更新标签页并导航
    updateTab(activeTab.id, { url: target, input: target, isStartPage: false });
  };

  /**
   * 分享当前页面
   */
  const handleShare = async () => {
    if (!activeTab) return;
    const urlToShare = activeTab.isStartPage ? DEFAULT_URL : activeTab.url;
    if (!urlToShare) return;
    try {
      // 仅传 url，避免 iOS ShareSheet 显示两条目
      await Share.share({ url: urlToShare });
    } catch (error) {
      console.warn('分享失败', error);
    }
  };

  /**
   * 处理后退按钮（支持返回启动页）
   */
  const handleGoBack = () => {
    if (!activeTab) return;
    
    if (activeTab.isStartPage) {
      return;
    }
    
    // 设置导航标志，防止隐藏导航栏
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
    
    // 后退时的过渡动画
    Animated.timing(webViewOpacity, {
      toValue: 0.5,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(webViewOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    
    // 如果 WebView 可以后退，且当前不在启动页（通过 URL 判断）
    if (canGoBack && activeTab.url !== startPageUrl && activeTab.url !== START_PAGE_MARKER) {
      webViewRef.current?.goBack();
    } else {
      // 返回启动页
      updateTab(activeTab.id, { 
        isStartPage: true, 
        url: START_PAGE_MARKER, 
        input: '', 
        canGoBack: false, 
        canGoForward: false 
      });
      setCanGoBack(false);
      setCanGoForward(false);
    }
  };

  /**
   * 处理 WebView 导航状态变化
   */
  const handleNavChange = (navState: WebViewNavigation) => {
    if (!activeTab) return;
    
    // 检测是否在启动页
    const isOnStartPage = navState.url === startPageUrl || navState.url === START_PAGE_MARKER || navState.url.includes('start-page.html');
    
    const canGoBackToWeb = navState.canGoBack;
    const canGoBackToStart = !isOnStartPage;
    
    setCanGoBack(canGoBackToWeb || canGoBackToStart);
    setCanGoForward(navState.canGoForward);
    
    // 获取页面标题，如果没有则使用域名
    const pageTitle = isOnStartPage 
      ? '启动页' 
      : (navState.title || navState.url.replace(/^https?:\/\//, '').split('/')[0]);
    
    updateTab(activeTab.id, { 
      url: navState.url, 
      title: pageTitle,
      input: isOnStartPage ? '' : navState.url, 
      isStartPage: isOnStartPage,
      canGoBack: canGoBackToWeb || canGoBackToStart,
      canGoForward: navState.canGoForward
    });
  };

  // 进入标签页切换器时只截图当前活跃标签页（其他标签页保留之前的截图）
  // 因为非活跃标签页 opacity 为 0，captureRef 无法截图
  useEffect(() => {
    if (isSwitcherVisible) {
      captureCurrentTabSnapshot();
    }
  }, [isSwitcherVisible]);

  // ==================== 导航栏显示/隐藏动画 ====================
  /**
   * 显示导航栏
   */
  const showNavBar = () => {
    if (!isNavBarVisible) {
      setIsNavBarVisible(true);
      Animated.spring(navBarTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }
  };

  /**
   * 隐藏导航栏
   */
  const hideNavBar = () => {
    if (isNavBarVisible) {
      setIsNavBarVisible(false);
      Animated.spring(navBarTranslateY, {
        toValue: NAVBAR_HIDE_OFFSET,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }
  };

  /**
   * 处理 WebView 滚动事件的 JS 代码
   * 注入到页面中监听滚动方向
   */
  const scrollListenerJS = `
    (function() {
      // 添加 CSS 让内容能穿过顶部安全区域，并用网页背景色填充
      const style = document.createElement('style');
      style.textContent = \`
        html {
          padding-top: 0 !important;
          background-color: inherit;
        }
        body {
          padding-top: 0 !important;
          margin-top: 0 !important;
          background-color: inherit;
        }
      \`;
      document.head.appendChild(style);
      
      // 获取网页背景色并应用到安全区域
      const updateBackgroundColor = () => {
        const bodyStyle = window.getComputedStyle(document.body);
        const bgColor = bodyStyle.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
          document.documentElement.style.backgroundColor = bgColor;
        }
      };
      
      updateBackgroundColor();
      window.addEventListener('load', updateBackgroundColor);
      
      let lastScrollY = 0;
      let ticking = false;
      
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            
            // 只在滚动超过一定距离时才发送消息
            if (Math.abs(delta) > 5) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'scroll',
                direction: delta > 0 ? 'down' : 'up',
                scrollY: currentScrollY
              }));
              lastScrollY = currentScrollY;
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    })();
    true;
  `;

  /**
   * 处理 WebView 发送的消息（滚动事件、启动页事件）
   */
  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'scroll') {
        // 如果正在导航中或在启动页，不响应滚动事件隐藏导航栏
        if (isNavigatingRef.current || activeTab?.isStartPage) {
          showNavBar(); // 保持导航栏显示
          return;
        }
        
        if (data.direction === 'down' && data.scrollY > 50) {
          // 向下滚动且不在顶部，隐藏导航栏
          hideNavBar();
        } else if (data.direction === 'up') {
          // 向上滚动，显示导航栏
          showNavBar();
        }
      } else if (data.type === 'requestQuickLinks') {
        // 启动页请求快捷链接数据
        const linksToSend = combinedQuickLinks.map(link => ({
          label: link.label,
          url: link.url,
          icon: link.icon || '🔗'
        }));
        
        // 通过 evaluateJavaScript 发送数据到页面
        webViewRef.current?.injectJavaScript(`
          window.setQuickLinks(${JSON.stringify(linksToSend)});
          true;
        `);
      } else if (data.type === 'addQuickLink') {
        // 启动页添加快捷链接
        handleAddQuickLink(data.label, data.url);
      } else if (data.type === 'deleteQuickLink') {
        // 启动页删除快捷链接
        const index = data.index;
        const defaultLinksCount = defaultQuickLinks.length;
        
        if (index >= defaultLinksCount) {
          // 删除的是自定义链接
          const customIndex = index - defaultLinksCount;
          const next = customQuickLinks.filter((_, i) => i !== customIndex);
          setCustomQuickLinks(next);
          persistCustomQuickLinks(next);
          
          // 刷新页面显示
          const linksToSend = [...defaultQuickLinks, ...next].map(link => ({
            label: link.label,
            url: link.url,
            icon: link.icon || '🔗'
          }));
          
          webViewRef.current?.injectJavaScript(`
            window.setQuickLinks(${JSON.stringify(linksToSend)});
            true;
          `);
        }
      } else if (data.type === 'selectBackgroundImage') {
        // 启动页选择背景图片
        handleSelectBackgroundImage();
      } else if (data.type === 'resetBackground') {
        // 启动页重置背景图片
        handleResetBackground();
      } else if (data.type === 'requestBackgroundImage') {
        // 启动页请求背景图片
        const bgImageUri = startPageBgImage || '';
        const message = JSON.stringify({
          type: 'SET_BACKGROUND',
          payload: bgImageUri
        });
        webViewRef.current?.postMessage(message);
      }
    } catch (e) {
      // 忽略非 JSON 消息
    }
  };

  /**
   * 处理标签页选择（从切换器点击标签页）
   * @param tabId - 要激活的标签页 ID
   */
  const handleSelectTab = async (tabId: string) => {
    // 立即切换，无动画（最流畅的体验）
    // 如需动画，调整下方参数：
    // - duration: 动画时长（毫秒），建议 150-300
    // - 初始 scale: 建议 0.92-0.96（越接近1越不明显但越流畅）
    // - 初始 opacity: 建议 0.7-0.9
    
    setActiveTabId(tabId);
    setSwitcherVisible(false);
    
    // 重置所有动画值
    tabSwitchScale.setValue(1);
    tabSwitchOpacity.setValue(1);
    tabExpandScale.setValue(1);
    tabExpandOpacity.setValue(1);
    webViewOpacity.setValue(1);
    
    // 可选：启用下方代码添加动画（会降低流畅度）
    /*
    tabExpandOpacity.setValue(0.8);
    Animated.timing(tabExpandOpacity, {
      toValue: 1,
      duration: 200,  // 调整此值改变动画速度
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    */
  };

  const renderBottomDock = () => (
    <Animated.View
      style={[
        styles.bottomDockWrapper,
        {
          transform: [
            { translateY: navBarTranslateY },
            { translateY: Animated.multiply(keyboardHeight, -1) }
          ],
        },
      ]}
    >
      <BlurView intensity={80} tint={Platform.OS === 'ios' ? 'default' : 'dark'} style={styles.bottomDock}>
        <View style={styles.addressRow}>
          {canGoBack && (
            <ToolbarButton 
              icon="chevron-back" 
              accessibilityLabel="后退" 
              disabled={false} 
              onPress={handleGoBack} 
            />
          )}
          {canGoForward && (
            <ToolbarButton 
              icon="chevron-forward" 
              accessibilityLabel="前进" 
              disabled={false} 
              onPress={() => {
                // 设置导航标志，防止隐藏导航栏
                isNavigatingRef.current = true;
                setTimeout(() => {
                  isNavigatingRef.current = false;
                }, 800);
                webViewRef.current?.goForward();
              }} 
            />
          )}
          <TextInput
            style={styles.input}
            value={currentInput}
            onChangeText={handleAddressChange}
            onSubmitEditing={handleSubmit}
            placeholder="搜索或输入网址"
            placeholderTextColor="#94a3b8"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            selectTextOnFocus
          />
          {isLoading ? (
            <ToolbarButton 
              icon="close" 
              accessibilityLabel="停止" 
              onPress={() => webViewRef.current?.stopLoading()} 
            />
          ) : (
            <ToolbarButton 
              icon="refresh" 
              accessibilityLabel="刷新" 
              onPress={() => webViewRef.current?.reload()} 
            />
          )}
        </View>

        <View style={styles.toolbar}>
          <ToolbarButton 
            icon="add" 
            accessibilityLabel="新标签页" 
            onPress={() => handleNewTab(false)} 
          />
          <ToolbarButton 
            icon="share-outline" 
            accessibilityLabel="分享" 
            onPress={handleShare} 
          />
          <ToolbarButton 
            icon="book-outline" 
            accessibilityLabel="收藏夹" 
            onPress={() => setBookmarksPanelVisible(true)}
            onLongPress={() => {
              if (!activeTab || activeTab.isStartPage || !activeTab.url) {
                Alert.alert('无法收藏', '请在网页中使用长按收藏');
                return;
              }
              handleAddBookmark();
              Alert.alert('已添加到收藏夹');
            }}
          />
          <ToolbarButton 
            icon="layers-outline" 
            accessibilityLabel="标签页" 
            onPress={async () => {
              await captureCurrentTabSnapshot();
              setSwitcherVisible(true);
            }}
            onLongPress={handleTabButtonLongPress}
          />
        </View>
      </BlurView>
    </Animated.View>
  );

  // ==================== 主组件渲染 ====================
  return (
    // View 容器，占满屏幕，让 WebView 延伸到状态栏区域
    <View style={[styles.fullScreen, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      {/* WebView 容器（占据主要空间） - 带标签页切换和展开动画 */}
      <Animated.View style={[
        styles.webViewWrapper, 
        { 
          backgroundColor: isDark ? '#000' : '#fff',
          // 移除 scale transform 以提升性能
          // 如需启用缩放动画，取消注释下行（会降低帧率）
          // transform: [{ scale: Animated.multiply(tabSwitchScale, tabExpandScale) }],
          opacity: Animated.multiply(tabSwitchOpacity, tabExpandOpacity),
        }
      ]}>
        {/* 为每个标签页渲染独立的WebView，通过显示/隐藏控制，避免切换时重新加载 */}
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          // 确定加载源：如果是启动页且资源已加载，使用本地文件 URI；否则使用 tab.url
          const source = (tab.isStartPage && startPageUrl) 
            ? { uri: startPageUrl } 
            : { uri: tab.url === START_PAGE_MARKER ? (startPageUrl || 'about:blank') : tab.url };

          return (
            <Animated.View
              key={tab.id}
              ref={(ref) => { webViewWrapperRefs.current[tab.id] = ref; }}
              style={[
                  // 所有WebView包装器使用绝对定位铺满容器
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? '#000' : '#fff' },
                  // 只显示活跃标签，非活跃标签彻底隐藏避免叠加
                  isActive
                    ? { opacity: webViewOpacity, zIndex: 2, display: 'flex' }
                    : { opacity: 0, zIndex: -1, display: 'none' },
              ]}
              pointerEvents={isActive ? 'auto' : 'none'}
              collapsable={false}
            >
              <WebView
                ref={(ref) => {
                  if (isActive) {
                    webViewRef.current = ref;
                  }
                }}
                source={source}
                style={styles.webView}
                onNavigationStateChange={isActive ? handleNavChange : undefined}
                onLoadStart={() => isActive && setIsLoading(true)}
                onLoadEnd={() => {
                  if (isActive) {
                    setIsLoading(false);
                    webViewOpacity.setValue(1);
                  }
                }}
                allowsBackForwardNavigationGestures={true}
                allowsInlineMediaPlayback={true}
                injectedJavaScript={scrollListenerJS}
                onMessage={isActive ? handleWebViewMessage : undefined}
                contentInsetAdjustmentBehavior="automatic"
                originWhitelist={['*']}
                allowFileAccess={true}
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
              />
            </Animated.View>
          );
        })}
        
        {/* 启动页叠加层（覆盖在 WebView 上面） - 已移除，现在使用HTML文件 */}
        {activeTab?.isStartPage && false ? (
          <View style={styles.startSurfaceOverlay}>
            <StartSurface
              rssNews={rssNews}
              isLoadingRss={isLoadingRss}
              quickLinks={combinedQuickLinks}
              onQuickLinkPress={handleOpenPreset}
              onAddQuickLink={handleAddQuickLink}
              onNewsPress={handleOpenPreset}
            />
          </View>
        ) : null}
        
        {/* 加载指示器（转圈动画 + 文字） */}
        {/* 条件渲染：isLoading 为 true 且不在启动页时显示 */}
        {isLoading && !activeTab?.isStartPage ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator color="#4f46e5" />
            <ThemedText style={styles.loaderText}>加载中…</ThemedText>
          </View>
        ) : null}
      </Animated.View>

      {/* 底部工具栏（地址栏 + 按钮），原生可用时使用 LiquidGlassView，否则回落到 BlurView */}
      {renderBottomDock()}

      {/* 标签页切换器（条件渲染） */}
      {/* 只有 isSwitcherVisible 为 true 时才渲染 */}
      {isSwitcherVisible ? (
        <TabSwitcher
          tabs={tabs}                          // 所有标签页
          activeTabId={activeTabId}            // 当前激活标签页 ID
          onSelect={handleSelectTab}           // 选择标签页回调
          onCloseTab={handleCloseTab}          // 关闭标签页回调
          onAddTab={handleNewTab}              // 新建标签页回调
          onDismiss={() => setSwitcherVisible(false)}  // 关闭切换器回调
        />
      ) : null}

      {/* 收藏夹面板（条件渲染） */}
      {isBookmarksPanelVisible ? (
        <BookmarksPanel
          bookmarks={bookmarks}
          isCurrentPageBookmarked={isCurrentPageBookmarked}
          canAddBookmark={!activeTab?.isStartPage && !!activeTab?.url}
          onAddBookmark={handleAddBookmark}
          onOpenBookmark={handleOpenBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onDismiss={() => setBookmarksPanelVisible(false)}
          isDark={colorScheme === 'dark'}
        />
      ) : null}
    </View>
  );
}

// ==================== 工具栏按钮组件 ====================
type ToolbarButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;  // 图标名称（必须是 Ionicons 支持的图标名）
  accessibilityLabel: string;            // 无障碍标签（屏幕阅读器会读取）
  disabled?: boolean;                    // 是否禁用（可选，默认 false）
  onPress: () => void;                   // 点击回调函数
  onLongPress?: () => void;              // 长按回调函数（可选）
};

/**
 * 工具栏按钮组件
 * 用于底部工具栏的前进、后退、刷新等按钮
 */
function ToolbarButton({ icon, accessibilityLabel, disabled, onPress, onLongPress }: ToolbarButtonProps) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [opacityAnim] = useState(new Animated.Value(1));
  
  const handlePress = () => {
    if (disabled) return;
    
    // 执行点击动画
    Animated.sequence([
      // 快速缩小到 0.85 并淡出到 0.6
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: false,
        }),
      ]),
      // 恢复到原始大小和不透明度
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
    
    // 执行回调
    onPress();
  };
  
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}                    // 点击事件处理
        onLongPress={onLongPress}
        disabled={disabled}                  // 禁用状态
        accessibilityRole="button"           // 声明为按钮角色（用于无障碍）
        accessibilityLabel={accessibilityLabel}  // 无障碍标签
        style={[
          styles.toolbarButton,              // 基础样式
          disabled && styles.toolbarButtonDisabled  // 禁用时应用额外样式（条件样式）
        ]}
      >
        {/* 图标：禁用时显示灰色，正常时显示深色 */}
        <Ionicons 
          name={icon} 
          size={20} 
          color={disabled ? '#94a3b8' : '#11181C'}  // 三元运算符根据状态选择颜色
        />
      </Pressable>
    </Animated.View>
  );
}

// ==================== 启动页组件 ====================
type StartSurfaceProps = {
  quickLinks: QuickLink[];                              // 快捷链接数组（预设 + 自定义）
  rssNews: RssNewsItem[];                               // RSS 新闻列表
  isLoadingRss: boolean;                                // RSS 加载状态
  onQuickLinkPress: (url: string) => void;              // 点击快捷链接的回调
  onAddQuickLink: (label: string, url: string) => Promise<void> | void;  // 添加自定义链接的回调（可能是异步）
  onNewsPress: (url: string) => void;                   // 点击新闻的回调
};

/**
 * 启动页组件
 * 显示在新标签页或空白页时，包含：
 * - 快捷链接网格
 * - 灵感任务列表
 * - 自定义快捷链接表单
 */
function StartSurface({ quickLinks, rssNews, isLoadingRss, onQuickLinkPress, onAddQuickLink, onNewsPress }: StartSurfaceProps) {
  // ==================== 表单状态 ====================
  const [linkLabel, setLinkLabel] = useState('');   // 新链接名称
  const [linkUrl, setLinkUrl] = useState('');       // 新链接地址
  const [feedback, setFeedback] = useState<string | null>(null);  // 反馈提示文字（成功/失败）
  const [isSavingLink, setIsSavingLink] = useState(false);        // 是否正在保存（防止重复提交）
  
  // 获取当前主题
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // feedbackTimeoutRef: 存储定时器 ID，用于自动清除反馈提示
  // ReturnType<typeof setTimeout> 获取 setTimeout 的返回类型（Node 中是 NodeJS.Timeout）
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==================== 清理副作用 ====================
  /**
   * useEffect 的返回函数会在组件卸载时执行（清理函数）
   * 这里清理可能还未触发的定时器，避免内存泄漏
   */
  useEffect(() => {
    return () => {
      // 组件卸载时，如果还有定时器，清除它
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);  // 空依赖数组表示只在挂载/卸载时执行

  // ==================== 事件处理函数 ====================
  
  /**
   * 高阶函数：生成输入框变化处理函数
   * @param setter - 状态更新函数（setLinkLabel 或 setLinkUrl）
   * @returns 输入框 onChangeText 回调函数
   * 
   * 这是一个函数工厂模式：
   * handleInputChange(setLinkLabel) 返回一个新函数 (text) => { ... }
   * 该新函数接收输入文本并更新状态
   */
  const handleInputChange = (setter: (text: string) => void) => (text: string) => {
    setter(text);  // 更新对应的状态
    
    // 如果有反馈提示，清除它（用户重新输入时隐藏提示）
    if (feedback) {
      setFeedback(null);
    }
  };

  /**
   * 保存新的快捷链接
   * 异步函数，处理表单提交逻辑
   */
  const handleSaveQuickLink = async () => {
    // 防止重复提交（如果正在保存，直接返回）
    if (isSavingLink) {
      return;
    }
    
    setIsSavingLink(true);  // 设置保存中状态
    
    try {
      // 调用父组件传入的保存函数（可能会抛出错误）
      await onAddQuickLink(linkLabel, linkUrl);
      
      // 保存成功，清空输入框
      setLinkLabel('');
      setLinkUrl('');
      
      // 显示成功反馈
      setFeedback('已添加到快捷方式');
      
      // 清除之前的定时器（如果有）
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      
      // 设置新定时器：2 秒后自动清除反馈提示
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 2000);
    } catch (error) {
      // 捕获异常（如重名、空输入等验证错误）
      // instanceof 检查 error 是否是 Error 类的实例
      // 如果是，获取其 message 属性；否则使用默认提示
      const message = error instanceof Error ? error.message : '保存失败，请稍后再试';
      setFeedback(message);  // 显示错误提示
    } finally {
      // finally 块无论是否抛出异常都会执行
      // 重置保存中状态
      setIsSavingLink(false);
    }
  };

  // ==================== 渲染 ====================
  return (
    <View style={[styles.startSurface, isDark && styles.startSurfaceDark]}>
      {/* 页面标题 */}
      <ThemedText type="title">启动页</ThemedText>
      
      {/* 副标题说明 */}
      <ThemedText style={[styles.startSubtitle, isDark && styles.startSubtitleDark]}>
        快捷开启研究、收藏灵感或输入地址开始浏览。
      </ThemedText>
      
      {/* 快捷链接网格 */}
      <View style={styles.quickLinkRow}>
        {/* array.map() 遍历数组，为每个元素生成一个组件 */}
        {quickLinks.map((item) => (
          <Pressable
            key={item.label}  // key 用于 React 识别列表项（必须唯一）
            style={[styles.quickLinkChip, isDark && styles.quickLinkChipDark]}
            onPress={() => onQuickLinkPress(item.url)}  // 箭头函数包装，传递 url 参数
          >
            {/* lightColor/darkColor 是 ThemedText 的自定义属性，用于适配亮/暗模式 */}
            <ThemedText lightColor="#fff" darkColor="#fff" style={styles.quickLinkText}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* 自定义快捷网址表单卡片 */}
      <View style={[styles.customLinkCard, isDark && styles.customLinkCardDark]}>
        <ThemedText type="subtitle">自定义快捷网址</ThemedText>
        
        {/* 名称输入框 */}
        <TextInput
          value={linkLabel}  // 受控组件：显示的值由状态控制
          onChangeText={handleInputChange(setLinkLabel)}  // 输入变化时调用
          placeholder="名称，例如 RSS 或 工具箱"
          placeholderTextColor={isDark ? '#888' : '#94a3b8'}
          style={[styles.customInput, isDark && styles.customInputDark]}
        />
        
        {/* 网址输入框 */}
        <TextInput
          value={linkUrl}
          onChangeText={handleInputChange(setLinkUrl)}
          placeholder="网址，例如 https://example.com"
          placeholderTextColor={isDark ? '#888' : '#94a3b8'}
          autoCapitalize="none"  // 禁用自动大写（URL 不需要）
          autoCorrect={false}    // 禁用自动纠错（避免破坏 URL）
          style={[styles.customInput, isDark && styles.customInputDark]}
        />
        
        {/* 保存按钮 */}
        <Pressable
          onPress={handleSaveQuickLink}
          disabled={isSavingLink}  // 保存中时禁用按钮
          style={[
            styles.customSaveButton,
            isSavingLink && styles.customSaveButtonDisabled  // 禁用时应用额外样式
          ]}
        >
          <ThemedText lightColor="#fff" darkColor="#000" style={styles.customSaveLabel}>
            {/* 根据状态动态显示按钮文字 */}
            {isSavingLink ? '保存中…' : '保存快捷方式'}
          </ThemedText>
        </Pressable>
        
        {/* 反馈提示（成功/失败消息） */}
        {/* 三元运算符：如果 feedback 存在则渲染，否则渲染 null（不显示） */}
        {feedback ? <ThemedText style={styles.customFeedback}>{feedback}</ThemedText> : null}
      </View>

      {/* RSS 新闻卡片 */}
      <View style={[styles.ritualCard, isDark && styles.ritualCardDark]}>
        <ThemedText type="subtitle">📰 今日新闻</ThemedText>
        {isLoadingRss ? (
          // 加载中显示提示
          <View style={styles.ritualRow}>
            <ActivityIndicator size="small" color="#2563eb" />
            <ThemedText style={styles.ritualText}>正在加载新闻...</ThemedText>
          </View>
        ) : (
          // 显示新闻列表
          rssNews.map((item, index) => (
            <Pressable
              key={`${item.title}-${index}`}
              style={styles.ritualRow}
              onPress={() => item.link && onNewsPress(item.link)}
              disabled={!item.link}
            >
              {/* 新闻图标 */}
              <Ionicons name="newspaper-outline" size={16} color="#2563eb" />
              {/* 新闻标题 */}
              <ThemedText 
                numberOfLines={1} 
                style={[styles.ritualText, item.link && { color: '#2563eb' }]}
              >
                {item.title}
              </ThemedText>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

// ==================== 屏幕尺寸 ====================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// 标签页卡片尺寸
const TAB_CARD_WIDTH = SCREEN_WIDTH * 0.75;
const TAB_CARD_HEIGHT = SCREEN_HEIGHT * 0.55;

// ==================== 标签页卡片组件 ====================
type TabCardProps = {
  tab: BrowserTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
};

/**
 * 标签页卡片组件
 * 显示网页缩略图效果，支持上滑关闭
 */
function TabCard({ tab, active, onSelect, onClose }: TabCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // 动画值
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isClosing = useRef(false);
  const isSelecting = useRef(false);
  
  // 处理标签页选择 - 触发父组件的展开动画
  const handleSelectPress = () => {
    if (isSelecting.current) return;
    isSelecting.current = true;

    // 直接触发选择，不做任何动画，避免帧率下降
    onSelect();
    isSelecting.current = false;
  };
  
  // 手势响应器 - 上滑关闭
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // 触摸开始时就准备响应
        onStartShouldSetPanResponder: () => true,
        // 只要有向上分量就接管手势（无论水平方向如何移动）
        onMoveShouldSetPanResponder: (_, { dy }) => dy < -SWIPE_MIN_DRAG,
        // 同时也要在捕获阶段拦截，确保手势不被ScrollView抢走
        onMoveShouldSetPanResponderCapture: (_, { dy, dx }) => {
          // 如果向上移动的分量存在，就捕获手势
          return dy < -SWIPE_MIN_DRAG && Math.abs(dy) > Math.abs(dx) * 0.3;
        },
        onPanResponderGrant: () => {
          isClosing.current = false;
        },
        onPanResponderMove: (_, { dy }) => {
          // 只要有向上分量就跟随（即使同时在水平移动）
          // 限制最小值为0，不允许向下拖
          const clampedDy = Math.min(0, dy);
          translateY.setValue(clampedDy);
          
          // 如果是向上滑动，计算透明度和缩放
          if (clampedDy < 0) {
            const progress = Math.min(1, Math.abs(clampedDy) / (SWIPE_CLOSE_DISTANCE * 2));
            opacity.setValue(1 - progress * 0.5);
            scale.setValue(1 - progress * 0.1);
          }
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const clampedDy = Math.min(0, dy);
          // 向上滑动超过阈值 或 有向上速度 即可关闭
          const shouldClose = (clampedDy < -SWIPE_CLOSE_DISTANCE) || (vy < SWIPE_RELEASE_VELOCITY && clampedDy < 0);
          
          if (shouldClose && !isClosing.current) {
            isClosing.current = true;
            // 关闭动画：向上飞出
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: -SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => onClose());
          } else {
            // 弹回原位
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.spring(opacity, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [onClose, translateY, opacity, scale],
  );
  
  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.tabCard,
        active && styles.tabCardActive,
        isDark && styles.tabCardDark,
        {
          transform: [
            { translateY },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      {/* 卡片头部 - 显示标题 */}
      <View style={[styles.tabCardHeader, isDark && styles.tabCardHeaderDark]}>
        <View style={styles.tabCardUrlBar}>
          <Ionicons 
            name={tab.isStartPage ? 'home' : 'globe-outline'} 
            size={14} 
            color={isDark ? '#94a3b8' : '#64748b'} 
          />
          <ThemedText numberOfLines={1} style={styles.tabCardUrl}>
            {tab.isStartPage ? '启动页' : (tab.title || tab.url.replace(/^https?:\/\//, '').split('/')[0])}
          </ThemedText>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
      </View>
      
      {/* 卡片内容 - 网页预览 */}
      <Pressable style={styles.tabCardContent} onPress={handleSelectPress}>
        {tab.snapshot ? (
          <Image 
            source={{ uri: tab.snapshot }} 
            style={{ flex: 1, width: '100%', height: '100%', resizeMode: 'cover' }} 
          />
        ) : tab.isStartPage ? (
          // 启动页预览
          <View style={[styles.tabCardPreview, isDark && styles.tabCardPreviewDark]}>
            <View style={styles.tabCardIconCircle}>
              <Ionicons name="home" size={32} color="#3b82f6" />
            </View>
            <ThemedText style={styles.tabCardPreviewText}>启动页</ThemedText>
          </View>
        ) : (
          // 网页预览 - 显示网站图标和标题
          <View style={[styles.tabCardPreview, isDark && styles.tabCardPreviewDark]}>
            {/* 网站 Favicon */}
            <View style={[styles.tabCardFavicon, isDark && styles.tabCardFaviconDark]}>
              <Ionicons name="globe" size={40} color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
            {/* 网页标题 */}
            <ThemedText numberOfLines={2} style={styles.tabCardDomain}>
              {tab.title || tab.url.replace(/^https?:\/\//, '').split('/')[0]}
            </ThemedText>
            {/* 网站域名 */}
            <ThemedText numberOfLines={1} style={styles.tabCardFullUrl}>
              {tab.url.replace(/^https?:\/\//, '').split('/')[0]}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ==================== 标签页切换器组件 ====================
type TabSwitcherProps = {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onCloseTab: (tabId: string, stayInSwitcher?: boolean) => void;
  onAddTab: (stayInSwitcher?: boolean) => void;
  onDismiss: () => void;
};

/**
 * 标签页切换器组件
 * 全屏浮层，支持左右滑动切换、上滑关闭标签页
 */
function TabSwitcher({ tabs, activeTabId, onSelect, onCloseTab, onAddTab, onDismiss }: TabSwitcherProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // 当前显示的标签页索引
  const activeIndex = tabs.findIndex(t => t.id === activeTabId);
  const [currentIndex, setCurrentIndex] = useState(activeIndex >= 0 ? activeIndex : 0);
  
  // 滚动引用
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 计算单个卡片的滚动宽度
  const cardScrollWidth = SCREEN_WIDTH * TAB_CARD_SPACING;
  
  // 初始滚动到当前标签页
  useEffect(() => {
    if (scrollViewRef.current && currentIndex >= 0) {
      scrollViewRef.current.scrollTo({
        x: currentIndex * cardScrollWidth,
        animated: false,
      });
    }
  }, []);
  
  // 处理滚动结束
  const handleScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / cardScrollWidth);
    setCurrentIndex(newIndex);
  };
  
  return (
    <View style={styles.switcherOverlay}>
      {/* 背景 */}
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      
      {/* 头部 */}
      <View style={styles.switcherHeader}>
        <Pressable onPress={onDismiss} style={styles.switcherDoneButton}>
          <ThemedText style={styles.switcherDoneText}>完成</ThemedText>
        </Pressable>
        
        <ThemedText style={styles.switcherTitle}>
          {currentIndex + 1} / {tabs.length}
        </ThemedText>
        
        <Pressable onPress={() => onAddTab(true)} style={styles.switcherAddBtn}>
          <Ionicons name="add" size={28} color={isDark ? '#fff' : '#007AFF'} />
        </Pressable>
      </View>
      
      {/* 标签页卡片滚动区域 */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={SCREEN_WIDTH * TAB_CARD_SPACING}
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.switcherScrollContent}
        decelerationRate="fast"
      >
        {tabs.map((tab, index) => (
          <View key={tab.id} style={styles.tabCardWrapper}>
            <TabCard
              tab={tab}
              active={tab.id === activeTabId}
              onSelect={() => onSelect(tab.id)}
              onClose={() => onCloseTab(tab.id, true)}
            />
          </View>
        ))}
      </ScrollView>
      
      {/* 底部操作栏 */}
      <View style={styles.switcherBottomBar}>
        {/* 页面指示器 */}
        <View style={styles.pageIndicator}>
          {tabs.map((tab, index) => (
            <View
              key={tab.id}
              style={[
                styles.pageIndicatorDot,
                index === currentIndex && styles.pageIndicatorDotActive,
              ]}
            />
          ))}
        </View>
        
        {/* 新建标签页按钮 */}
        <Pressable 
          style={styles.switcherNewTabButton}
          onPress={() => onAddTab(false)}
        >
          <Ionicons name="add-circle" size={28} color={isDark ? '#fff' : '#007AFF'} />
          <ThemedText style={[styles.switcherNewTabText, isDark && { color: '#fff' }]}>新建标签页</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ==================== 收藏夹面板组件 ====================
type BookmarksPanelProps = {
  bookmarks: BookmarkItem[];
  isCurrentPageBookmarked: boolean;
  canAddBookmark: boolean;
  onAddBookmark: () => void;
  onOpenBookmark: (url: string) => void;
  onDeleteBookmark: (id: string) => void;
  onDismiss: () => void;
  isDark: boolean;
};

/**
 * 收藏夹面板组件
 * 显示收藏的网页列表，支持添加、删除和打开收藏
 */
function BookmarksPanel({
  bookmarks,
  isCurrentPageBookmarked,
  canAddBookmark,
  onAddBookmark,
  onOpenBookmark,
  onDeleteBookmark,
  onDismiss,
  isDark,
}: BookmarksPanelProps) {
  return (
    <View style={styles.bookmarksOverlay}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      
      {/* 收藏夹面板 */}
      <View style={[styles.bookmarksPanel, isDark && styles.bookmarksPanelDark]}>
        {/* 头部 */}
        <View style={styles.bookmarksHeader}>
          <Pressable onPress={onDismiss} style={styles.bookmarksDoneButton}>
            <ThemedText style={styles.bookmarksDoneText}>完成</ThemedText>
          </Pressable>
          
          <ThemedText style={styles.bookmarksTitle}>收藏夹</ThemedText>
          
          <Pressable 
            onPress={onAddBookmark}
            disabled={!canAddBookmark || isCurrentPageBookmarked}
            style={[
              styles.bookmarksAddButton,
              (!canAddBookmark || isCurrentPageBookmarked) && styles.bookmarksAddButtonDisabled,
            ]}
          >
            <Ionicons 
              name={isCurrentPageBookmarked ? 'bookmark' : 'bookmark-outline'} 
              size={24} 
              color={isCurrentPageBookmarked ? '#fbbf24' : (canAddBookmark ? (isDark ? '#fff' : '#007AFF') : '#94a3b8')} 
            />
          </Pressable>
        </View>
        
        {/* 收藏列表 */}
        <ScrollView style={styles.bookmarksList} showsVerticalScrollIndicator={false}>
          {bookmarks.length === 0 ? (
            <View style={styles.bookmarksEmpty}>
              <Ionicons name="bookmarks-outline" size={48} color="#94a3b8" />
              <ThemedText style={styles.bookmarksEmptyText}>暂无收藏</ThemedText>
              <ThemedText style={styles.bookmarksEmptyHint}>
                浏览网页时点击右上角收藏按钮添加
              </ThemedText>
            </View>
          ) : (
            bookmarks.map((bookmark) => (
              <View 
                key={bookmark.id} 
                style={[styles.bookmarkItem, isDark && styles.bookmarkItemDark]}
              >
                <Pressable 
                  style={styles.bookmarkContent}
                  onPress={() => onOpenBookmark(bookmark.url)}
                >
                  <Ionicons 
                    name="globe-outline" 
                    size={20} 
                    color={isDark ? '#94a3b8' : '#64748b'} 
                  />
                  <View style={styles.bookmarkTextContainer}>
                    <ThemedText numberOfLines={1} style={styles.bookmarkTitle}>
                      {bookmark.title}
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={styles.bookmarkUrl}>
                      {bookmark.url.replace(/^https?:\/\//, '')}
                    </ThemedText>
                  </View>
                </Pressable>
                <Pressable 
                  style={styles.bookmarkDeleteButton}
                  onPress={() => onDeleteBookmark(bookmark.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ==================== 样式定义 ====================
/**
 * StyleSheet.create() 创建样式表对象
 * 
 * React Native 样式语法说明：
 * - flex: 弹性布局，数字表示占据的比例（flex: 1 表示占满可用空间）
 * - flexDirection: 主轴方向（'row' 水平，'column' 垂直，默认 'column'）
 * - gap: 子元素间距（仅较新版本支持）
 * - padding: 内边距（paddingHorizontal 水平，paddingVertical 垂直）
 * - margin: 外边距
 * - borderRadius: 圆角半径
 * - position: 定位方式（'absolute' 绝对定位，'relative' 相对定位）
 * - overflow: 溢出处理（'hidden' 隐藏溢出内容）
 */
const styles = StyleSheet.create({
  // 全屏容器（占满整个屏幕，包括状态栏区域）
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',      // 黑色背景，深色模式友好
  },
  
  // SafeAreaView 容器样式（保留用于其他地方）
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  // 主容器样式
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 0,
    gap: 8,
  },
  // WebView 包裹容器
  webViewWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  // WebView 样式
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // 启动页叠加层（覆盖在 WebView 上面）
  startSurfaceOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  // 底部导航栏动画包裹容器
  bottomDockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  startSurface: {
    flex: 1,
    padding: 24,
    paddingTop: 60,               // 顶部安全区域 padding
    gap: 16,
    justifyContent: 'flex-start',
    backgroundColor: '#f8fafc',   // 启动页使用浅色背景
  },
  // 启动页深色模式
  startSurfaceDark: {
    backgroundColor: '#1c1c1e',
  },
  startSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  // 副标题深色模式
  startSubtitleDark: {
    color: '#a1a1aa',
  },
  quickLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLinkChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2563eb',
  },
  // 快捷链接按钮深色模式
  quickLinkChipDark: {
    backgroundColor: '#3b82f6',
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customLinkCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
    backgroundColor: '#fff',
  },
  // 自定义链接卡片深色模式
  customLinkCardDark: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  customHelper: {
    fontSize: 12,
    color: '#64748b',
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#d4dbe8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  // 输入框深色模式
  customInputDark: {
    backgroundColor: '#1c1c1e',
    borderColor: '#3a3a3c',
    color: '#fff',
  },
  customSaveButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  customSaveButtonDisabled: {
    opacity: 0.6,
  },
  customSaveLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  customFeedback: {
    fontSize: 12,
    color: '#0f172a',
  },
  ritualCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
  },
  // 加载指示器浮层
  loaderOverlay: {
    // ...StyleSheet.absoluteFillObject 是对象展开运算符，等价于：
    // position: 'absolute', left: 0, right: 0, top: 0, bottom: 0
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',  // 半透明黑色背景
    justifyContent: 'center',             // 垂直居中
    alignItems: 'center',                 // 水平居中
    gap: 8,
  },
  loaderText: {
    fontSize: 14,
    color: '#475569',
  },
  bottomDock: {
    gap: 12,
    paddingBottom: 34,
    paddingTop: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  toolbarButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
  },
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  // 标签页切换器浮层（全屏遮罩）
  switcherOverlay: {
    ...StyleSheet.absoluteFillObject,           // 绝对定位，占满整个屏幕
    justifyContent: 'flex-end',                 // 内容靠底部对齐（面板从底部弹出）
    backgroundColor: 'rgba(15, 23, 42, 0.35)',  // 半透明深色背景（遮罩层）
  },
  switcherPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switcherAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2ff',
  },
  switcherAddLabel: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  switcherList: {
    gap: 10,
  },
  // ==================== 滑动手势相关样式 ====================
  
  // 滑动轨道容器（包含红色背景 + 卡片）
  swipeTrack: {
    position: 'relative',  // 相对定位，作为子元素绝对定位的参照
    overflow: 'hidden',    // 隐藏溢出内容（裁剪圆角外的内容）
    borderRadius: 16,      // 圆角
  },
  
  // 左侧红色删除区域（向右滑动时显示）
  swipeActionLeft: {
    position: 'absolute',       // 绝对定位
    left: 0,                    // 贴左边
    top: 0,
    bottom: 0,                  // 上下撑满
    width: 120,                 // 固定宽度 120px
    backgroundColor: '#ef4444', // 红色背景
    justifyContent: 'center',   // 内容垂直居中
    alignItems: 'center',       // 内容水平居中
    gap: 4,                     // 子元素间距（图标和文字）
  },
  
  // 右侧红色删除区域（向左滑动时显示）
  swipeActionRight: {
    position: 'absolute',
    right: 0,                   // 贴右边
    top: 0,
    bottom: 0,
    width: 120,                 // 固定宽度 120px
    backgroundColor: '#ef4444', // 红色背景
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  
  // 滑动提示文字样式（"关闭" / "松手关闭"）
  swipeActionLabel: {
    fontSize: 13,
    color: '#fff',         // 白色文字
    fontWeight: '500',     // 中等粗细
  },
  // 标签页卡片样式（可滑动的主体）
  switcherCard: {
    flexDirection: 'row',       // 水平布局（图标在左，内容在中，关闭按钮在右）
    alignItems: 'center',       // 垂直居中对齐
    padding: 12,                // 内边距
    borderRadius: 16,           // 圆角
    borderWidth: 1,             // 边框宽度
    borderColor: '#e2e8f0',     // 灰色边框
    backgroundColor: '#fff',    // 白色背景
  },
  
  // 激活状态的卡片样式（蓝色边框）
  switcherCardActive: {
    borderColor: '#2563eb',     // 蓝色边框，表示当前激活
  },
  switcherCardBody: {
    flex: 1,
    gap: 4,
  },
  switcherCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  switcherCardSubtitle: {
    fontSize: 12,
    color: '#475569',
  },
  switcherCloseButton: {
    marginLeft: 12,
    padding: 6,
  },
  
  // ==================== 新版标签页切换器样式 ====================
  
  // 切换器头部栏
  switcherHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  switcherDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switcherDoneText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  switcherTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  switcherAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  // 标签页卡片滚动内容
  // 添加水平内边距使第一个和最后一个卡片居中显示
  switcherScrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: (SCREEN_WIDTH - SCREEN_WIDTH * TAB_CARD_SPACING) / 2,
  },
  
  // 单个标签页卡片包裹器
  // 调整 TAB_CARD_SPACING 常量来控制卡片间距
  tabCardWrapper: {
    width: SCREEN_WIDTH * TAB_CARD_SPACING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // 标签页卡片主体样式
  tabCard: {
    width: TAB_CARD_WIDTH,
    height: TAB_CARD_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  
  // 激活状态的标签页卡片
  tabCardActive: {
    borderColor: '#007AFF',
  },
  
  // 深色模式标签页卡片
  tabCardDark: {
    backgroundColor: '#1c1c1e',
  },
  
  // 标签页卡片头部（网址栏）
  tabCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  // 深色模式卡片头部
  tabCardHeaderDark: {
    backgroundColor: '#2c2c2e',
    borderBottomColor: '#3a3a3c',
  },
  
  // 网址栏容器
  tabCardUrlBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  
  // 网址文本
  tabCardUrl: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },
  
  // 标签页卡片容器（包含阴影）
  tabCardContainer: {
    width: TAB_CARD_WIDTH,
    height: TAB_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  
  // 标签页卡片内容（可点击区域）
  tabCardContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  
  // 激活状态的卡片边框
  tabCardContentActive: {
    borderColor: '#007AFF',
  },
  
  // 深色模式卡片背景
  tabCardContentDark: {
    backgroundColor: '#1c1c1e',
  },
  
  // 卡片预览区域（显示图标和域名）
  tabCardPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 16,
    padding: 20,
  },
  tabCardPreviewDark: {
    backgroundColor: '#2c2c2e',
  },
  tabCardPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  // 启动页图标圆圈
  tabCardIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 网站 Favicon 容器
  tabCardFavicon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tabCardFaviconDark: {
    backgroundColor: '#374151',
  },
  // 网站域名
  tabCardDomain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  // 完整网址
  tabCardFullUrl: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // 卡片关闭按钮
  tabCardCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // 上滑提示
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
  swipeHintText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  
  // 页面指示器
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pageIndicatorDotActive: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  // ==================== 标签页切换器底部操作栏 ====================
  switcherBottomBar: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 40,
    gap: 16,
  },
  switcherNewTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
  },
  switcherNewTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  
  // ==================== 收藏夹面板样式 ====================
  bookmarksOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bookmarksPanel: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 34,
  },
  bookmarksPanelDark: {
    backgroundColor: '#1c1c1e',
  },
  bookmarksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  bookmarksDoneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bookmarksDoneText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  bookmarksTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  bookmarksAddButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bookmarksAddButtonDisabled: {
    opacity: 0.5,
  },
  bookmarksList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bookmarksEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  bookmarksEmptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#64748b',
  },
  bookmarksEmptyHint: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  bookmarkItemDark: {
    backgroundColor: '#2c2c2e',
  },
  bookmarkContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookmarkTextContainer: {
    flex: 1,
    gap: 2,
  },
  bookmarkTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  bookmarkUrl: {
    fontSize: 12,
    color: '#64748b',
  },
  bookmarkDeleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
