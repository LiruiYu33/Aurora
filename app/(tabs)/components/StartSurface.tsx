import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

import type { QuickLink, RssNewsItem } from '../types';
import { styles } from '../styles';

type StartSurfaceProps = {
  quickLinks: QuickLink[];
  rssNews: RssNewsItem[];
  isLoadingRss: boolean;
  onQuickLinkPress: (url: string) => void;
  onAddQuickLink: (label: string, url: string) => Promise<void> | void;
  onNewsPress: (url: string) => void;
};

export function StartSurface({ 
  quickLinks, 
  rssNews, 
  isLoadingRss, 
  onQuickLinkPress, 
  onAddQuickLink, 
  onNewsPress 
}: StartSurfaceProps) {
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (setter: (text: string) => void) => (text: string) => {
    setter(text);
    if (feedback) {
      setFeedback(null);
    }
  };

  const handleSaveQuickLink = async () => {
    if (isSavingLink) return;
    
    setIsSavingLink(true);
    
    try {
      await onAddQuickLink(linkLabel, linkUrl);
      setLinkLabel('');
      setLinkUrl('');
      setFeedback('已添加到快捷方式');
      
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后再试';
      setFeedback(message);
    } finally {
      setIsSavingLink(false);
    }
  };

  return (
    <View style={[styles.startSurface, isDark && styles.startSurfaceDark]}>
      <ThemedText type="title">启动页</ThemedText>
      
      <ThemedText style={[styles.startSubtitle, isDark && styles.startSubtitleDark]}>
        快捷开启研究、收藏灵感或输入地址开始浏览。
      </ThemedText>
      
      <View style={styles.quickLinkRow}>
        {quickLinks.map((item) => (
          <Pressable
            key={item.label}
            style={[styles.quickLinkChip, isDark && styles.quickLinkChipDark]}
            onPress={() => onQuickLinkPress(item.url)}
          >
            <ThemedText lightColor="#fff" darkColor="#fff" style={styles.quickLinkText}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.customLinkCard, isDark && styles.customLinkCardDark]}>
        <ThemedText type="subtitle">自定义快捷网址</ThemedText>
        
        <TextInput
          value={linkLabel}
          onChangeText={handleInputChange(setLinkLabel)}
          placeholder="名称，例如 RSS 或 工具箱"
          placeholderTextColor={isDark ? '#888' : '#94a3b8'}
          style={[styles.customInput, isDark && styles.customInputDark]}
        />
        
        <TextInput
          value={linkUrl}
          onChangeText={handleInputChange(setLinkUrl)}
          placeholder="网址，例如 https://example.com"
          placeholderTextColor={isDark ? '#888' : '#94a3b8'}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.customInput, isDark && styles.customInputDark]}
        />
        
        <Pressable
          onPress={handleSaveQuickLink}
          disabled={isSavingLink}
          style={[
            styles.customSaveButton,
            isSavingLink && styles.customSaveButtonDisabled
          ]}
        >
          <ThemedText lightColor="#fff" darkColor="#000" style={styles.customSaveLabel}>
            {isSavingLink ? '保存中…' : '保存快捷方式'}
          </ThemedText>
        </Pressable>
        
        {feedback ? <ThemedText style={styles.customFeedback}>{feedback}</ThemedText> : null}
      </View>

      <View style={[styles.ritualCard, isDark && styles.ritualCardDark]}>
        <ThemedText type="subtitle">📰 今日新闻</ThemedText>
        {isLoadingRss ? (
          <View style={styles.ritualRow}>
            <ActivityIndicator size="small" color="#2563eb" />
            <ThemedText style={styles.ritualText}>正在加载新闻...</ThemedText>
          </View>
        ) : (
          rssNews.map((item, index) => (
            <Pressable
              key={`${item.title}-${index}`}
              style={styles.ritualRow}
              onPress={() => item.link && onNewsPress(item.link)}
              disabled={!item.link}
            >
              <Ionicons name="newspaper-outline" size={16} color="#2563eb" />
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
