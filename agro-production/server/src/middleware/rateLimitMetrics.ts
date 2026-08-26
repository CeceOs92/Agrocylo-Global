type RateLimitBucket = 'default' | 'write' | 'auth';

const counters: Record<RateLimitBucket, number> = {
  default: 0,
  write: 0,
  auth: 0,
};

export function incrementRateLimitHit(bucket: RateLimitBucket) {
  counters[bucket] += 1;
}

export function getRateLimitMetrics() {
  return {
    default_hits: counters.default,
    write_hits: counters.write,
    auth_hits: counters.auth,
    total_hits: counters.default + counters.write + counters.auth,
  };
}
