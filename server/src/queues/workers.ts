export function startWorkers(): RunningWorkers {
  const connection = createRedisConnection();
  
  // Define resilient default options for all jobs
  const opts: WorkerOptions = { 
    connection, 
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential', // Wait longer between each retry
        delay: 5000,         // Start with 5 second delay
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 }, // Keeps failed jobs in the "failed" list for debugging
    }
  };

  const indexing = new Worker("indexing", async (job) => withJobContext("indexing", String(job.id), job.name, () => processIndexing(job)), opts);
  const analytics = new Worker("analytics", async (job) => withJobContext("analytics", String(job.id), job.name, () => processAnalytics(job)), opts);
  const notifications = new Worker("notifications", async (job) => withJobContext("notifications", String(job.id), job.name, () => processNotifications(job)), opts);

  const workers = [indexing, analytics, notifications];

  for (const w of workers) {
    w.on("active", (job) =>
      withJobContext(w.name, String(job.id), job.name, () =>
        logger.info("Job active", { attempt: job.attemptsMade }),
      ),
    );
    w.on("completed", (job) =>
      withJobContext(w.name, String(job.id), job.name, () => logger.info("Job completed")),
    );
    w.on("failed", (job, err) =>
      withJobContext(w.name, String(job?.id ?? "unknown"), job?.name, () =>
        logger.error("Job failed", { 
          error: err.message, 
          attemptsMade: job?.attemptsMade,
          isFailed: job?.isFailed()
        }),
      ),
    );
    w.on("error", (err) => logger.error("Worker error", err));
  }
  // ... (keep the rest of your events and close logic as is)