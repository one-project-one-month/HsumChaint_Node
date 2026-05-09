import { redis } from '@/lib/redis';
/**
 * Clears all paginated user list caches using a non-blocking SCAN.
 * This should be called whenever a user is Created, Updated  or Deleted.
 */
export const clearUserListCache = async () => {
  try {
    //start scanning from the beginning
    let cursor = '0';
    //use a loop to find keys in batches, keeping Redis responsive
    do {
      //scan for keys matching our list pattern
      //nexCursor = where to continue & keys =  matched keys
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'users:list:*', 'COUNT', 100);
      //update cursor and move forward in dataset
      cursor = nextCursor;
      //If we found matching keys in this batch, delete them
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0'); //'0' means we've circled back to the start
  } catch (error) {
    console.error('Redis Scan/Clear Error:', error);
  }
};

/**
 * Builds a stable, deterministic cache key from the input object.
 * Sorting keys prevents duplicate entries when callers pass fields
 * in different insertion orders.
 */
export const buildListCacheKey = (data: Record<string, unknown>): string => {
  return `users:list:${JSON.stringify(data, Object.keys(data as object).sort())}`;
};
