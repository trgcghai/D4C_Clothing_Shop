import axiosInstance from "./_axios";

export interface AIChatPayload {
  message: string;
}

export interface AIChatResponse {
  success: boolean;
  data: {
    reply: string;
    role: string;
  };
}

export interface AIConversationResponse {
  success: boolean;
  data: {
    messages: {
      role: "user" | "model";
      content: string;
      timestamp: number;
    }[];
  };
}

export interface AIClearResponse {
  success: boolean;
}

export const sendChatMessage = (payload: AIChatPayload) =>
  axiosInstance
    .post<AIChatResponse>("/api/ai/chat", payload)
    .then((res) => res.data);

export const getConversation = () =>
  axiosInstance
    .get<AIConversationResponse>("/api/ai/chat")
    .then((res) => res.data);

export const clearConversation = () =>
  axiosInstance.delete<AIClearResponse>("/api/ai/chat").then((res) => res.data);

export interface AITagsPayload {
  productData: {
    name: string;
    description?: string;
    categoryName?: string;
    brand?: string;
    gender?: string;
  };
}

export interface AITagsResponse {
  success: boolean;
  data: {
    tags: string[];
  };
}

export const generateProductTags = (payload: AITagsPayload) =>
  axiosInstance
    .post<AITagsResponse>("/api/ai/tags/generate", payload)
    .then((res) => res.data);
