import { Ollama } from 'ollama';
import { z } from 'zod';
import type { GitHubNotification, ClassifiedNotification, NotificationClassification } from '../types';
import * as Sentry from '@sentry/nextjs';
import { Context } from '@temporalio/activity';

export function activityTags(): Record<string, string | number> {
  try {
    const info = Context.current().info;
    return {
      'temporal.workflow_id': info.workflowExecution?.workflowId ?? 'unknown',
      'temporal.activity_type': info.activityType,
      'temporal.attempt': info.attempt,
    };
  } catch {
    return {};
  }
}

function usageAttributes(model: string, response: {
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}) {
  const ms = (ns?: number) => (typeof ns === 'number' ? Math.round(ns / 1e6) : undefined);
  return {
    'gen_ai.system': 'ollama',
    'gen_ai.request.model': model,
    'gen_ai.usage.input_tokens': response.prompt_eval_count ?? 0,
    'gen_ai.usage.output_tokens': response.eval_count ?? 0,
    'gen_ai.usage.total_tokens': (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    'ollama.total_duration_ms': ms(response.total_duration) ?? 0,
    'ollama.load_duration_ms': ms(response.load_duration) ?? 0,
    'ollama.prompt_eval_duration_ms': ms(response.prompt_eval_duration) ?? 0,
    'ollama.eval_duration_ms': ms(response.eval_duration) ?? 0,
  };
}

export function isConnectionError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error) + String((error as { cause?: unknown })?.cause ?? '');
  return /fetch failed|ECONNREFUSED|ECONNRESET|socket|terminated|other side closed/i.test(msg);
}

// v2: reasoning comes first so small models decide after thinking; the enum is enforced
// by Ollama structured outputs (JSON schema in `format`), not just requested in text.
export const CLASSIFY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    classification: { type: 'string', enum: ['needs-you', 'can-wait', 'ignore'] },
    draftReply: { type: 'string' },
  },
  required: ['reasoning', 'classification', 'draftReply'],
} as const;

export function buildClassifyPromptV1(notification: GitHubNotification): string {
  return `You are a smart GitHub notification classifier for a developer. Classify this notification and draft a helpful reply if needed.

Notification:
- Repository: ${notification.repository.full_name}
- Type: ${notification.subject.type}
- Title: ${notification.subject.title}
- Reason: ${notification.reason}

Classify as:
- "needs-you": Requires immediate action (review requests, direct mentions, questions on your issues)
- "can-wait": Informational, can be reviewed later (CI updates, dependabot, general discussions)
- "ignore": Spam, noise, or irrelevant

If it needs a reply, draft a brief, professional response (2-3 sentences max). Reference concrete details from the title.

Respond with valid JSON only:
{
  "classification": "needs-you" | "can-wait" | "ignore",
  "draftReply": "your draft reply or empty string if no reply needed",
  "reasoning": "brief explanation of classification"
}`;
}

export function buildClassifyPromptV2(notification: GitHubNotification): string {
  return `You triage GitHub notifications for one developer. Pick exactly one label.

Labels:
- "ignore": spam, scams, giveaways, star or follower offers, ALL CAPS hype, "click here", or repos the developer has no stake in. Spam stays "ignore" even when the reason is "mention".
- "can-wait": automated or low urgency. Dependency bumps (dependabot, renovate, "Bump x from a to b"), CI results, release notes, praise, general discussion, and anything where reason is "subscribed".
- "needs-you": a human is blocked on this developer. Review requests, direct questions or bug reports aimed at them, production incidents.

Examples:
Title: "Review requested: Refactor auth middleware" | Reason: review_requested -> needs-you
Title: "Bump axios from 1.6.0 to 1.6.8" | Reason: author -> can-wait
Title: "Thanks for this library, love it!" | Reason: subscribed -> can-wait
Title: "GET 1000 FOLLOWERS FREE!!! visit now" | Reason: mention -> ignore
Title: "Prod is down after your last merge" | Reason: mention -> needs-you

Notification:
- Repository: ${notification.repository.full_name}
- Type: ${notification.subject.type}
- Title: ${notification.subject.title}
- Reason: ${notification.reason}

Think in one sentence in "reasoning" first, then give "classification". Only write "draftReply" (2 to 3 sentences) for needs-you, otherwise use an empty string. Respond with JSON only.`;
}

const ClassificationSchema = z.object({
  reasoning: z.string(),
  classification: z.enum(['needs-you', 'can-wait', 'ignore']),
  draftReply: z.string(),
});

