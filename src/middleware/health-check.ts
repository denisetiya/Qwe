export interface HealthCheckOptions {
  path?: string;
  checks?: Record<string, () => Promise<boolean> | boolean>;
}

export function createHealthCheckEndpoint(options: HealthCheckOptions = {}) {
  const { path = '/health', checks = {} } = options;

  return {
    path,
    handler: async (ctx: any) => {
      const results: Record<string, { status: 'ok' | 'error'; latency?: number }> = {};
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      for (const [name, check] of Object.entries(checks)) {
        const start = Date.now();
        try {
          const result = await Promise.resolve(check());
          const latency = Date.now() - start;
          
          if (result) {
            results[name] = { status: 'ok', latency };
          } else {
            results[name] = { status: 'error', latency };
            overallStatus = 'degraded';
          }
        } catch (error) {
          results[name] = { status: 'error' };
          overallStatus = 'unhealthy';
        }
      }

      const response = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: results,
      };

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      ctx.response.status(statusCode).json(response);
    },
  };
}

export function healthCheck(checks: Record<string, () => Promise<boolean> | boolean> = {}) {
  return createHealthCheckEndpoint({ checks });
}
