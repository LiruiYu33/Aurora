import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import org.json.*;

/**
 * 网页总结服务 - 调用硅基流动 API
 * API Key 由前端传入，无需环境变量
 */
public class Server {
    
    private static final String API_URL = "https://api.siliconflow.cn/v1/chat/completions";
    
    /**
     * 总结网页内容
     * @param pageContent 网页文本内容
     * @param pageUrl 网页 URL（可选）
     * @param apiKey API Key
     * @param model 模型名称
     * @return 总结结果
     */
    public static String summarise(String pageContent, String pageUrl, String apiKey, String model) throws Exception {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new Exception("API Key 未提供");
        }
        
        if (model == null || model.isEmpty()) {
            model = "Qwen/Qwen2.5-7B-Instruct"; // 默认模型
        }
        
        // 构建请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", model);
        requestBody.put("stream", false);
        requestBody.put("max_tokens", 1024);
        requestBody.put("temperature", 0.7);
        
        JSONArray messages = new JSONArray();
        JSONObject userMessage = new JSONObject();
        userMessage.put("role", "user");
        
        String prompt = "请总结以下网页内容，提取关键信息，控制在200字以内：\n\n";
        if (pageUrl != null && !pageUrl.isEmpty()) {
            prompt += "网址：" + pageUrl + "\n\n";
        }
        prompt += "内容：\n" + pageContent;
        
        userMessage.put("content", prompt);
        messages.put(userMessage);
        requestBody.put("messages", messages);
        
        // 发送 HTTP 请求
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setDoOutput(true);
        
