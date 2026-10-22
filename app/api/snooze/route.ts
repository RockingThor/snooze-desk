import { NextRequest, NextResponse } from 'next/server';
import { snoozeNotification } from '@/src/lib/temporal-client';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    { name: 'api.snooze_draft', op: 'http.server' },
    async () => {
      try {
        const body = await request.json();
        const { workflowId, draftId, hours } = body;

        if (!workflowId || !draftId || !hours) {
          return NextResponse.json(
            { error: 'Missing workflowId, draftId, or hours' },
            { status: 400 }
          );
        }

        await snoozeNotification(workflowId, draftId, hours);
        return NextResponse.json({ success: true });
      } catch (error) {
        Sentry.captureException(error);
        console.error('Failed to snooze draft:', error);
        return NextResponse.json(
          { error: 'Failed to snooze draft' },
          { status: 500 }
        );
      }
    },
  );
}
