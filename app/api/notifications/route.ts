import { NextRequest, NextResponse } from 'next/server';
import { startWorkflow } from '@/src/lib/temporal-client';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    { name: 'api.start_workflow', op: 'http.server' },
    async () => {
      try {
        const body = await request.json();
        const { githubToken, ollamaModel, demoMode } = body;

        const result = await startWorkflow({
          githubToken,
          ollamaModel,
          demoMode: demoMode ?? true,
        });

        return NextResponse.json(result);
      } catch (error) {
        Sentry.captureException(error);
        console.error('Failed to start workflow:', error);
        return NextResponse.json(
          { error: 'Failed to start workflow' },
          { status: 500 }
        );
      }
    },
  );
}
