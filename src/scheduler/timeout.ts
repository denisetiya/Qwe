type TimeoutFn = () => Promise<void> | void;

interface TimeoutJob {
  id: string;
  ms: number;
  fn: TimeoutFn;
  timer: NodeJS.Timeout;
}

export class TimeoutScheduler {
  private jobs = new Map<string, TimeoutJob>();
  private idCounter = 0;

  schedule(ms: number, fn: TimeoutFn): string {
    const id = `timeout_${++this.idCounter}`;
    const timer = setTimeout(async () => {
      this.jobs.delete(id);
      try { await fn(); } catch {}
    }, ms);
    this.jobs.set(id, { id, ms, fn, timer });
    return id;
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    clearTimeout(job.timer);
    this.jobs.delete(id);
    return true;
  }

  getPendingJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  shutdown(): void {
    this.jobs.forEach(job => clearTimeout(job.timer));
    this.jobs.clear();
  }
}
