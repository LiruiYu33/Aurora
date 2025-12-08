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
public class SummarisePage {
    
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
     * HTTP 服务器入口（供 React Native 调用）
     * 启动命令: java SummarisePage 8080
     */
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        
        com.sun.net.httpserver.HttpServer server = 
            com.sun.net.httpserver.HttpServer.create(new InetSocketAddress(port), 0);
        
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
