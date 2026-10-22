import { proxyActivities, sleep, defineSignal, setHandler, condition } from '@temporalio/workflow';
import type { WorkflowInput, ClassifiedNotification, MorningDigest, Draft } from '../types';
import type * as activities from '../activities';
import { DEMO_NOTIFICATIONS } from '../../test/__fixtures__/demo-notifications';

const { fetchGitHubNotifications, classifyWithGemma, generateDigestSummary, postGitHubComment } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
    retry: {
      initialInterval: '1s',
      maximumInterval: '30s',
      maximumAttempts: 3,
    },
  });

export const snoozeSignal = defineSignal<[string, number]>('snooze');
export const approveSignal = defineSignal<[string]>('approve');

const drafts = new Map<string, Draft>();
const snoozed = new Map<string, number>();
const approved = new Set<string>();

export async function notificationProcessorWorkflow(
  input: WorkflowInput,
): Promise<MorningDigest> {
  const {
    githubToken,
    ollamaModel = 'gemma4:e4b',
    digestModel = 'gemma3:1b',
    demoMode = false,
    liveFixtures = false,
    maxItems,
  } = input;

  setHandler(snoozeSignal, (draftId: string, hours: number) => {
    const draft = drafts.get(draftId);
    if (draft) {
      draft.status = 'snoozed';
      draft.snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();
      snoozed.set(draftId, hours);
      drafts.set(draftId, draft);
    }
  });

  setHandler(approveSignal, (draftId: string) => {
    const draft = drafts.get(draftId);
    if (draft) {
      draft.status = 'approved';
      approved.add(draftId);
      drafts.set(draftId, draft);
    }
  });

  let notifications;
  if (demoMode || liveFixtures) {
    notifications = DEMO_NOTIFICATIONS;
  } else {
    if (!githubToken) {
      throw new Error('GitHub token required when not in demo mode');
    }
    notifications = await fetchGitHubNotifications(githubToken);
  }

  if (maxItems && maxItems > 0) {
    notifications = notifications.slice(0, maxItems);
  }

  const classifications: ClassifiedNotification[] = [];
  
  for (const notification of notifications) {
    if (demoMode && !liveFixtures) {
      const mockClassified = await mockClassify(notification);
      classifications.push(mockClassified);
    } else {
      const classified = await classifyWithGemma(notification, ollamaModel);
      classifications.push(classified);
    }
  }

  for (const classified of classifications) {
    if (classified.classification === 'needs-you' || classified.draftReply) {
      const draft: Draft = {
        id: `draft-${classified.id}`,
        notificationId: classified.id,
        repo: classified.repository.full_name,
        title: classified.subject.title,
        type: classified.subject.type,
        classification: classified.classification,
        draftReply: classified.draftReply,
        reasoning: classified.reasoning,
        url: classified.subject.url,
        createdAt: new Date().toISOString(),
        status: 'pending',
        model: ollamaModel,
        cachedDemo: demoMode,
        ...(classified.latencyMs != null ? { latency: classified.latencyMs } : {}),
        ...(classified.promptTokens != null ? { promptTokens: classified.promptTokens } : {}),
        ...(classified.completionTokens != null ? { completionTokens: classified.completionTokens } : {}),
      };
      drafts.set(draft.id, draft);
    }
  }

  const summary = demoMode && !liveFixtures
    ? generateMockDigestSummary(classifications)
    : await generateDigestSummary(classifications, digestModel);

  const needsYou = classifications.filter(c => c.classification === 'needs-you');
  const canWait = classifications.filter(c => c.classification === 'can-wait');
  const ignored = classifications.filter(c => c.classification === 'ignore');

  const digest: MorningDigest = {
    date: new Date().toISOString(),
    summary,
    needsYou: {
      classification: 'needs-you',
      count: needsYou.length,
      items: needsYou.map(n => ({
        repo: n.repository.full_name,
        title: n.subject.title,
        reason: n.reason,
      })),
    },
    canWait: {
      classification: 'can-wait',
      count: canWait.length,
      items: canWait.map(n => ({
        repo: n.repository.full_name,
        title: n.subject.title,
        reason: n.reason,
      })),
    },
    ignored: {
      classification: 'ignore',
      count: ignored.length,
      items: ignored.map(n => ({
        repo: n.repository.full_name,
        title: n.subject.title,
        reason: n.reason,
      })),
    },
    processedCount: classifications.length,
  };

  await condition(() => {
    const allDrafts = Array.from(drafts.values());
    return allDrafts.every(d => d.status !== 'pending');
  }, '7 days');

  for (const [draftId, hours] of snoozed.entries()) {
    await sleep(hours * 3600 * 1000);
  }

  if (!demoMode && githubToken) {
    for (const draftId of approved) {
      const draft = drafts.get(draftId);
      if (draft?.url && draft.draftReply) {
        try {
          await postGitHubComment(githubToken, draft.url, draft.draftReply);
        } catch (error) {
          console.error(`Failed to post comment for ${draftId}:`, error);
        }
      }
    }
  }

  return digest;
}

