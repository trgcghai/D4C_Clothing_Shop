import axios from "axios";

const testChat = async () => {
  const url = "http://localhost:8080/api/v1/ai/chat";
  
  const payload = {
    userId: "test_user_123",
    role: "CUSTOMER",
    message: "Chào bạn, mình cần mua áo khoác, bạn tìm giúp mình 1 mẫu rẻ nhất được không?"
  };

  try {
    console.log("Sending message to AI:", payload.message);
    const response = await axios.post(url, payload);
    console.log("\nAI Response:");
    console.log(response.data.data.reply);
  } catch (error) {
    console.error("Test failed:", error.response ? error.response.data : error.message);
  }
};

testChat();
