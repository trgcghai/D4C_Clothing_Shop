/**
 * Validates that requests contain X-User-Id header injected by the API Gateway.
 * Rejects direct requests that bypass the Gateway.
 */
export const requireGatewayIdentity = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing authentication",
    });
  }

  next();
};