        // 写入请求体
        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }
        
        // 读取响应
        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            throw new Exception("API 请求失败，状态码: " + responseCode);
        }
        
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
        }
        
        // 解析响应
        JSONObject jsonResponse = new JSONObject(response.toString());
        String summary = jsonResponse
            .getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content");
        
        return summary.trim();
    }
    
    /**
     * 对话服务 - 硅基流动
     */
    public static String chatSiliconFlow(JSONArray messages, String apiKey, String model) throws Exception {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new Exception("API Key 未提供");
        }
        
        if (model == null || model.isEmpty()) {
            model = "Qwen/Qwen2.5-7B-Instruct";
        }
        
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", model);
        requestBody.put("stream", false);
        requestBody.put("max_tokens", 1024);
        requestBody.put("temperature", 0.7);
        requestBody.put("messages", messages);
        
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setDoOutput(true);
        
        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }
        
        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            throw new Exception("API 请求失败，状态码: " + responseCode);
        }
        
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
        }
        
        JSONObject jsonResponse = new JSONObject(response.toString());
        return jsonResponse
            .getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content");
    }

    /**
     * 对话服务 - RAGFlow
     */
    public static String chatRagFlow(JSONArray messages, String apiKey, String baseUrl) throws Exception {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new Exception("RAGFlow API Key 未提供");
        }
        if (baseUrl == null || baseUrl.isEmpty()) {
            throw new Exception("RAGFlow Base URL 未提供");
        }

        // 移除末尾斜杠
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        String targetUrl = null;
        String chatId = null;
        String agentId = null;

        // 1. 尝试获取 Chat ID
        try {
            URL chatsUrl = new URL(baseUrl + "/api/v1/chats?page=1&page_size=1");
            HttpURLConnection chatsConn = (HttpURLConnection) chatsUrl.openConnection();
            chatsConn.setRequestMethod("GET");
            chatsConn.setRequestProperty("Authorization", "Bearer " + apiKey);
            chatsConn.setConnectTimeout(5000);
            chatsConn.setReadTimeout(5000);
            
            if (chatsConn.getResponseCode() == 200) {
                StringBuilder chatsResponse = new StringBuilder();
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(chatsConn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        chatsResponse.append(line);
                    }
                }
                JSONObject chatsJson = new JSONObject(chatsResponse.toString());
                if (chatsJson.has("data") && !chatsJson.isNull("data")) {
                    JSONArray data = chatsJson.getJSONArray("data");
                    if (data.length() > 0) {
                        chatId = data.getJSONObject(0).getString("id");
                        System.out.println("Found RAGFlow Chat ID: " + chatId);
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("Failed to fetch RAGFlow chats: " + e.getMessage());
        }

        if (chatId != null) {
            targetUrl = baseUrl + "/api/v1/chats_openai/" + chatId + "/chat/completions";
        } else {
            // 2. 尝试获取 Agent ID
            try {
                URL agentsUrl = new URL(baseUrl + "/api/v1/agents?page=1&page_size=1");
                HttpURLConnection agentsConn = (HttpURLConnection) agentsUrl.openConnection();
                agentsConn.setRequestMethod("GET");
                agentsConn.setRequestProperty("Authorization", "Bearer " + apiKey);
                agentsConn.setConnectTimeout(5000);
                agentsConn.setReadTimeout(5000);
                
                if (agentsConn.getResponseCode() == 200) {
                    StringBuilder agentsResponse = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(agentsConn.getInputStream(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            agentsResponse.append(line);
                        }
                    }
                    JSONObject agentsJson = new JSONObject(agentsResponse.toString());
                    if (agentsJson.has("data") && !agentsJson.isNull("data")) {
                        JSONArray data = agentsJson.getJSONArray("data");
                        if (data.length() > 0) {
                            agentId = data.getJSONObject(0).getString("id");
                            System.out.println("Found RAGFlow Agent ID: " + agentId);
                        }
                    }
                }
            } catch (Exception e) {
                System.out.println("Failed to fetch RAGFlow agents: " + e.getMessage());
            }
            
            if (agentId != null) {
                targetUrl = baseUrl + "/api/v1/agents_openai/" + agentId + "/chat/completions";
            } else {
                // 3. 最后的尝试，使用默认路径 (可能会 404)
                targetUrl = baseUrl + "/api/v1/chat/completions";
                System.out.println("No Chat or Agent found, using default URL: " + targetUrl);
            }
        }

        System.out.println("Target RAGFlow URL: " + targetUrl);

        // 构造请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("stream", false);
        requestBody.put("messages", messages);
        requestBody.put("model", "ragflow"); 

        URL url = new URL(targetUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setDoOutput(true);
        
        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }
        
        int responseCode = conn.getResponseCode();
        
        // 如果 404，尝试原生接口路径 (示例，具体需根据 RAGFlow 版本调整)
        if (responseCode == 404) {
             throw new Exception("RAGFlow 接口路径未找到，请检查 Base URL 是否正确 (例如: http://localhost:9380)");
        }
        
        if (responseCode != 200) {
            // 读取错误信息
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    errorResponse.append(line);
                }
                throw new Exception("RAGFlow 请求失败: " + responseCode + " " + errorResponse.toString());
            }
        }
        
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
        }
        
        // 打印原始响应以便调试
        System.out.println("RAGFlow Response: " + response.toString());
        
        JSONObject jsonResponse = new JSONObject(response.toString());
        
        // 解析 OpenAI 兼容格式
        if (jsonResponse.has("choices") && !jsonResponse.isNull("choices")) {
            return jsonResponse
                .getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
        } else if (jsonResponse.has("data") && !jsonResponse.isNull("data")) {
             Object dataObj = jsonResponse.get("data");
             if (dataObj instanceof JSONObject) {
                 JSONObject dataJson = (JSONObject) dataObj;
                 // RAGFlow 原生格式通常包含 answer
                 if (dataJson.has("answer")) {
                     return dataJson.getString("answer");
                 } else if (dataJson.has("content")) {
                     return dataJson.getString("content");
                 } else {
                     return dataJson.toString();
                 }
             } else if (dataObj instanceof String) {
                 return (String) dataObj;
             } else {
                 return String.valueOf(dataObj);
             }
        } else if (jsonResponse.has("answer")) {
            // 某些直接返回 answer 的情况
            return jsonResponse.getString("answer");
        } else {
            return jsonResponse.toString();
        }
    }
    
    /**
     * 对话服务入口
     */
    public static String chat(JSONArray messages, String apiKey, String model) throws Exception {
        return chatSiliconFlow(messages, apiKey, model);
    }
    
    /**
     * HTTP 服务器入口（供 React Native 调用）
     * 启动命令: java Server 8080
     */
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        
        com.sun.net.httpserver.HttpServer server = 
            com.sun.net.httpserver.HttpServer.create(new InetSocketAddress(port), 0);
            
        // 聊天接口
        server.createContext("/chat", exchange -> {
            try {
                // 设置 CORS
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                
                if ("OPTIONS".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(200, -1);
                    return;
                }
                
                if (!"POST".equals(exchange.getRequestMethod())) {
                    String error = "{\"error\": \"仅支持 POST 请求\"}";
                    exchange.sendResponseHeaders(405, error.getBytes().length);
                    exchange.getResponseBody().write(error.getBytes());
                    exchange.close();
                    return;
                }
                
                // 读取请求体
                String requestBody = new String(
                    exchange.getRequestBody().readAllBytes(), 
                    StandardCharsets.UTF_8
                );
                
                JSONObject request = new JSONObject(requestBody);
                JSONArray messages = request.getJSONArray("messages");
                String apiKey = request.optString("apiKey", "");
                String model = request.optString("model", "Qwen/Qwen2.5-7B-Instruct");
                String provider = request.optString("provider", "siliconflow");
                String ragflowApiKey = request.optString("ragflowApiKey", "");
                String ragflowBaseUrl = request.optString("ragflowBaseUrl", "");
                
                // 调用对话服务
                String reply;
                if ("ragflow".equals(provider)) {
                    reply = chatRagFlow(messages, ragflowApiKey, ragflowBaseUrl);
                } else {
                    reply = chatSiliconFlow(messages, apiKey, model);
                }
                
                // 返回结果
                JSONObject result = new JSONObject();
                result.put("reply", reply);
                result.put("success", true);
                
                byte[] responseBytes = result.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(200, responseBytes.length);
                exchange.getResponseBody().write(responseBytes);
                exchange.close();
                
            } catch (Exception e) {
                e.printStackTrace();
                JSONObject error = new JSONObject();
                error.put("error", e.getMessage());
                error.put("success", false);
                
                byte[] errorBytes = error.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(500, errorBytes.length);
                exchange.getResponseBody().write(errorBytes);
                exchange.close();
            }
        });
        
        server.createContext("/summarise", exchange -> {
            try {
                // 设置 CORS
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                
                if ("OPTIONS".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(200, -1);
                    return;
                }
                
                if (!"POST".equals(exchange.getRequestMethod())) {
                    String error = "{\"error\": \"仅支持 POST 请求\"}";
                    exchange.sendResponseHeaders(405, error.getBytes().length);
                    exchange.getResponseBody().write(error.getBytes());
                    exchange.close();
                    return;
                }
                
                // 读取请求体
                String requestBody = new String(
                    exchange.getRequestBody().readAllBytes(), 
                    StandardCharsets.UTF_8
                );
                
                JSONObject request = new JSONObject(requestBody);
                String content = request.getString("content");
                String url = request.optString("url", "");
                String apiKey = request.getString("apiKey");
                String model = request.optString("model", "Qwen/Qwen2.5-7B-Instruct");
                
                // 调用总结服务
                String summary = summarise(content, url, apiKey, model);
                
                // 返回结果
                JSONObject result = new JSONObject();
                result.put("summary", summary);
                result.put("success", true);
                
                byte[] responseBytes = result.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(200, responseBytes.length);
                exchange.getResponseBody().write(responseBytes);
                exchange.close();
                
            } catch (Exception e) {
                e.printStackTrace();
                JSONObject error = new JSONObject();
                error.put("error", e.getMessage());
                error.put("success", false);
                
                byte[] errorBytes = error.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(500, errorBytes.length);
                exchange.getResponseBody().write(errorBytes);
                exchange.close();
            }
        });
        
        server.setExecutor(null);
        server.start();
        System.out.println("总结服务已启动，监听端口: " + port);
        System.out.println("测试命令: curl -X POST http://localhost:" + port + "/summarise -H 'Content-Type: application/json' -d '{\"content\":\"测试内容\"}'");
    }
}
