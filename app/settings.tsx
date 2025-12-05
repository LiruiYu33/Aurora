import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useBrowserSettings } from '@/contexts/browser-settings';

const normalizeUrl = (rawValue: string) => {
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

export default function SettingsScreen() {
  const router = useRouter();
  const { homeUrl, setHomeUrl } = useBrowserSettings();
  const [inputValue, setInputValue] = useState(homeUrl);

  const handleSave = () => {
    const next = normalizeUrl(inputValue);
    setHomeUrl(next);
    Alert.alert('已保存', `默认主页已更新为\n${next}`);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">设置</ThemedText>
        <ThemedText style={styles.subtitle}>为浏览器选择一个默认主页。</ThemedText>

        <View style={styles.fieldGroup}>
          <ThemedText style={styles.label}>默认主页地址</ThemedText>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            placeholder="https://example.com 或搜索词"
          />
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <ThemedText lightColor="#fff" darkColor="#000" style={styles.saveLabel}>
            保存并返回
          </ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dbe8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    marginTop: 'auto',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
