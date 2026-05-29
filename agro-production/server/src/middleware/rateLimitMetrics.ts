type RateLimitBucket = "default" | "write";

const counters: Record<RateLimitBucket, number> = {
  default: 0,
  write: 0,
};

export function incrementRateLimitHit(bucket: RateLimitBucket) {
  counters[bucket] += 1;
}

export function getRateLimitMetrics() {
  return {
    default_hits: counters.default,
    write_hits: counters.write,
    total_hits: counters.default + counters.write,
  };
}
