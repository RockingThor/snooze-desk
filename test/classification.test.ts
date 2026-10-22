import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CLASSIFY_JSON_SCHEMA,
  buildClassifyPromptV2,
  isConnectionError,
} from '../src/activities/gemma';
import type { GitHubNotification } from '../src/types';

const ClassificationSchema = z.object({
  classification: z.enum(['needs-you', 'can-wait', 'ignore']),
  draftReply: z.string(),
  reasoning: z.string(),
});

describe('Classification Parsing', () => {
  it('should parse valid classification JSON', () => {
    const validJson = JSON.stringify({
      classification: 'needs-you',
      draftReply: 'Thanks for the PR!',
      reasoning: 'Review requested',
    });

    const parsed = JSON.parse(validJson);
    const result = ClassificationSchema.parse(parsed);

    expect(result.classification).toBe('needs-you');
    expect(result.draftReply).toBe('Thanks for the PR!');
    expect(result.reasoning).toBe('Review requested');
  });

  it('should reject invalid classification values', () => {
    const invalidJson = JSON.stringify({
      classification: 'invalid-value',
      draftReply: 'Test',
      reasoning: 'Test',
    });

    const parsed = JSON.parse(invalidJson);
    expect(() => ClassificationSchema.parse(parsed)).toThrow();
  });

  it('should require all fields', () => {
    const incompleteJson = JSON.stringify({
      classification: 'needs-you',
      draftReply: 'Test',
    });

    const parsed = JSON.parse(incompleteJson);
    expect(() => ClassificationSchema.parse(parsed)).toThrow();
  });

  it('should handle empty draft reply', () => {
    const validJson = JSON.stringify({
      classification: 'ignore',
      draftReply: '',
      reasoning: 'Spam content',
    });

    const parsed = JSON.parse(validJson);
    const result = ClassificationSchema.parse(parsed);

    expect(result.classification).toBe('ignore');
    expect(result.draftReply).toBe('');
  });

  it('should parse all classification types', () => {
    const classifications = ['needs-you', 'can-wait', 'ignore'] as const;

    classifications.forEach(classification => {
      const json = JSON.stringify({
        classification,
        draftReply: 'Test reply',
        reasoning: 'Test reasoning',
      });

      const parsed = JSON.parse(json);
      const result = ClassificationSchema.parse(parsed);
      expect(result.classification).toBe(classification);
    });
  });

  it('parses reason-then-label JSON', () => {
    const parsed = JSON.parse(JSON.stringify({
      reasoning: 'Spam giveaway',
      classification: 'ignore',
      draftReply: '',
    }));
    const result = ClassificationSchema.parse(parsed);
    expect(result.classification).toBe('ignore');
    expect(result.reasoning).toBe('Spam giveaway');
  });
});

describe('Classify prompt v2', () => {
  const sample: GitHubNotification = {
    id: '6',
    subject: { title: 'FREE GITHUB STARS! Click here now!!!', url: null, type: 'Issue' },
    repository: { full_name: 'random/spam-repo', html_url: 'https://github.com/random/spam-repo' },
    reason: 'mention',
    unread: true,
    updated_at: new Date().toISOString(),
    url: 'https://api.github.com/notifications/threads/6',
  };

  it('includes five few-shot examples and ignore-even-when-mention', () => {
    const prompt = buildClassifyPromptV2(sample);
    expect(prompt).toContain('review_requested -> needs-you');
    expect(prompt).toContain('Bump axios from 1.6.0 to 1.6.8');
    expect(prompt).toContain('subscribed -> can-wait');
    expect(prompt).toContain('GET 1000 FOLLOWERS FREE');
    expect(prompt).toContain('Prod is down after your last merge');
    expect(prompt).toContain('Spam stays "ignore" even when the reason is "mention"');
    expect(prompt).toContain('Think in one sentence in "reasoning" first');
    expect(prompt).toContain(sample.subject.title);
  });

  it('limits the JSON schema enum to three labels', () => {
    expect(CLASSIFY_JSON_SCHEMA.properties.classification.enum).toEqual([
      'needs-you',
      'can-wait',
      'ignore',
    ]);
    expect(CLASSIFY_JSON_SCHEMA.required).toEqual([
      'reasoning',
      'classification',
      'draftReply',
    ]);
  });

  it('treats Ollama connection failures as retryable', () => {
    expect(isConnectionError(new Error('fetch failed'))).toBe(true);
    expect(isConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:11434'))).toBe(true);
    expect(isConnectionError({ message: 'x', cause: 'other side closed' })).toBe(true);
    expect(isConnectionError(new Error('invalid json'))).toBe(false);
  });
});
