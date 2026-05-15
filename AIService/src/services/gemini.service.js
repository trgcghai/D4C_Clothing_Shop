import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import redisClient from "../config/redis.config.js";
import { productToolDeclarations, productToolHandlers } from "../tools/productTools.js";
import { cartOrderToolDeclarations, cartOrderToolHandlers } from "../tools/cartOrderTools.js";
import { socialToolDeclarations, socialToolHandlers } from "../tools/socialTools.js";
import { adminStatsToolDeclarations, adminStatsToolHandlers } from "../tools/adminStatsTools.js";

dotenv.config();

const PROXY_API_KEY = process.env.PROXY_API_KEY;
const PROXY_BASE_URL = "https://gcli.ggchan.dev";

const genAI = new GoogleGenerativeAI(PROXY_API_KEY);

const USER_INSTRUCTION = `
Bạn là Trợ lý Mua sắm và Stylist AI thông minh của D4C Clothing Shop.

QUY TẮC BẮT BUỘC - KHÔNG ĐƯỢC VI PHẠM:
1. HÀNH ĐỘNG NGAY, KHÔNG HỎI LẠI:
   - Khi người dùng nói "tìm áo thun" → gọi search_products với keyword="áo thun" NGAY LẬP TỨC.
   - Khi search_products trả về kết quả (dù không hoàn toàn khớp) → HIỂN THỊ NGAY bằng [UI:PRODUCT_LIST:...] rồi DỪNG. TUYỆT ĐỐI KHÔNG hỏi "Bạn có muốn tìm lại không?" hay bất kỳ câu hỏi follow-up nào.
   - Chỉ hỏi lại khi: (a) search trả về 0 sản phẩm, HOẶC (b) yêu cầu quá mơ hồ không thể gọi tool.
2. LUÔN dùng search_products để tìm, KHÔNG BAO GIỜ trả lời "Tôi không biết sản phẩm nào".
3. SAU KHI hiển thị kết quả → chỉ thêm 1 câu gợi ý ngắn (tối đa 10 từ) nếu cần, rồi kết thúc.
4. NGÔN NGỮ: Tiếng Việt, ngắn gọn.

ĐỊNH DẠNG UI (bắt buộc dùng khi có dữ liệu):
- Danh sách sản phẩm: [UI:PRODUCT_LIST:{"products":[...]}]
- Chi tiết 1 sản phẩm: [UI:PRODUCT_DETAIL:{"product":{...}}]
- Giỏ hàng: [UI:CART_SUMMARY:{"total":..., "count":...}]
- Gợi ý: [UI:RECOMMENDATIONS:{"items":[...]}]
- Thông báo: [UI:NOTIFICATIONS:{"list":[...]}]
`;

const ADMIN_INSTRUCTION = `
Bạn là Trợ lý Vận hành (Admin Copilot) của D4C Clothing Shop.

QUY TẮC PHẢN HỒI (BẮT BUỘC):
1. HÀNH ĐỘNG NGAY: Truy xuất số liệu hoặc thực hiện quản lý ngay khi có yêu cầu.
2. TRỰC QUAN: Sử dụng định dạng UI: [UI:TYPE:JSON_DATA] để hiển thị dashboard/bảng biểu.
3. CHÍNH XÁC: Luôn dựa vào dữ liệu từ Tool. KHÔNG hỏi lại sau khi đã có dữ liệu.

ĐỊNH DẠNG UI:
- Thống kê doanh thu: [UI:ADMIN_STATS:{"revenue":..., "orders":..., "period":...}]
- Báo cáo kho: [UI:INVENTORY_REPORT:{"items":..., "threshold":...}]
- Kết quả hành động (Tạo/Xóa): [UI:ACTION_RESULT:{"success":true, "message":"..."}]
`;

class GeminiService {
  async processChat(userId, role, incomingMessage) {
    try {
      const chatId = `${role.toLowerCase()}:${userId}`;
      const redisKey = `ai_session:${chatId}`;

      // 1. Fetch context from Redis
      let contextStr = await redisClient.get(redisKey);
      let history = contextStr ? JSON.parse(contextStr) : [];

      // Cap in-memory history to last 5 for Gemini context
      if (history.length > 5) history = history.slice(-5);

      // Format history for Gemini API — must start with 'user' and alternate roles
      let formattedHistory = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || '' }]
      }));

      // Strip leading 'model' messages — Gemini requires first entry is 'user'
      while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
        formattedHistory.shift();
      }

      // Ensure alternating roles: remove consecutive same-role entries (keep last)
      const geminiHistory = formattedHistory.reduce((acc, cur) => {
        if (acc.length > 0 && acc[acc.length - 1].role === cur.role) {
          acc[acc.length - 1] = cur;
        } else {
          acc.push(cur);
        }
        return acc;
      }, []);

      // 2. Initialize Model with Role-Specific System Instruction
      const systemInstruction = role === 'ADMIN' ? ADMIN_INSTRUCTION : USER_INSTRUCTION;
      console.log(`Processing chat for role: ${role} with userId: ${userId}`);

      let tools = [];
      let handlers = {};

      if (role === 'USER') {
        tools = [{ functionDeclarations: [...productToolDeclarations, ...cartOrderToolDeclarations, ...socialToolDeclarations] }];
        handlers = { ...productToolHandlers, ...cartOrderToolHandlers, ...socialToolHandlers };
      } else if (role === 'ADMIN') {
        tools = [{ functionDeclarations: [...adminStatsToolDeclarations, ...productToolDeclarations] }];
        handlers = { ...adminStatsToolHandlers, ...productToolHandlers };
      }

      const roleModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      }, { baseUrl: PROXY_BASE_URL });

      const chatSession = roleModel.startChat({
        history: geminiHistory,
      });

      let result = await chatSession.sendMessage(incomingMessage);

      let functionCalls = typeof result.response.functionCalls === 'function'
        ? result.response.functionCalls()
        : result.response.functionCalls;

      // Handle Function Calling Loop
      while (functionCalls && functionCalls.length > 0) {
        const functionResponses = [];

        for (const call of functionCalls) {
          console.log(`Executing tool: ${call.name}`);
          let apiResponse;
          if (handlers[call.name]) {
            apiResponse = await handlers[call.name](call.args, userId);
          } else {
            apiResponse = { error: `Tool ${call.name} not implemented.` };
          }

          let safeResponse;
          if (Array.isArray(apiResponse)) {
            safeResponse = { result: apiResponse.slice(0, 5) };
          } else if (apiResponse === null || typeof apiResponse !== 'object') {
            safeResponse = { result: apiResponse };
          } else {
            safeResponse = apiResponse;
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: safeResponse
            }
          });
        }

        result = await chatSession.sendMessage(functionResponses);

        functionCalls = typeof result.response.functionCalls === 'function'
          ? result.response.functionCalls()
          : result.response.functionCalls;
      }

      const responseText = result.response.text();
      console.log(`AI Response for ${userId}: ${responseText}`);

      // 3. Update History
      const userMsg = { role: 'user', content: incomingMessage, timestamp: Date.now() };
      const modelMsg = { role: 'model', content: responseText, timestamp: Date.now() };

      history.push(userMsg, modelMsg);

      // Keep only last 15 messages in cache
      if (history.length > 15) {
        history = history.slice(-15);
      }

      // 4. Save to Redis only (7 days TTL)
      await redisClient.set(redisKey, JSON.stringify(history), "EX", 604800);

      return responseText;
    } catch (error) {
      console.error("Gemini Service Error:", error);
      throw new Error("Failed to process chat message");
    }
  }
}

export const geminiService = new GeminiService();
