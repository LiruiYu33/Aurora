import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

import type { BrowserTab } from '../types';
import { TAB_CARD_SPACING } from '../constants';
import { styles, SCREEN_WIDTH, SCREEN_HEIGHT } from '../styles';
import { TabCard } from './TabCard';

type TabSwitcherProps = {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onCloseTab: (tabId: string, stayInSwitcher?: boolean) => void;
  onAddTab: (stayInSwitcher?: boolean) => void;
  onDismiss: () => void;
  shouldDismiss?: boolean;
};

export function TabSwitcher({ 
  tabs, 
  activeTabId, 
  onSelect, 
  onCloseTab, 
  onAddTab, 
  onDismiss, 
  shouldDismiss 
}: TabSwitcherProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const activeIndex = tabs.findIndex(t => t.id === activeTabId);
  const [currentIndex, setCurrentIndex] = useState(activeIndex >= 0 ? activeIndex : 0);
  
  const latestTabIdRef = useRef<string | null>(null);
  const prevTabsLengthRef = useRef(tabs.length);
  
  useEffect(() => {
    if (tabs.length > prevTabsLengthRef.current) {
      latestTabIdRef.current = tabs[tabs.length - 1].id;
      setTimeout(() => {
        latestTabIdRef.current = null;
      }, 500);
    }
    prevTabsLengthRef.current = tabs.length;
  }, [tabs.length]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  
  const animTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.spring(animTranslateY, {
        toValue: 0,
        friction: 12,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const handleDismissWithAnim = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(animTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback && typeof callback === 'function') {
        callback();
      }
      onDismiss();
    });
  };
  
  useEffect(() => {
    if (shouldDismiss) {
      handleDismissWithAnim();
    }
  }, [shouldDismiss]);
  
  const cardScrollWidth = SCREEN_WIDTH * TAB_CARD_SPACING;
  
  useEffect(() => {
    if (scrollViewRef.current && currentIndex >= 0) {
      scrollViewRef.current.scrollTo({
        x: currentIndex * cardScrollWidth,
        animated: false,
      });
    }
  }, []);
  
  const handleScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / cardScrollWidth);
    setCurrentIndex(newIndex);
  };
  
  return (
    <View style={styles.switcherOverlay}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: animOpacity }]}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      
      <Animated.View style={[
        StyleSheet.absoluteFill,
        {
          transform: [{ translateY: animTranslateY }],
        },
      ]}>
      
      <View style={styles.switcherHeader}>
        <Pressable onPress={() => handleDismissWithAnim()} style={styles.switcherDoneButton}>
          <ThemedText style={styles.switcherDoneText}>完成</ThemedText>
        </Pressable>
        
        <ThemedText style={styles.switcherTitle}>
          {currentIndex + 1} / {tabs.length}
        </ThemedText>
        
        <Pressable onPress={() => onAddTab(true)} style={styles.switcherAddBtn}>
          <Ionicons name="add" size={28} color={isDark ? '#fff' : '#007AFF'} />
        </Pressable>
      </View>
      
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
              onSelect={() => handleDismissWithAnim(() => onSelect(tab.id))}
              onClose={() => onCloseTab(tab.id, true)}
              isNewTab={tab.id === latestTabIdRef.current}
            />
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.switcherBottomBar}>
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
        
        <Pressable 
          style={styles.switcherNewTabButton}
          onPress={() => onAddTab(false)}
        >
          <Ionicons name="add-circle" size={28} color={isDark ? '#fff' : '#007AFF'} />
          <ThemedText style={[styles.switcherNewTabText, isDark && { color: '#fff' }]}>新建标签页</ThemedText>
        </Pressable>
      </View>
      </Animated.View>
    </View>
  );
}
