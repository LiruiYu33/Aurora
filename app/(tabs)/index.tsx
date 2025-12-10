// ==================== 导入依赖 ====================
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
  Keyboard,
  Platform,
  Share,
  TextInput,
  View
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { summarisePage } from '@/services/SummariseService';

// 导入组件
import {
  ToolbarButton,
  StartSurface,
  TabSwitcher,
  BookmarksPanel,
  SummaryDrawer,
  SettingsPanel
} from './components';

// 导入类型、常量、工具函数和样式
import type { BrowserTab, QuickLink, RssNewsItem, BookmarkItem } from './types';
import {
  DEFAULT_URL,
  START_PAGE_MARKER,
  QUICK_LINK_STORAGE_KEY,
  BOOKMARKS_STORAGE_KEY,
  START_PAGE_BG_STORAGE_KEY,
  defaultQuickLinks,
  NAVBAR_HIDE_OFFSET,
  EXTRACT_CONTENT_SCRIPT
} from './constants';
import { createTab, formatInput } from './utils';
import { styles } from './styles';

// ==================== 主浏览器组件 ====================
export default function SimpleBrowser() {
  // ==================== 状态管理 ====================
  const initialTabRef = useRef<BrowserTab>(createTab());
  const [tabs, setTabs] = useState<BrowserTab[]>([initialTabRef.current]);
  const [activeTabId, setActiveTabId] = useState(initialTabRef.current.id);
  const [isSwitcherVisible, setSwitcherVisible] = useState(false);
  const [shouldDismissSwitcher, setShouldDismissSwitcher] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customQuickLinks, setCustomQuickLinks] = useState<QuickLink[]>([]);
  const [startPageBgImage, setStartPageBgImage] = useState<string | null>(null);
  const [rssNews, setRssNews] = useState<RssNewsItem[]>([]);
  const [isLoadingRss, setIsLoadingRss] = useState(true);
  const [startPageUrl, setStartPageUrl] = useState<string | null>(null);
  
  // 总结状态
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryDrawerVisible, setSummaryDrawerVisible] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string>('');
  const [pageContentForChat, setPageContentForChat] = useState<string>('');
  const [lastSummarizedUrl, setLastSummarizedUrl] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  
  // 下拉刷新状态
  const [pullDownDistance, setPullDownDistance] = useState(0);
  const pullDownY = useRef(new Animated.Value(0)).current;
  const PULL_REFRESH_THRESHOLD = 300;
  
  // API Key 、模型和设置面板状态
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Qwen/Qwen2.5-7B-Instruct');
  const [ragflowApiKey, setRagflowApiKey] = useState<string>('');
  const [ragflowBaseUrl, setRagflowBaseUrl] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<'siliconflow' | 'ragflow'>('siliconflow');
  const [isSettingsPanelVisible, setSettingsPanelVisible] = useState(false);
  
  const API_KEY_STORAGE_KEY = 'browser.siliconflow.apikey.v1';
  const MODEL_STORAGE_KEY = 'browser.siliconflow.model.v1';
  const RAGFLOW_API_KEY_STORAGE_KEY = 'browser.ragflow.apikey.v1';
  const RAGFLOW_BASE_URL_STORAGE_KEY = 'browser.ragflow.baseurl.v1';
  const SELECTED_PROVIDER_STORAGE_KEY = 'browser.ai.provider.v1';

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
    
    const loadApiKey = async () => {
      try {
        const key = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
        if (key) setApiKey(key);
        
        const ragKey = await AsyncStorage.getItem(RAGFLOW_API_KEY_STORAGE_KEY);
        if (ragKey) setRagflowApiKey(ragKey);
        
        const ragUrl = await AsyncStorage.getItem(RAGFLOW_BASE_URL_STORAGE_KEY);
        if (ragUrl) setRagflowBaseUrl(ragUrl);
        
        const provider = await AsyncStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY);
        if (provider === 'siliconflow' || provider === 'ragflow') {
          setSelectedProvider(provider);
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      }
    };
    
    const loadModel = async () => {
      try {
        const model = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
        if (model) {
          setSelectedModel(model);
        }
      } catch (e) {
        console.warn('Failed to load model', e);
      }
    };
    
    loadStartPage();
    loadBackgroundImage();
    loadApiKey();
    loadModel();
  }, []);

  // ==================== 派生状态（计算值） ====================
  const currentInput = tabs.find((tab) => tab.id === activeTabId)?.input ?? '';
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const combinedQuickLinks = [...defaultQuickLinks, ...customQuickLinks];
  
  const webViewRef = useRef<WebView>(null);
  const webViewWrapperRefs = useRef<Record<string, any>>({});
  const isNavigatingRef = useRef(false);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 将已保存的启动页背景同步给 WebView
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
  const [isNavBarVisible, setIsNavBarVisible] = useState(true);
  const navBarTranslateY = useRef(new Animated.Value(0)).current;
  const webViewOpacity = useRef(new Animated.Value(1)).current;
  const tabSwitchScale = useRef(new Animated.Value(1)).current;
  const tabSwitchOpacity = useRef(new Animated.Value(1)).current;
  const tabExpandScale = useRef(new Animated.Value(1)).current;
  const tabExpandOpacity = useRef(new Animated.Value(1)).current;
  const buttonAnimations = useRef<Record<string, { scale: Animated.Value; opacity: Animated.Value }>>({}).current;
  
  // ==================== 收藏夹状态 ====================
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isBookmarksPanelVisible, setBookmarksPanelVisible] = useState(false);
  
  // ==================== 键盘状态 ====================
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // ==================== 副作用：监听键盘 ====================
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
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
  const persistCustomQuickLinks = async (next: QuickLink[]) => {
    try {
      await AsyncStorage.setItem(QUICK_LINK_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('保存快捷网址失败', error);
    }
  };

  const handleAddQuickLink = async (label: string, rawUrl: string) => {
    const normalizedLabel = label.trim();
    const normalizedRawUrl = rawUrl.trim();
    
    if (!normalizedLabel || !normalizedRawUrl) {
      throw new Error('请输入名称和网址');
    }
    
    const formattedUrl = formatInput(normalizedRawUrl);
    
    const duplicate = combinedQuickLinks.some(
      (item) => item.label.toLowerCase() === normalizedLabel.toLowerCase(),
    );
    
    if (duplicate) {
      throw new Error('已存在同名快捷方式');
    }
    
    const next = [...customQuickLinks, { label: normalizedLabel, url: formattedUrl }];
    setCustomQuickLinks(next);
    await persistCustomQuickLinks(next);
  };

  // ==================== 启动页背景图片管理函数 ====================
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
        const base64 = await FileSystem.readAsStringAsync(pickedUri, {
          encoding: 'base64',
        });
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        
        setStartPageBgImage(dataUrl);
        
        try {
          await AsyncStorage.setItem(START_PAGE_BG_STORAGE_KEY, dataUrl);
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
  
  const handleResetBackground = async () => {
    setStartPageBgImage(null);
    try {
      await AsyncStorage.removeItem(START_PAGE_BG_STORAGE_KEY);
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
  
  const handleSaveApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key);
      Alert.alert('保存成功', 'API Key 已保存');
      setSettingsPanelVisible(false);
    } catch (e) {
      Alert.alert('保存失败', '无法保存 API Key');
    }
  };
  
  const handleSaveRagflowConfig = async (key: string, url: string) => {
    try {
      await AsyncStorage.setItem(RAGFLOW_API_KEY_STORAGE_KEY, key);
      await AsyncStorage.setItem(RAGFLOW_BASE_URL_STORAGE_KEY, url);
      setRagflowApiKey(key);
      setRagflowBaseUrl(url);
      Alert.alert('保存成功', 'RAGFlow 配置已保存');
      setSettingsPanelVisible(false);
    } catch (e) {
      Alert.alert('保存失败', '无法保存 RAGFlow 配置');
    }
  };
  
  const handleProviderChange = async (provider: 'siliconflow' | 'ragflow') => {
    try {
      await AsyncStorage.setItem(SELECTED_PROVIDER_STORAGE_KEY, provider);
      setSelectedProvider(provider);
    } catch (e) {
      console.warn('Failed to save provider', e);
    }
  };
  
  const handleSaveModel = async (model: string) => {
    try {
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, model);
      setSelectedModel(model);
    } catch (e) {
      console.warn('Failed to save model', e);
    }
  };
  
  const handleSummarize = async () => {
    if (!activeTab || activeTab.isStartPage) {
      setSummaryError('启动页无需总结');
      setSummaryDrawerVisible(true);
      return;
    }
    
    if (!apiKey) {
      setSummaryError('请先设置 API Key\n点击设置按钮配置硅基流动 API Key');
      setSummaryDrawerVisible(true);
      return;
    }
    
    if (isSummarizing) return;
    
    if (activeTab.url === lastSummarizedUrl && summaryContent && !summaryError) {
      setSummaryDrawerVisible(true);
      return;
    }
    
    try {
      setIsSummarizing(true);
      setSummaryError(null);
      setSummaryContent('');
      setSummaryDrawerVisible(true);
      
      webViewRef.current?.injectJavaScript(EXTRACT_CONTENT_SCRIPT);
      
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = setTimeout(() => {
        if (isSummarizing) {
          setIsSummarizing(false);
          setSummaryError('提取页面内容超时\n请重试或检查网络');
        }
      }, 15000);
      
    } catch (error: any) {
      setSummaryError(error.message || '总结失败\n请确保后端服务已启动');
      setIsSummarizing(false);
    }
  };

  // ==================== 收藏夹管理函数 ====================
  const persistBookmarks = async (next: BookmarkItem[]) => {
    try {
      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('保存收藏夹失败', error);
    }
  };

  const handleAddBookmark = async () => {
    if (!activeTab || activeTab.isStartPage || !activeTab.url) {
      return;
    }
    
    const exists = bookmarks.some(b => b.url === activeTab.url);
    if (exists) {
      return;
    }
    
    const newBookmark: BookmarkItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: activeTab.title || activeTab.url.replace(/^https?:\/\//, '').split('/')[0],
      url: activeTab.url,
      createdAt: Date.now(),
    };
    
    const next = [newBookmark, ...bookmarks];
    setBookmarks(next);
    await persistBookmarks(next);
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    const next = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(next);
    await persistBookmarks(next);
  };

  const handleOpenBookmark = (url: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { url, input: url, isStartPage: false });
    }
    setBookmarksPanelVisible(false);
  };

  const isCurrentPageBookmarked = useMemo(() => {
    if (!activeTab || activeTab.isStartPage || !activeTab.url) return false;
    return bookmarks.some(b => b.url === activeTab.url);
  }, [activeTab, bookmarks]);

  // ==================== 标签页管理函数 ====================
  const updateTab = (tabId: string, updates: Partial<BrowserTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)));
  };

  const captureCurrentTabSnapshot = async () => {
    if (!activeTab) return;
    const wrapperRef = webViewWrapperRefs.current[activeTab.id];
    if (!wrapperRef) return;
    try {
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

  const handleNewTab = async (stayInSwitcher = false) => {
    if (!isSwitcherVisible) {
      await captureCurrentTabSnapshot();
    }
    
    tabSwitchScale.setValue(1);
    tabSwitchOpacity.setValue(1);
    tabExpandScale.setValue(1);
    tabExpandOpacity.setValue(1);
    
    const nextTab = createTab();
    setTabs((prev) => [...prev, nextTab]);
    setActiveTabId(nextTab.id);
    setCanGoBack(false);
    setCanGoForward(false);
    
    if (!stayInSwitcher) {
      setSwitcherVisible(false);
    }
  };

  const handleCloseTab = (targetId: string, stayInSwitcher = false) => {
    setTabs((prev) => {
      if (prev.length === 1) {
        const fresh = createTab();
        setActiveTabId(fresh.id);
        setCanGoBack(false);
        setCanGoForward(false);
        return [fresh];
      }
      
      const filtered = prev.filter((tab) => tab.id !== targetId);
      
      if (targetId === activeTabId) {
        const fallbackId = filtered[filtered.length - 1]?.id ?? filtered[0]?.id;
        if (fallbackId) {
          setActiveTabId(fallbackId);
        }
        setCanGoBack(false);
        setCanGoForward(false);
      }
      
      return filtered;
    });
    
    if (!stayInSwitcher) {
      setSwitcherVisible(false);
    }
  };

  const handleCloseAllTabs = () => {
    const fresh = createTab();
    setTabs([fresh]);
    setActiveTabId(fresh.id);
    setCanGoBack(false);
    setCanGoForward(false);
    setSwitcherVisible(false);
  };

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
          destructiveButtonIndex: 1,
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
  const handleSubmit = () => {
    if (!activeTab || !activeTab.input.trim()) {
      return;
    }
    
    const target = formatInput(activeTab.input);
    
    if (target === activeTab.url) {
      webViewRef.current?.reload();
      updateTab(activeTab.id, { input: target });
      return;
    }
    
    Animated.timing(webViewOpacity, {
      toValue: 0.6,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    updateTab(activeTab.id, { url: target, input: target, isStartPage: false });
  };

  const handleAddressChange = (text: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { input: text });
    }
  };

  const handleOpenPreset = (rawValue: string) => {
    if (!activeTab) {
      return;
    }
    
    Animated.timing(webViewOpacity, {
      toValue: 0.4,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    const target = formatInput(rawValue);
    updateTab(activeTab.id, { url: target, input: target, isStartPage: false });
  };

  const handleShare = async () => {
    if (!activeTab) return;
    const urlToShare = activeTab.isStartPage ? DEFAULT_URL : activeTab.url;
    if (!urlToShare) return;
    try {
      await Share.share({ url: urlToShare });
    } catch (error) {
      console.warn('分享失败', error);
    }
  };

  const handleGoBack = () => {
    if (!activeTab) return;
    
    if (activeTab.isStartPage) {
      return;
    }
    
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
    
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
    
    if (canGoBack && activeTab.url !== startPageUrl && activeTab.url !== START_PAGE_MARKER) {
      webViewRef.current?.goBack();
    } else {
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

  const handleNavChange = (navState: WebViewNavigation) => {
    if (!activeTab) return;
    
    const isOnStartPage = navState.url === startPageUrl || navState.url === START_PAGE_MARKER || navState.url.includes('start-page.html');
    
    const canGoBackToWeb = navState.canGoBack;
    const canGoBackToStart = !isOnStartPage;
    
    setCanGoBack(canGoBackToWeb || canGoBackToStart);
    setCanGoForward(navState.canGoForward);
    
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

  useEffect(() => {
    if (isSwitcherVisible) {
      captureCurrentTabSnapshot();
    }
  }, [isSwitcherVisible]);

  // ==================== 导航栏显示/隐藏动画 ====================
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

  const scrollListenerJS = `
    (function() {
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
      
      let touchStartY = 0;
      let touchStartX = 0;
      let touchStartScrollY = 0;
      let pullStartY = 0;
      let accumulatedPull = 0;
      let isTracking = false;
      
      document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartScrollY = window.scrollY;
        isTracking = false;
        accumulatedPull = 0;
      }, { passive: true });
      
      document.addEventListener('touchmove', function(e) {
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const currentScrollY = window.scrollY;
        
        const isAtTop = currentScrollY <= 10;
        const startedAtTop = touchStartScrollY <= 10;
        
        if (!isTracking) {
          const dy = currentY - touchStartY;
          const dx = currentX - touchStartX;
          
          if (startedAtTop && isAtTop && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
             if (dy > 5) {
               isTracking = true;
               pullStartY = currentY;
             }
          }
        }
        
        if (isTracking) {
          if (currentScrollY > 10) {
            isTracking = false;
            accumulatedPull = 0;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pullCancel' }));
            return;
          }
          
          const rawPull = currentY - pullStartY;
          accumulatedPull = Math.max(0, rawPull);
          
          if (accumulatedPull > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pull',
              distance: accumulatedPull
            }));
          }
        }
      }, { passive: true });
      
      document.addEventListener('touchend', function() {
        if (isTracking) {
          if (accumulatedPull > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pullEnd',
              distance: accumulatedPull
            }));
          }
          isTracking = false;
          accumulatedPull = 0;
        }
      }, { passive: true });
      
      document.addEventListener('touchcancel', function() {
        if (isTracking) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pullCancel' }));
          isTracking = false;
          accumulatedPull = 0;
        }
      }, { passive: true });
      
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            
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

  const handleWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'pull') {
        console.log('Pull distance:', data.distance);
        setPullDownDistance(data.distance);
        Animated.timing(pullDownY, {
          toValue: Math.min(data.distance * 0.4, 60),
          duration: 0,
          useNativeDriver: true,
        }).start();
      } else if (data.type === 'pullEnd') {
        const distance = data.distance || pullDownDistance;
        console.log('Pull end, distance:', distance, 'refresh threshold:', PULL_REFRESH_THRESHOLD);
        
        setPullDownDistance(0);
        
        Animated.spring(pullDownY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }).start();
        
        if (distance >= PULL_REFRESH_THRESHOLD) {
          console.log('Reloading page');
          webViewRef.current?.reload();
          setLastSummarizedUrl(null);
        } else {
          console.log('Distance too short, no action');
        }
      } else if (data.type === 'pullCancel') {
        setPullDownDistance(0);
        Animated.spring(pullDownY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      } else if (data.type === 'scroll') {
        if (isNavigatingRef.current || activeTab?.isStartPage) {
          showNavBar();
          return;
        }
        
        if (data.direction === 'down' && data.scrollY > 50) {
          hideNavBar();
        } else if (data.direction === 'up') {
          showNavBar();
        }
      } else if (data.type === 'requestQuickLinks') {
        const linksToSend = combinedQuickLinks.map(link => ({
          label: link.label,
          url: link.url,
          icon: link.icon || '🔗'
        }));
        
        webViewRef.current?.injectJavaScript(`
          window.setQuickLinks(${JSON.stringify(linksToSend)});
          true;
        `);
      } else if (data.type === 'addQuickLink') {
        handleAddQuickLink(data.label, data.url);
      } else if (data.type === 'deleteQuickLink') {
        const index = data.index;
        const defaultLinksCount = defaultQuickLinks.length;
        
        if (index >= defaultLinksCount) {
          const customIndex = index - defaultLinksCount;
          const next = customQuickLinks.filter((_, i) => i !== customIndex);
          setCustomQuickLinks(next);
          persistCustomQuickLinks(next);
          
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
        handleSelectBackgroundImage();
      } else if (data.type === 'resetBackground') {
        handleResetBackground();
      } else if (data.type === 'requestBackgroundImage') {
        const bgImageUri = startPageBgImage || '';
        const message = JSON.stringify({
          type: 'SET_BACKGROUND',
          payload: bgImageUri
        });
        webViewRef.current?.postMessage(message);
      } else if (data.type === 'PAGE_CONTENT') {
        if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
        
        setPageContentForChat(data.content);
        
        try {
          const summary = await summarisePage(
            data.content,
            apiKey,
            selectedModel,
            activeTab?.url
          );
          setSummaryContent(summary);
          setLastSummarizedUrl(activeTab?.url || null);
        } catch (error: any) {
          setSummaryError(error.message || '总结生成失败');
        } finally {
          setIsSummarizing(false);
        }
      } else if (data.type === 'PAGE_CONTENT_ERROR') {
        if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
        setSummaryError('无法提取页面内容: ' + data.error);
        setIsSummarizing(false);
      }
    } catch (e) {
      // 忽略非 JSON 消息
    }
  };

  const handleSelectTab = async (tabId: string) => {
    setActiveTabId(tabId);
    setSwitcherVisible(false);
    
    tabSwitchScale.setValue(1);
    tabSwitchOpacity.setValue(1);
    tabExpandScale.setValue(1);
    tabExpandOpacity.setValue(1);
    webViewOpacity.setValue(1);
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
          ) : isSummarizing ? (
            <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
          ) : (
            <ToolbarButton 
              icon="sparkles" 
              accessibilityLabel="总结" 
              onPress={handleSummarize} 
            />
          )}
        </View>

        <View style={styles.toolbar}>
          <ToolbarButton 
            icon="settings-outline" 
            accessibilityLabel="设置" 
            onPress={() => setSettingsPanelVisible(true)} 
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
              if (isSwitcherVisible) {
                setShouldDismissSwitcher(true);
              } else {
                await captureCurrentTabSnapshot();
                setSwitcherVisible(true);
              }
            }}
            onLongPress={handleTabButtonLongPress}
          />
        </View>
      </BlurView>
    </Animated.View>
  );

  // ==================== 主组件渲染 ====================
  return (
    <View style={[styles.fullScreen, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <Animated.View style={[
        styles.webViewWrapper, 
        { 
          backgroundColor: isDark ? '#000' : '#fff',
          opacity: Animated.multiply(tabSwitchOpacity, tabExpandOpacity),
        }
      ]}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const source = (tab.isStartPage && startPageUrl) 
            ? { uri: startPageUrl } 
            : { uri: tab.url === START_PAGE_MARKER ? (startPageUrl || 'about:blank') : tab.url };

          return (
            <Animated.View
              key={tab.id}
              ref={(ref) => { webViewWrapperRefs.current[tab.id] = ref; }}
              style={[
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? '#000' : '#fff' },
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
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView error:', nativeEvent);
                  if (isActive) {
                    setIsLoading(false);
                  }
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView HTTP error:', nativeEvent);
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
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                cacheEnabled={true}
                startInLoadingState={false}
                mixedContentMode="always"
              />
            </Animated.View>
          );
        })}
        
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
        
        {isLoading && !activeTab?.isStartPage ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator color="#4f46e5" />
            <ThemedText style={styles.loaderText}>加载中…</ThemedText>
          </View>
        ) : null}
        
        {pullDownDistance > 0 && !activeTab?.isStartPage ? (
          <Animated.View 
            style={[
              styles.pullDownHint,
              { 
                transform: [{ translateY: pullDownY }],
                opacity: pullDownY.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              }
            ]}
          >
            <Ionicons 
              name={pullDownDistance > PULL_REFRESH_THRESHOLD ? 'checkmark-circle' : 'arrow-down-circle'} 
              size={32} 
              color={pullDownDistance > PULL_REFRESH_THRESHOLD ? '#10b981' : '#94a3b8'} 
            />
            <ThemedText style={styles.pullDownText}>
              {pullDownDistance > PULL_REFRESH_THRESHOLD ? '松开刷新' : '下拉刷新'}
            </ThemedText>
          </Animated.View>
        ) : null}
      </Animated.View>

      {renderBottomDock()}

      {isSwitcherVisible ? (
        <TabSwitcher
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={handleSelectTab}
          onCloseTab={handleCloseTab}
          onAddTab={handleNewTab}
          onDismiss={() => {
            setSwitcherVisible(false);
            setShouldDismissSwitcher(false);
          }}
          shouldDismiss={shouldDismissSwitcher}
        />
      ) : null}

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
      
      {isSettingsPanelVisible ? (
        <SettingsPanel
          apiKey={apiKey}
          selectedModel={selectedModel}
          ragflowApiKey={ragflowApiKey}
          ragflowBaseUrl={ragflowBaseUrl}
          selectedProvider={selectedProvider}
          onSave={handleSaveApiKey}
          onSaveRagflow={handleSaveRagflowConfig}
          onModelChange={handleSaveModel}
          onProviderChange={handleProviderChange}
          onDismiss={() => setSettingsPanelVisible(false)}
          isDark={colorScheme === 'dark'}
        />
      ) : null}
      
      <SummaryDrawer
        visible={summaryDrawerVisible}
        content={summaryContent}
        pageContent={pageContentForChat}
        apiKey={apiKey}
        model={selectedModel}
        ragflowApiKey={ragflowApiKey}
        ragflowBaseUrl={ragflowBaseUrl}
        selectedProvider={selectedProvider}
        error={summaryError}
        isLoading={isSummarizing}
        onDismiss={() => setSummaryDrawerVisible(false)}
        onShare={() => Share.share({ message: summaryContent })}
        isDark={colorScheme === 'dark'}
      />
    </View>
  );
}
