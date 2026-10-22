import * as Sentry from '@sentry/nextjs';

export function sentryDsn(): string | undefined {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  return dsn && dsn.length > 0 ? dsn : undefined;
}

export function initSentry(runtime: 'server' | 'client' | 'worker'): void {
  const dsn = sentryDsn();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    enabled: true,
    environment: process.env.NODE_ENV,
    initialScope: {
      tags: { runtime },
    },
  });
}