function mockClassify(notification: typeof DEMO_NOTIFICATIONS[0]): ClassifiedNotification {
  const title = notification.subject.title.toLowerCase();
  const reason = notification.reason;
  const contexts = require('../../test/__fixtures__/demo-notifications').DEMO_NOTIFICATION_CONTEXTS;
  const context = contexts[notification.id] || '';

  if (title.includes('free') && title.includes('!!!')) {
    return {
      ...notification,
      classification: 'ignore',
      draftReply: '',
      reasoning: 'Spam or promotional content detected',
    };
  }

  if (title.includes('bump') && reason === 'author') {
    return {
      ...notification,
      classification: 'can-wait',
      draftReply: '',
      reasoning: 'Dependabot update, no immediate action needed',
    };
  }

  if (reason === 'review_requested') {
    return {
      ...notification,
      classification: 'needs-you',
      draftReply: `Thanks for the comprehensive PR on dark mode! I'll review the ThemeProvider implementation and the 23 updated components. The context API approach looks solid. Will check the system preference detection and provide feedback within 24 hours.`,
      reasoning: 'Review explicitly requested, code changes ready',
    };
  }

  if (title.includes('critical') || title.includes('bug') || title.includes('crash')) {
    return {
      ...notification,
      classification: 'needs-you',
      draftReply: `Thanks for the detailed report with the stack trace. The ThemeProvider undefined error at line 45 confirms this is related to the v2.1.0 update. I'll investigate the theme context initialization and push a hotfix today. Tracking this as P0 given 50+ users are affected.`,
      reasoning: 'Critical production bug with clear reproduction steps',
    };
  }

  if ((title.includes('how to') || title.includes('?')) && notification.subject.type === 'Issue') {
    return {
      ...notification,
      classification: 'needs-you',
      draftReply: `Great questions about OAuth2 integration! For Next.js 14 App Router: 1) Refresh tokens are stored in httpOnly cookies (see auth/route.ts), 2) Custom claims go in the JWT payload (example in middleware.ts), 3) RBAC is in the permissions.ts helper, 4) Session timeout is configurable via MAX_AGE. I'll add a detailed guide to the docs today.`,
      reasoning: 'Concrete technical questions requiring specific guidance',
    };
  }

  return {
    ...notification,
    classification: 'can-wait',
    draftReply: '',
    reasoning: 'Informational notification, can be reviewed later',
  };
}

function generateMockDigestSummary(classifications: ClassifiedNotification[]): string {
  const needsYouCount = classifications.filter(c => c.classification === 'needs-you').length;
  const canWaitCount = classifications.filter(c => c.classification === 'can-wait').length;
  
  return `Good morning! ${needsYouCount} notifications need your attention today.\n${canWaitCount} items can be reviewed later at your convenience.\nYour most urgent items are a bug report and a PR review.`;
}

export { drafts, snoozed, approved };
