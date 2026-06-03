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
const mockRedisSendCommand = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts)),
    del: vi.fn().mockImplementation(async (keyOrKeys) => mockRedisDel(keyOrKeys)),
    sendCommand: vi.fn().mockImplementation(async (args) => mockRedisSendCommand(args))
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
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:abc123"]]);

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-789"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:abc123"]);
  });

  it("should invalidate cache for multiple unique productIds after deduct", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:xyz"]]);

    const result = await stockService.batchDeductStock(
      [
        { variantId: "var_1", quantity: 1, productId: "prod_1" },
        { variantId: "var_2", quantity: 2, productId: "prod_2" },
        { variantId: "var_3", quantity: 1, productId: "prod_1" }
      ],
      "checkout-dup"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledTimes(3);
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_2");
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:xyz"]);
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
    expect(mockRedisSendCommand).not.toHaveBeenCalled();
  });

  it("should invalidate cache after successful restore", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:def456"]]);

    const result = await stockService.batchRestoreStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "restore-123"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:def456"]);
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
