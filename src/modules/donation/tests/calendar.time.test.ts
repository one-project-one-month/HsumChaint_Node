import { expect, test } from 'bun:test';
import { dateStart, donationDate, localDate, localTime } from '../calendar.time';

test('Myanmar calendar day changes at 17:30 UTC', () => {
  expect(localDate(new Date('2026-10-21T17:29:59Z'))).toBe('2026-10-21');
  expect(localDate(new Date('2026-10-21T17:30:00Z'))).toBe('2026-10-22');
  expect(dateStart('2026-10-22').toISOString()).toBe('2026-10-21T17:30:00.000Z');
  expect(localTime(new Date('1970-01-01T03:30:00Z'))).toBe('10:00');
});

test('pickup takes precedence, followed by dropoff and creation date', () => {
  const createdAt = new Date('2026-10-01Z');
  const dropoffTime = new Date('2026-10-22Z');
  const pickupTime = new Date('2026-10-23Z');
  expect(donationDate({ createdAt, dropoffTime, pickupTime })).toBe(pickupTime);
  expect(donationDate({ createdAt, dropoffTime, pickupTime: null })).toBe(dropoffTime);
  expect(donationDate({ createdAt, dropoffTime: null, pickupTime: null })).toBe(createdAt);
});
