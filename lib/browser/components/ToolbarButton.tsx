import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

type ToolbarButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function ToolbarButton({ 
  icon, 
  accessibilityLabel, 
  disabled, 
  onPress, 
  onLongPress 
}: ToolbarButtonProps) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [opacityAnim] = useState(new Animated.Value(1));
  
  const handlePress = () => {
    if (disabled) return;
    
    Animated.sequence([
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
        onPress={handlePress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.toolbarButton,
          disabled && styles.toolbarButtonDisabled
        ]}
      >
        <Ionicons 
          name={icon} 
          size={20} 
          color={disabled ? '#94a3b8' : '#11181C'}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toolbarButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
  },
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
});
