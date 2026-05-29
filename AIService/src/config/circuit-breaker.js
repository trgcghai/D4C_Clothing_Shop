import CircuitBreaker from "opossum";

const breakers = {};

const FALLBACK_DATA = {
  ProductService: { status: "unavailable", data: null },
  CartService: { status: "unavailable", data: null },
  ORDERSERVICE: { status: "unavailable", data: null },
  NotificationService: { status: "unavailable", data: null },
  RecommendationService: { status: "unavailable", data: null },
};

export function createCircuitBreaker(appName, axiosInstance) {
  if (breakers[appName]) {
    return breakers[appName];
  }

  const breaker = new CircuitBreaker(
    async (config) => {
      return await axiosInstance(config);
    },
    {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: appName,
    }
  );

  breaker.fallback((config) => {
    console.warn(`[CB] ${appName} unavailable, returning fallback data`);
    return { data: FALLBACK_DATA[appName] || { status: "unavailable" } };
  });

  breaker.on("open", () => console.warn(`[CB] Circuit opened for ${appName}`));
  breaker.on("close", () => console.info(`[CB] Circuit closed for ${appName}`));
  breaker.on("reject", () => console.warn(`[CB] Call rejected for ${appName} (circuit open)`));
  breaker.on("fallback", () => console.warn(`[CB] Fallback invoked for ${appName}`));

  breakers[appName] = breaker;
  return breaker;
}

export function getAllCircuitBreakerStats() {
  const stats = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    stats[name] = breaker.stats;
  }
  return stats;
}
