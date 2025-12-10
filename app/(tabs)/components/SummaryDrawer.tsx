import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  Pressable, 
  ScrollView, 
  TextInput, 
  View 
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { API_BASE_URL } from '@/services/SummariseService';

import { styles } from '../styles';

type SummaryDrawerProps = {
  visible: boolean;
  content: string;
  pageContent: string;
  apiKey: string;
  model: string;
  ragflowApiKey?: string;
  ragflowBaseUrl?: string;
  selectedProvider?: 'siliconflow' | 'ragflow';
  error: string | null;
  isLoading: boolean;
  onDismiss: () => void;
  onShare: () => void;
  isDark: boolean;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function SummaryDrawer({
  visible,
  content,
  pageContent,
  apiKey,
  model,
  ragflowApiKey,
  ragflowBaseUrl,
  selectedProvider = 'siliconflow',
  error,
  isLoading,
  onDismiss,
  onShare,
  isDark,
}: SummaryDrawerProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (content) {
      setChatMessages([]);
    }
  }, [content]);

  const handleSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: userMsg }
    ];
    setChatMessages(newMessages);
    setIsChatLoading(true);
    
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const fullHistory: ChatMessage[] = [];
      
      fullHistory.push({
        role: 'system',
        content: `你是一个有用的助手。以下是用户正在阅读的网页内容：\n\n${pageContent}\n\n以下是你生成的总结：\n${content}\n\n请基于以上内容回答用户的问题。`
      });
      
      fullHistory.push(...newMessages);

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: fullHistory,
          apiKey,
          model,
          provider: selectedProvider,
          ragflowApiKey,
          ragflowBaseUrl
        })
      });

      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        Alert.alert('错误', data.error || '获取回复失败');
      }
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!visible) return null;
  
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.summaryOverlay}
    >
      <Pressable style={styles.summaryBackdrop} onPress={onDismiss} />
      
      <View style={[styles.summaryDrawer, isDark && styles.summaryDrawerDark, { height: '80%' }]}>
        <View style={styles.summaryHeader}>
          <ThemedText style={styles.summaryTitle}>网页总结 & 对话</ThemedText>
          <View style={styles.summaryHeaderButtons}>
            {content && !error && (
              <Pressable onPress={onShare} style={styles.summaryShareButton}>
                <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            )}
            <Pressable onPress={onDismiss} style={styles.summaryCloseButton}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
            </Pressable>
          </View>
        </View>
        
        <ScrollView 
          ref={scrollViewRef}
          style={styles.summaryContentScroll} 
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={true}
        >
          {isLoading ? (
            <View style={styles.summaryLoading}>
              <ActivityIndicator size="large" color="#4f46e5" />
              <ThemedText style={styles.summaryLoadingText}>正在总结...</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.summaryError}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
              <ThemedText style={styles.summaryErrorText}>{error}</ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.summaryText}>{content}</ThemedText>
              
              <View style={{ height: 1, backgroundColor: isDark ? '#333' : '#eee', marginVertical: 20 }} />
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 10 }}>
                基于内容的对话
              </ThemedText>

              {chatMessages.map((msg, index) => (
                <View key={index} style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#4f46e5' : (isDark ? '#2c2c2e' : '#f1f5f9'),
                  padding: 10,
                  borderRadius: 12,
                  marginBottom: 8,
                  maxWidth: '85%'
                }}>
                  <ThemedText style={{ color: msg.role === 'user' ? '#fff' : (isDark ? '#fff' : '#000') }}>
                    {msg.content}
                  </ThemedText>
                </View>
              ))}
              
              {isChatLoading && (
                <View style={{ alignSelf: 'flex-start', padding: 10 }}>
                  <ActivityIndicator size="small" color="#4f46e5" />
                </View>
              )}
            </>
          )}
        </ScrollView>

        {!isLoading && !error && (
          <View style={{ 
            flexDirection: 'row', 
            padding: 10, 
            borderTopWidth: 0.5, 
            borderTopColor: isDark ? '#333' : '#eee',
            backgroundColor: isDark ? '#1c1c1e' : '#fff',
            paddingBottom: Platform.OS === 'ios' ? 30 : 10
          }}>
            <TextInput
              style={{ 
                flex: 1, 
                backgroundColor: isDark ? '#2c2c2e' : '#f1f5f9',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
                color: isDark ? '#fff' : '#000',
                marginRight: 10,
                maxHeight: 100
              }}
              placeholder="针对内容提问..."
              placeholderTextColor="#94a3b8"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
            />
            <Pressable 
              onPress={handleSend}
              style={{ 
                justifyContent: 'center', 
                alignItems: 'center', 
                width: 40, 
                height: 40, 
                backgroundColor: '#4f46e5', 
                borderRadius: 20 
              }}
            >
              <Ionicons name="arrow-up" size={24} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
