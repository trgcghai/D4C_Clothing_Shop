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
const mockRedisDel = vi.fn();
const mockRedisScan = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts)),
    del: vi.fn().mockImplementation(async (keyOrKeys) => mockRedisDel(keyOrKeys)),
    scan: vi.fn().mockImplementation(async (cursor, opts) => mockRedisScan(cursor, opts))
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

  it("should invalidate detail and list cache after successful deduct", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: ["product:list:abc123"] });

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-789"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisScan).toHaveBeenCalledWith(0, { MATCH: "product:list:*", COUNT: 100 });
  });

  it("should invalidate cache for multiple unique productIds after deduct", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: [] });

    const result = await stockService.batchDeductStock(
      [
        { variantId: "var_1", quantity: 1, productId: "prod_1" },
        { variantId: "var_2", quantity: 2, productId: "prod_2" },
        { variantId: "var_3", quantity: 1, productId: "prod_1" }
      ],
      "checkout-dup"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledTimes(2);
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_2");
  });

  it("should skip cache invalidation when productId is missing", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-no-pid"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).not.toHaveBeenCalled();
    expect(mockRedisScan).not.toHaveBeenCalled();
  });

  it("should invalidate cache after successful restore", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: ["product:list:def456"] });

    const result = await stockService.batchRestoreStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "restore-123"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisScan).toHaveBeenCalledWith(0, { MATCH: "product:list:*", COUNT: 100 });
  });

  it("should not fail stock operation when cache invalidation throws", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockRejectedValueOnce(new Error("Redis connection lost"));

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-cache-err"
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
  });
});
