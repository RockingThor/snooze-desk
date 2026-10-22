import { Worker } from '@temporalio/worker';
import * as activities from './activities';
import * as Sentry from '@sentry/nextjs';
import { makeNodeTransport } from '@sentry/node';

type Envelope = [Record<string, unknown>, Array<[{ type: string }, Record<string, unknown>]>];

// Optional delivery log (SENTRY_LOG_TRANSPORT=1): prints item types and the HTTP status
// returned by Sentry ingest for every envelope. Never prints the DSN.
function loggingTransport(options: Parameters<typeof makeNodeTransport>[0]) {
  const inner = makeNodeTransport(options);
  return {
    ...inner,
    send: async (envelope: unknown) => {
      const [header, items] = envelope as Envelope;
      const summary = items.map(([h, body]) => {
        const b = (body ?? {}) as Record<string, any>;
        if (Array.isArray(b.items)) {
          return {
            type: h.type,
            spans: b.items.map((sp: Record<string, any>) => ({
              name: sp.name,
              op: sp.attributes?.['sentry.op']?.value ?? sp.op,
              trace_id: sp.trace_id,
              span_id: sp.span_id,
              parent_span_id: sp.parent_span_id,
              is_segment: sp.is_segment,
              start: sp.start_timestamp,
              end: sp.end_timestamp ?? sp.timestamp,
              status: sp.status,
              input_tokens: sp.attributes?.['gen_ai.usage.input_tokens']?.value,
              output_tokens: sp.attributes?.['gen_ai.usage.output_tokens']?.value,
              attempt: sp.attributes?.['temporal.attempt']?.value,
            })),
          };
        }
        return {
          type: h.type,
          name: b.transaction,
          trace_id: b.contexts?.trace?.trace_id,
          start: b.start_timestamp,
          end: b.timestamp,
          spans: Array.isArray(b.spans) ? b.spans.length : undefined,
          exception: b.exception?.values?.[0]
            ? `${b.exception.values[0].type}: ${b.exception.values[0].value}`
            : undefined,
          level: b.level,
        };
      });
      const result = await inner.send(envelope as never);
      console.log('[sentry-transport] ' + JSON.stringify({
        status: (result as { statusCode?: number })?.statusCode,
        event_id: header.event_id,
        items: summary,
      }));
      return result;
    },
  };
}

async function run() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1.0,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      initialScope: { tags: { runtime: 'worker' } },
      ...(process.env.SENTRY_LOG_TRANSPORT === '1' ? { transport: loggingTransport as never } : {}),
    });
  }

  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows/notification-processor'),
    activities,
    taskQueue: 'snooze-desk',
  });

  const shutdown = async () => {
    worker.shutdown();
    await Sentry.flush(5000);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await worker.run();
  await Sentry.flush(5000);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
