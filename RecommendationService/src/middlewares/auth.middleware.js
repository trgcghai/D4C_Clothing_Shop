/**
 * Validates that requests contain X-User-Id header injected by the API Gateway.
 * Rejects direct requests that bypass the Gateway.
 */
export const requireAuth = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing authentication",
    });
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  const userRole = req.headers["x-user-role"];

  if (userRole !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin role required",
    });
  }

  next();
};
