/**
 * Snowflake ID Generator (64-bit integer)
 *
 * Structure:
 * - 1 bit: unused sign bit (always 0)
 * - 41 bits: timestamp (milliseconds since custom epoch)
 * - 10 bits: worker / machine ID (0-1023)
 * - 12 bits: sequence counter (0-4095)
 */

// Custom epoch: 2026-01-01T00:00:00.000Z
const CUSTOM_EPOCH = 1767225600000n;
const WORKER_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;

const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const WORKER_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;

export class SnowflakeIdGenerator {
  private readonly workerId: bigint;
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(workerId = 1n) {
    if (workerId < 0n || workerId > MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }
    this.workerId = workerId;
  }

  public nextId(): bigint {
    let currentTimestamp = BigInt(Date.now());

    if (currentTimestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate id.');
    }

    if (currentTimestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Wait until next millisecond
        while (currentTimestamp <= this.lastTimestamp) {
          currentTimestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = currentTimestamp;

    return (
      ((currentTimestamp - CUSTOM_EPOCH) << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_ID_SHIFT) |
      this.sequence
    );
  }
}

export const defaultSnowflake = new SnowflakeIdGenerator(1n);

export const generateSnowflakeId = (): bigint => defaultSnowflake.nextId();
