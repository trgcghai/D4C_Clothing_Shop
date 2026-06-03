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

  it("should update detail cache and delete list cache after successful deduct", async () => {
    const cachedProduct = {
      id: "prod_1",
      name: "Test Product",
      variants: [{ id: "var_1", quantity: 10, color: "Red", size: "M" }]
    };
    mockRedisGet.mockResolvedValueOnce(null); // idempotency check
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedProduct)); // detail cache read
    mockRedisSet.mockResolvedValueOnce(1); // detail cache write
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:abc123"]]); // list scan
    mockRedisDel.mockResolvedValueOnce(1); // list delete

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-789"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisSet).toHaveBeenCalledWith(
      "product:detail:prod_1",
      JSON.stringify({ id: "prod_1", name: "Test Product", variants: [{ id: "var_1", quantity: 8, color: "Red", size: "M" }] }),
      { EX: 900 }
    );
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:abc123"]);
  });

  it("should update detail cache for multiple unique productIds after deduct", async () => {
    const cachedProd1 = { id: "prod_1", variants: [{ id: "var_1", quantity: 10 }] };
    const cachedProd2 = { id: "prod_2", variants: [{ id: "var_2", quantity: 5 }] };
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedProd1));
    mockRedisSet.mockResolvedValueOnce(1);
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedProd2));
    mockRedisSet.mockResolvedValueOnce(1);
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:xyz"]]);
    mockRedisDel.mockResolvedValueOnce(1);

    const result = await stockService.batchDeductStock(
      [
        { variantId: "var_1", quantity: 1, productId: "prod_1" },
        { variantId: "var_2", quantity: 2, productId: "prod_2" },
        { variantId: "var_3", quantity: 1, productId: "prod_1" }
      ],
      "checkout-dup"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisSet).toHaveBeenCalledTimes(3); // 1 idempotency + 2 detail caches
    expect(mockRedisSet).toHaveBeenCalledWith(
      "product:detail:prod_1",
      JSON.stringify({ id: "prod_1", variants: [{ id: "var_1", quantity: 9 }] }),
      { EX: 900 }
    );
    expect(mockRedisSet).toHaveBeenCalledWith(
      "product:detail:prod_2",
      JSON.stringify({ id: "prod_2", variants: [{ id: "var_2", quantity: 3 }] }),
      { EX: 900 }
    );
    expect(mockRedisSet).toHaveBeenCalledWith(
      "idempotency:checkout-dup",
      JSON.stringify({ success: true }),
      { EX: 3600 }
    );
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:xyz"]);
  });

  it("should skip cache update when productId is missing", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-no-pid"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisSet).not.toHaveBeenCalledWith(
      expect.stringMatching(/^product:detail:/),
      expect.any(String),
      expect.any(Object)
    );
    expect(mockRedisSendCommand).not.toHaveBeenCalled();
  });

  it("should update detail cache after successful restore", async () => {
    const cachedProduct = {
      id: "prod_1",
      name: "Test Product",
      variants: [{ id: "var_1", quantity: 5, color: "Blue", size: "L" }]
    };
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedProduct));
    mockRedisSet.mockResolvedValueOnce(1);
    mockRedisSendCommand.mockResolvedValueOnce(["0", ["product:list:def456"]]);
    mockRedisDel.mockResolvedValueOnce(1);

    const result = await stockService.batchRestoreStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "restore-123"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisSet).toHaveBeenCalledWith(
      "product:detail:prod_1",
      JSON.stringify({ id: "prod_1", name: "Test Product", variants: [{ id: "var_1", quantity: 7, color: "Blue", size: "L" }] }),
      { EX: 900 }
    );
    expect(mockRedisSendCommand).toHaveBeenCalledWith([
      "SCAN", "0", "MATCH", "product:list:*", "COUNT", "100"
    ]);
    expect(mockRedisDel).toHaveBeenCalledWith(["product:list:def456"]);
  });

  it("should not fail stock operation when cache update throws", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisGet.mockRejectedValueOnce(new Error("Redis connection lost"));

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-cache-err"
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
  });
});
