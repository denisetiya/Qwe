type CronFn = () => Promise<void> | void;

interface CronJob {
  id: string;
  pattern: string;
  fn: CronFn;
  timer: NodeJS.Timeout | null;
}

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private idCounter = 0;

  schedule(pattern: string, fn: CronFn): string {
    const id = `cron_${++this.idCounter}`;
    const job: CronJob = { id, pattern, fn, timer: null };
    this.jobs.set(id, job);
    this.runNext(job);
    return id;
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.timer) clearTimeout(job.timer);
    this.jobs.delete(id);
    return true;
  }

  private runNext(job: CronJob): void {
    const delay = this.nextDelay(job.pattern);
    if (delay === null) return;

    job.timer = setTimeout(async () => {
      job.timer = null;
      if (!this.jobs.has(job.id)) return;
      try { await job.fn(); } catch {}
      this.runNext(job);
    }, delay);
  }

  private nextDelay(pattern: string): number | null {
    const next = this.parseExpression(pattern);
    if (!next) return null;
    const delay = next.getTime() - Date.now();
    return delay > 0 ? delay : 0;
  }

  private parseExpression(pattern: string): Date | null {
    const parts = pattern.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const now = new Date();
    const next = new Date(now.getTime());

    const [min, hour, dom, mon, dow] = parts;

    if (min && min !== '*') next.setMinutes(parseInt(min, 10));
    if (hour && hour !== '*') next.setHours(parseInt(hour, 10));
    if (dom && dom !== '*') next.setDate(parseInt(dom, 10));
    if (mon && mon !== '*') next.setMonth(parseInt(mon, 10) - 1);

    if (dow && dow !== '*') {
      const target = parseInt(dow, 10);
      const diff = (target - next.getDay() + 7) % 7;
      if (diff > 0) next.setDate(next.getDate() + diff);
    }

    next.setSeconds(0, 0);
    if (next.getTime() <= now.getTime()) next.setMinutes(next.getMinutes() + 1);

    return next;
  }

  getJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  shutdown(): void {
    this.jobs.forEach(job => { if (job.timer) clearTimeout(job.timer); });
    this.jobs.clear();
  }
}
