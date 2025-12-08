/**
 * 网页总结服务 - 调用 Java 后端
 */

const BACKEND_URL = 'http://localhost:8080/summarise';

export interface SummariseRequest {
  content: string;
  url?: string;
  apiKey: string;
  model: string;
}

export interface SummariseResponse {
  summary: string;
  success: boolean;
  error?: string;
}

/**
 * 调用后端总结网页内容
 */
export async function summarisePage(
  content: string,
  apiKey: string,
  model: string,
  url?: string
): Promise<string> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        url,
        apiKey,
        model,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: SummariseResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || '总结失败');
    }

    return data.summary;
  } catch (error) {
    console.error('网页总结失败:', error);
    throw error;
  }
}

/**
 * 从 WebView 提取内容并总结
 */
export async function summariseWebView(
  webViewRef: any,
  pageUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 注入 JavaScript 提取页面文本
    const extractScript = `
      (function() {
        try {
          // 移除脚本、样式等标签
          const clone = document.body.cloneNode(true);
          const scripts = clone.querySelectorAll('script, style, noscript');
          scripts.forEach(el => el.remove());
          
          // 获取纯文本
          let text = clone.innerText || clone.textContent || '';
          
          // 清理多余空白
          text = text.replace(/\\s+/g, ' ').trim();
          
          // 限制长度（避免超过 API 限制）
          const maxLength = 8000;
          if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '...';
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAGE_CONTENT',
            content: text
          }));
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ERROR',
            error: e.message
          }));
        }
      })();
      true;
    `;

    // 设置消息监听器
    const handleMessage = async (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'PAGE_CONTENT') {
          // 移除监听器
          webViewRef.current?.removeEventListener?.('message', handleMessage);

          // 调用总结服务
          const summary = await summarisePage(data.content, apiKey, model, pageUrl);
          resolve(summary);
        } else if (data.type === 'ERROR') {
          reject(new Error(data.error));
        }
      } catch (error) {
        reject(error);
      }
    };

    // 注入脚本
    webViewRef.current?.injectJavaScript(extractScript);

    // 设置超时
    setTimeout(() => {
      reject(new Error('提取页面内容超时'));
    }, 10000);
  });
}
