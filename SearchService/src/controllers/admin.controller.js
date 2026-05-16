import { processDLQ } from "../services/dlq-handler.service.js";

export const handleDlqRetry = async (req, res) => {
  // TODO: In production, the API Gateway's GatewayIdentityFilter handles internal auth.
  // For now, verify the request comes from internal services via a shared secret header.
  const internalToken = req.headers["x-internal-token"];
  if (!internalToken || internalToken !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(403).json({
      message: "Forbidden: internal services only",
    });
  }

  try {
    const result = await processDLQ();
    res.status(200).json({
      message: "DLQ retry completed",
      processed: result.processed,
    });
  } catch (error) {
    console.error("DLQ retry error:", error);
    res.status(500).json({
      message: "DLQ retry failed",
    });
  }
};
