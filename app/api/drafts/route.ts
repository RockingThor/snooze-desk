import { NextRequest, NextResponse } from 'next/server';
import { drafts } from '@/src/workflows/notification-processor';
import { DEMO_MODEL, DEMO_NOTIFICATION_CONTEXTS } from '@/test/__fixtures__/demo-notifications';
import * as Sentry from '@sentry/nextjs';

function clock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { name: 'api.get_drafts', op: 'http.server' },
    async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const workflowId = searchParams.get('workflowId');

        if (!workflowId) {
          const loadedAt = new Date();
          const mockDrafts = [
            {
              id: 'draft-1',
              notificationId: '1',
              repo: 'acme/main-app',
              title: 'Critical bug: App crashes on startup after v2.1.0 update',
              type: 'Issue',
              classification: 'needs-you',
              draftReply: 'Thanks for the detailed report with the stack trace. The ThemeProvider undefined error at line 45 confirms this is related to the v2.1.0 update. I\'ll investigate the theme context initialization and push a hotfix today. Tracking this as P0 given 50+ users are affected.',
              reasoning: 'Critical production bug with clear reproduction steps',
              context: DEMO_NOTIFICATION_CONTEXTS['1'],
              url: 'https://api.github.com/repos/acme/main-app/issues/427',
              createdAt: loadedAt.toISOString(),
              status: 'pending',
              model: DEMO_MODEL,
              cachedDemo: true,
            },
            {
              id: 'draft-2',
              notificationId: '2',
              repo: 'acme/main-app',
              title: 'Review requested: Add dark mode support with theme provider',
              type: 'PullRequest',
              classification: 'needs-you',
              draftReply: 'Thanks for the comprehensive PR on dark mode! I\'ll review the ThemeProvider implementation and the 23 updated components. The context API approach looks solid. Will check the system preference detection and provide feedback within 24 hours.',
              reasoning: 'Review explicitly requested, code changes ready',
              context: DEMO_NOTIFICATION_CONTEXTS['2'],
              url: 'https://api.github.com/repos/acme/main-app/pulls/312',
              createdAt: loadedAt.toISOString(),
              status: 'pending',
              model: DEMO_MODEL,
              cachedDemo: true,
            },
            {
              id: 'draft-4',
              notificationId: '4',
              repo: 'you/awesome-lib',
              title: 'How to implement custom authentication with OAuth2 and refresh tokens?',
              type: 'Issue',
              classification: 'needs-you',
              draftReply: 'Great questions about OAuth2 integration! For Next.js 14 App Router: 1) Refresh tokens are stored in httpOnly cookies (see auth/route.ts), 2) Custom claims go in the JWT payload (example in middleware.ts), 3) RBAC is in the permissions.ts helper, 4) Session timeout is configurable via MAX_AGE. I\'ll add a detailed guide to the docs today.',
              reasoning: 'Concrete technical questions requiring specific guidance',
              context: DEMO_NOTIFICATION_CONTEXTS['4'],
              url: 'https://api.github.com/repos/you/awesome-lib/issues/156',
              createdAt: loadedAt.toISOString(),
              status: 'pending',
              model: DEMO_MODEL,
              cachedDemo: true,
            },
          ];

          return NextResponse.json({
            demo: true,
            loadedAt: loadedAt.toISOString(),
            timeline: [
              { time: clock(loadedAt), event: 'Loaded 6 demo notifications' },
              { time: clock(loadedAt), event: 'Classified from cached demo drafts' },
              { time: clock(loadedAt), event: '3 replies ready' },
              { time: clock(loadedAt), event: 'Digest ready' },
            ],
            drafts: mockDrafts,
          });
        }

        const draftsList = Array.from(drafts.values());
        return NextResponse.json({
          demo: false,
          drafts: draftsList,
        });
      } catch (error) {
        Sentry.captureException(error);
        console.error('Failed to fetch drafts:', error);
        return NextResponse.json(
          { error: 'Failed to fetch drafts' },
          { status: 500 }
        );
      }
    },
  );
}
