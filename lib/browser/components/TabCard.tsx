import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

import type { BrowserTab } from '../types';
import { SWIPE_MIN_DRAG, SWIPE_CLOSE_DISTANCE, SWIPE_RELEASE_VELOCITY } from '../constants';
import { styles, SCREEN_HEIGHT } from '../styles';

type TabCardProps = {
  tab: BrowserTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  isNewTab?: boolean;
};

export function TabCard({ tab, active, onSelect, onClose, isNewTab }: TabCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const translateY = useRef(new Animated.Value(isNewTab ? -SCREEN_HEIGHT : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(isNewTab ? 0 : 1)).current;
  const isClosing = useRef(false);
  const isSelecting = useRef(false);
  
  useEffect(() => {
    if (isNewTab) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 10,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isNewTab]);
  
  const handleSelectPress = () => {
    if (isSelecting.current) return;
    isSelecting.current = true;
    onSelect();
    isSelecting.current = false;
  };
  
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dy }) => dy < -SWIPE_MIN_DRAG,
        onMoveShouldSetPanResponderCapture: (_, { dy }) => {
          return dy < -SWIPE_MIN_DRAG;
        },
        onPanResponderGrant: () => {
          isClosing.current = false;
        },
        onPanResponderMove: (_, { dy }) => {
          const clampedDy = Math.min(0, dy);
          translateY.setValue(clampedDy);
          
          if (clampedDy < 0) {
            const progress = Math.min(1, Math.abs(clampedDy) / (SWIPE_CLOSE_DISTANCE * 2));
            opacity.setValue(1 - progress * 0.5);
            scale.setValue(1 - progress * 0.1);
          }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, { dy, vy }) => {
          const clampedDy = Math.min(0, dy);
          const shouldClose = (clampedDy < -SWIPE_CLOSE_DISTANCE) || (vy < SWIPE_RELEASE_VELOCITY && clampedDy < 0);
          
          if (shouldClose && !isClosing.current) {
            isClosing.current = true;
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
      
      <Pressable style={styles.tabCardContent} onPress={handleSelectPress}>
        {tab.snapshot ? (
          <Image 
            source={{ uri: tab.snapshot }} 
            style={{ flex: 1, width: '100%', height: '100%', resizeMode: 'cover' }} 
          />
        ) : tab.isStartPage ? (
          <View style={[styles.tabCardPreview, isDark && styles.tabCardPreviewDark]}>
            <View style={styles.tabCardIconCircle}>
              <Ionicons name="home" size={32} color="#3b82f6" />
            </View>
            <ThemedText style={styles.tabCardPreviewText}>启动页</ThemedText>
          </View>
        ) : (
          <View style={[styles.tabCardPreview, isDark && styles.tabCardPreviewDark]}>
            <View style={[styles.tabCardFavicon, isDark && styles.tabCardFaviconDark]}>
              <Ionicons name="globe" size={40} color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
            <ThemedText numberOfLines={2} style={styles.tabCardDomain}>
              {tab.title || tab.url.replace(/^https?:\/\//, '').split('/')[0]}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.tabCardFullUrl}>
              {tab.url.replace(/^https?:\/\//, '').split('/')[0]}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
