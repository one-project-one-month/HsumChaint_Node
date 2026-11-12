import { expect, test } from 'bun:test';
import { generateSnowflakeId, SnowflakeIdGenerator } from '../src/utils/snowflake';

test('generateSnowflakeId returns a positive 64-bit bigint', () => {
  const id = generateSnowflakeId();
  expect(typeof id).toBe('bigint');
  expect(id > 0n).toBe(true);
});

test('generates strictly unique IDs in rapid sequence', () => {
  const ids = new Set<bigint>();
  for (let i = 0; i < 1000; i++) {
    ids.add(generateSnowflakeId());
  }
  expect(ids.size).toBe(1000);
});

test('worker ID is embedded and validated', () => {
  const generator = new SnowflakeIdGenerator(42n);
  const id = generator.nextId();
  expect(typeof id).toBe('bigint');

  expect(() => new SnowflakeIdGenerator(-1n)).toThrow();
  expect(() => new SnowflakeIdGenerator(1024n)).toThrow();
});
