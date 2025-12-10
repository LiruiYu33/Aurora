import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { styles } from '../styles';

const AVAILABLE_MODELS = [
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B (推荐)' },
  { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen2.5-14B' },
  { id: 'Qwen/Qwen2.5-32B-Instruct', name: 'Qwen2.5-32B' },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B' },
  { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek-V2.5' },
  { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B' },
];

type SettingsPanelProps = {
  apiKey: string;
  selectedModel: string;
  ragflowApiKey: string;
  ragflowBaseUrl: string;
  selectedProvider: 'siliconflow' | 'ragflow';
  onSave: (key: string) => void;
  onSaveRagflow: (key: string, url: string) => void;
  onModelChange: (model: string) => void;
  onProviderChange: (provider: 'siliconflow' | 'ragflow') => void;
  onDismiss: () => void;
  isDark: boolean;
};

export function SettingsPanel({
  apiKey,
  selectedModel,
  ragflowApiKey,
  ragflowBaseUrl,
  selectedProvider,
  onSave,
  onSaveRagflow,
  onModelChange,
  onProviderChange,
  onDismiss,
  isDark,
}: SettingsPanelProps) {
  const [currentView, setCurrentView] = useState<'main' | 'siliconflow' | 'ragflow'>('main');
  const [inputValue, setInputValue] = useState(apiKey);
  const [ragKeyInput, setRagKeyInput] = useState(ragflowApiKey);
  const [ragUrlInput, setRagUrlInput] = useState(ragflowBaseUrl);
  
  const handleSaveSiliconFlow = () => {
    if (!inputValue.trim()) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }
    onSave(inputValue.trim());
  };

  const handleSaveRagflow = () => {
    if (!ragKeyInput.trim() || !ragUrlInput.trim()) {
      Alert.alert('提示', '请输入 API Key 和 Base URL');
      return;
    }
    onSaveRagflow(ragKeyInput.trim(), ragUrlInput.trim());
  };

  const renderMainView = () => (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={styles.settingsContent} 
      showsVerticalScrollIndicator={false}
    >
      <ThemedText style={styles.settingSectionTitle}>AI 服务提供商</ThemedText>
      
      <Pressable
        style={[
          styles.providerCard, 
          isDark && styles.providerCardDark,
          selectedProvider === 'siliconflow' && { borderColor: '#4f46e5', borderWidth: 1 }
        ]}
        onPress={() => {
          onProviderChange('siliconflow');
          setCurrentView('siliconflow');
        }}
      >
        <View style={styles.providerIconContainer}>
          <Ionicons name="hardware-chip-outline" size={24} color="#4f46e5" />
        </View>
        <View style={styles.providerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ThemedText style={styles.providerName}>硅基流动 (SiliconFlow)</ThemedText>
            {selectedProvider === 'siliconflow' && (
              <View style={{ backgroundColor: '#4f46e5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>当前使用</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.providerDesc}>提供 Qwen, Yi, DeepSeek 等高性能模型</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
      </Pressable>

      <Pressable
        style={[
          styles.providerCard, 
          isDark && styles.providerCardDark,
          selectedProvider === 'ragflow' && { borderColor: '#4f46e5', borderWidth: 1 }
        ]}
        onPress={() => {
          onProviderChange('ragflow');
          setCurrentView('ragflow');
        }}
      >
        <View style={[styles.providerIconContainer, { backgroundColor: '#ecfdf5' }]}>
          <Ionicons name="file-tray-full-outline" size={24} color="#10b981" />
        </View>
        <View style={styles.providerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ThemedText style={styles.providerName}>RAGFlow</ThemedText>
            {selectedProvider === 'ragflow' && (
              <View style={{ backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>当前使用</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.providerDesc}>基于 RAG 的知识库问答引擎</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
      </Pressable>
    </ScrollView>
  );

  const renderRagflowView = () => (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={[styles.settingsContent, { paddingBottom: 100 }]} 
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={styles.settingItem}>
        <ThemedText style={styles.settingLabel}>RAGFlow Base URL</ThemedText>
        <TextInput
          style={[
            styles.settingInput,
            isDark && styles.settingInputDark,
          ]}
          value={ragUrlInput}
          onChangeText={setRagUrlInput}
          placeholder="例如: https://demo.ragflow.io"
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ThemedText style={styles.settingHint}>
          RAGFlow 服务的访问地址
        </ThemedText>
      </View>

      <View style={styles.settingItem}>
        <ThemedText style={styles.settingLabel}>RAGFlow API Key</ThemedText>
        <TextInput
          style={[
            styles.settingInput,
            isDark && styles.settingInputDark,
          ]}
          value={ragKeyInput}
          onChangeText={setRagKeyInput}
          placeholder="请输入 API Key"
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
        />
        <ThemedText style={styles.settingHint}>
          在 RAGFlow 控制台获取 API Key
        </ThemedText>
      </View>
    </ScrollView>
  );

  const renderSiliconFlowView = () => (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={[styles.settingsContent, { paddingBottom: 100 }]} 
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={styles.settingItem}>
        <ThemedText style={styles.settingLabel}>硅基流动 API Key</ThemedText>
        <TextInput
          style={[
            styles.settingInput,
            isDark && styles.settingInputDark,
          ]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="请输入 API Key (sk-...)"
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
        />
        <ThemedText style={styles.settingHint}>
          在硅基流动官网获取 API Key 后填入此处
        </ThemedText>
      </View>
      
      <View style={styles.settingItem}>
        <ThemedText style={styles.settingLabel}>AI 模型</ThemedText>
        {AVAILABLE_MODELS.map((model) => (
          <Pressable
            key={model.id}
            style={[
              styles.modelOption,
              isDark && styles.modelOptionDark,
              selectedModel === model.id && styles.modelOptionSelected,
            ]}
            onPress={() => onModelChange(model.id)}
          >
            <View style={styles.modelOptionContent}>
              <ThemedText style={styles.modelOptionText}>{model.name}</ThemedText>
              {selectedModel === model.id && (
                <Ionicons name="checkmark-circle" size={20} color="#4f46e5" />
              )}
            </View>
          </Pressable>
        ))}
        <ThemedText style={styles.settingHint}>
          不同模型的性能和响应速度不同
        </ThemedText>
        
        <View style={{ marginTop: 12 }}>
          <ThemedText style={styles.settingLabel}>手动输入模型 ID</ThemedText>
          <TextInput
            style={[
              styles.settingInput,
              isDark && styles.settingInputDark,
            ]}
            value={selectedModel}
            onChangeText={onModelChange}
            placeholder="例如: 01-ai/Yi-1.5-9B-Chat"
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ThemedText style={styles.settingHint}>
            可在此处输入未列出的模型 ID
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
  
  return (
    <View style={styles.bookmarksOverlay}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.bookmarksPanel, isDark && styles.bookmarksPanelDark]}>
          <View style={styles.bookmarksHeader}>
            {currentView === 'main' ? (
              <Pressable onPress={onDismiss} style={styles.bookmarksDoneButton}>
                <ThemedText style={styles.bookmarksDoneText}>完成</ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={() => setCurrentView('main')} style={styles.bookmarksDoneButton}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="chevron-back" size={24} color="#007AFF" />
                  <ThemedText style={styles.bookmarksDoneText}>返回</ThemedText>
                </View>
              </Pressable>
            )}
            
            <ThemedText style={styles.bookmarksTitle}>
              {currentView === 'main' ? '设置' : (currentView === 'siliconflow' ? '硅基流动' : 'RAGFlow')}
            </ThemedText>
            
            {currentView === 'siliconflow' ? (
              <Pressable onPress={handleSaveSiliconFlow} style={styles.bookmarksDoneButton}>
                <ThemedText style={[styles.bookmarksDoneText, { color: '#007AFF' }]}>保存</ThemedText>
              </Pressable>
            ) : currentView === 'ragflow' ? (
              <Pressable onPress={handleSaveRagflow} style={styles.bookmarksDoneButton}>
                <ThemedText style={[styles.bookmarksDoneText, { color: '#007AFF' }]}>保存</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.bookmarksDoneButton} />
            )}
          </View>
          
          {currentView === 'main' ? renderMainView() : (currentView === 'siliconflow' ? renderSiliconFlowView() : renderRagflowView())}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
