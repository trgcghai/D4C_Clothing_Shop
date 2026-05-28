import { geminiService } from "../services/gemini.service.js";

const extractIdentity = (req) => {
  const userId = req.headers["x-user-id"];
  const rolesHeader = req.headers["x-user-roles"] || "";
  const roles = rolesHeader
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const role = roles.length > 0 ? roles[0].toUpperCase() : "USER";

  if (!userId) {
    return null;
  }

  return { userId, role };
};

const generateTags = async (req, res) => {
  try {
    const { productData } = req.body;
    const identity = extractIdentity(req);

    if (!identity) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!productData || !productData.name) {
      return res.status(400).json({ error: "Product data with a name is required" });
    }

    const tags = await geminiService.generateProductTags(productData);

    return res.status(200).json({
      success: true,
      data: {
        tags: tags,
      },
    });
  } catch (error) {
    console.error("Generate Tags Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export { generateTags };
