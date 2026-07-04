type IntervalFn = () => Promise<void> | void;

interface IntervalJob {
  id: string;
  ms: number;
  fn: IntervalFn;
  timer: NodeJS.Timeout;
}

export class IntervalScheduler {
  private jobs = new Map<string, IntervalJob>();
  private idCounter = 0;

  schedule(ms: number, fn: IntervalFn): string {
    const id = `interval_${++this.idCounter}`;
    const timer = setInterval(async () => {
      try { await fn(); } catch {}
    }, ms);
    this.jobs.set(id, { id, ms, fn, timer });
    return id;
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    clearInterval(job.timer);
    this.jobs.delete(id);
    return true;
  }

  getJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  shutdown(): void {
    this.jobs.forEach(job => clearInterval(job.timer));
    this.jobs.clear();
  }
}
