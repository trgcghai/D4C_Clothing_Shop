import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTransactWrite = vi.fn();
vi.mock("../config/aws.config.js", () => ({
  dynamoClient: {
    send: vi.fn().mockImplementation(async (cmd) => {
      return mockTransactWrite(cmd);
    })
  }
}));

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts))
  }
}));

import { stockService } from "../services/stock.service.js";

describe("StockService Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result on duplicate key", async () => {
    const cachedResult = { success: true };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedResult));

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-123"
    );

    expect(result).toEqual(cachedResult);
    expect(mockTransactWrite).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("should deduct and cache on first request with key", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-456"
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(
      "idempotency:checkout-456",
      JSON.stringify({ success: true }),
      { EX: 3600 }
    );
  });

  it("should work without idempotency key (backward compatible)", async () => {
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      null
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});
