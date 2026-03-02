import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { redis } from './redis';

describe('Redis Integration Tests', () => {
  const testKey = 'test:integration:key';
  const testValue = 'hello-world';

  beforeAll(async () => {
    // Clean up before running tests in case a previous test failed
    await redis.del(testKey);
  });

  afterAll(async () => {
    // Clean up after tests finish
    await redis.del(testKey);
  });

  it('should establish connection and ping Redis', async () => {
    const result = await redis.ping();
    expect(result).toBe('PONG');
  });

  it('should set a value in Redis', async () => {
    const setResult = await redis.set(testKey, testValue);
    expect(setResult).toBe('OK');
  });

  it('should get a value from Redis', async () => {
    // Set a fresh value first to ensure independence
    await redis.set(testKey, testValue);

    // Attempt to retrieve
    const result = await redis.get(testKey);
    expect(result).toBe(testValue);
  });

  it('should return null when getting a non-existent key', async () => {
    const result = await redis.get('non_existent_random_key_123');
    expect(result).toBeNull();
  });

  it('should delete a value from Redis', async () => {
    // Set first
    await redis.set(testKey, testValue);

    // Delete
    const deleteResult = await redis.del(testKey);
    expect(deleteResult).toBe(1); // 1 key was deleted

    // Verify it's gone
    const getResult = await redis.get(testKey);
    expect(getResult).toBeNull();
  });
});