export async function classifyWithGemma(
  notification: GitHubNotification,
  model: string = 'gemma4:e4b',
): Promise<ClassifiedNotification> {
  return Sentry.startSpan(
    {
      name: 'classify_notification',
      op: 'ai.inference',
      attributes: {
        'ai.model': model,
        'notification.type': notification.subject.type,
        'notification.reason': notification.reason,
        'notification.id': notification.id,
        ...activityTags(),
      },
    },
    async (span) => {
      const startedAt = Date.now();
      const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });

      const promptVersion = process.env.CLASSIFY_PROMPT === 'v1' ? 'v1' : 'v2';
      const finalPrompt = promptVersion === 'v1'
        ? buildClassifyPromptV1(notification)
        : buildClassifyPromptV2(notification);
      span?.setAttribute('ai.prompt_version', promptVersion);

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await ollama.chat({
            model,
            messages: [{ role: 'user', content: finalPrompt }],
            format: promptVersion === 'v1' ? 'json' : (CLASSIFY_JSON_SCHEMA as unknown as object),
            options: {
              temperature: promptVersion === 'v1' ? 0.3 : 0,
            },
          });

          const content = response.message.content.trim();
          const parsed = JSON.parse(content);
          const validated = ClassificationSchema.parse(parsed);
          const usage = usageAttributes(model, response);
          const latencyMs = Date.now() - startedAt;

          span?.setAttributes({
            ...usage,
            'ai.model': model,
            'ai.classification': validated.classification,
            'ai.has_draft': validated.draftReply.length > 0,
            'ai.prompt_version': promptVersion,
            'ai.internal_attempt': attempt + 1,
            'ai.latency_ms': latencyMs,
          });
          console.log('[metrics] ' + JSON.stringify({
            span: 'classify_notification',
            notification: notification.id,
            wall_ms: latencyMs,
            classification: validated.classification,
            prompt_version: promptVersion,
            ...usage,
            ...activityTags(),
          }));

          return {
            ...notification,
            classification: validated.classification,
            draftReply: validated.draftReply,
            reasoning: validated.reasoning,
            latencyMs,
            promptTokens: usage['gen_ai.usage.input_tokens'],
            completionTokens: usage['gen_ai.usage.output_tokens'],
          };
        } catch (error) {
          lastError = error as Error;
          Sentry.captureException(error, {
            extra: { attempt, notification: notification.id, model },
          });
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }

      console.error('Failed to classify after 3 attempts:', lastError);
      if (lastError && isConnectionError(lastError)) {
        span?.setStatus({ code: 2, message: 'ollama_unreachable' });
        console.log('[metrics] ' + JSON.stringify({
          span: 'classify_notification',
          notification: notification.id,
          wall_ms: Date.now() - startedAt,
          error: 'ollama_unreachable',
          ...activityTags(),
        }));
        throw lastError;
      }

      return {
        ...notification,
        classification: 'can-wait' as NotificationClassification,
        draftReply: '',
        reasoning: 'Failed to classify, defaulting to can-wait',
      };
    },
  );
}

export async function generateDigestSummary(
  classifications: ClassifiedNotification[],
  model: string = 'gemma3:1b',
): Promise<string> {
  return Sentry.startSpan(
    {
      name: 'generate_digest_summary',
      op: 'ai.inference',
      attributes: { 'ai.model': model, ...activityTags() },
    },
    async (span) => {
      const startedAt = Date.now();
      const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });

      const needsYouCount = classifications.filter(c => c.classification === 'needs-you').length;
      const canWaitCount = classifications.filter(c => c.classification === 'can-wait').length;
      const ignoredCount = classifications.filter(c => c.classification === 'ignore').length;

      const prompt = `Generate a concise 3-line morning digest summary for a developer's GitHub notifications.

Stats:
- ${needsYouCount} need immediate attention
- ${canWaitCount} can wait
- ${ignoredCount} ignored

Top items needing attention:
${classifications
  .filter(c => c.classification === 'needs-you')
  .slice(0, 3)
  .map(c => `- ${c.repository.full_name}: ${c.subject.title}`)
  .join('\n')}

Write exactly 3 short lines (max 80 chars each), friendly but professional tone.`;

      try {
        const response = await ollama.chat({
          model,
          messages: [{ role: 'user', content: prompt }],
          options: {
            temperature: 0.7,
          },
        });

        const usage = usageAttributes(model, response);
        span?.setAttributes({
          ...usage,
          'ai.model': model,
          'ai.latency_ms': Date.now() - startedAt,
        });
        console.log('[metrics] ' + JSON.stringify({
          span: 'generate_digest_summary',
          wall_ms: Date.now() - startedAt,
          ...usage,
          ...activityTags(),
        }));
        return response.message.content.trim();
      } catch (error) {
        Sentry.captureException(error);
        if (isConnectionError(error)) {
          span?.setStatus({ code: 2, message: 'ollama_unreachable' });
          throw error;
        }
        return `Good morning! You have ${needsYouCount} notifications needing attention.\n${canWaitCount} can be reviewed later, ${ignoredCount} were filtered out.\nLet's tackle the important ones first.`;
      }
    },
  );
}
