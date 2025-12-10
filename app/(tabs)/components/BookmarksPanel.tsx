import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import type { BookmarkItem } from '../types';
import { styles } from '../styles';

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

export function BookmarksPanel({
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
      
      <View style={[styles.bookmarksPanel, isDark && styles.bookmarksPanelDark]}>
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
