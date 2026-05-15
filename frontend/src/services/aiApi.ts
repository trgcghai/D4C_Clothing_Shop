import axiosInstance from "./_axios";

export interface AIChatPayload {
  message: string;
  userId: string;
  role: string;
}

export interface AIChatResponse {
  success: boolean;
  data: {
    reply: string;
    role: string;
  };
}

export const sendChatMessage = (payload: AIChatPayload) =>
  axiosInstance
    .post<AIChatResponse>("/api/v1/ai/chat", payload)
    .then((res) => res.data);
