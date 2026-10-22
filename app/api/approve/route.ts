import { NextRequest, NextResponse } from 'next/server';
import { approveNotification } from '@/src/lib/temporal-client';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    { name: 'api.approve_draft', op: 'http.server' },
    async () => {
      try {
        const body = await request.json();
        const { workflowId, draftId } = body;

        if (!workflowId || !draftId) {
          return NextResponse.json(
            { error: 'Missing workflowId or draftId' },
            { status: 400 }
          );
        }

        await approveNotification(workflowId, draftId);
        return NextResponse.json({ success: true });
      } catch (error) {
        Sentry.captureException(error);
        console.error('Failed to approve draft:', error);
        return NextResponse.json(
          { error: 'Failed to approve draft' },
          { status: 500 }
        );
      }
    },
  );
}
