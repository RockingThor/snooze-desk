export type NotificationClassification = 'needs-you' | 'can-wait' | 'ignore';

export interface GitHubNotification {
  id: string;
  subject: {
    title: string;
    url: string | null;
    type: string;
  };
  repository: {
    full_name: string;
    html_url: string;
  };
  reason: string;
  unread: boolean;
  updated_at: string;
  url: string;
}

export interface ClassifiedNotification extends GitHubNotification {
  classification: NotificationClassification;
  draftReply: string;
  reasoning: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface WorkflowInput {
  githubToken?: string;
  /** Model for classify_notification. Default gemma4:e4b. */
  ollamaModel?: string;
  /** Model for generate_digest_summary. Default gemma3:1b. */
  digestModel?: string;
  demoMode?: boolean;
  /** Run live Gemma inference on the demo fixtures (no GitHub token needed). */
  liveFixtures?: boolean;
  /** Optional cap on how many notifications to process. */
  maxItems?: number;
}

export interface DigestEntry {
  classification: NotificationClassification;
  count: number;
  items: Array<{
    repo: string;
    title: string;
    reason: string;
  }>;
}

export interface MorningDigest {
  date: string;
  summary: string;
  needsYou: DigestEntry;
  canWait: DigestEntry;
  ignored: DigestEntry;
  processedCount: number;
}

export interface Draft {
  id: string;
  notificationId: string;
  repo: string;
  title: string;
  type: string;
  classification: NotificationClassification;
  draftReply: string;
  reasoning: string;
  context?: string;
  url: string | null;
  snoozedUntil?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'snoozed';
  model?: string;
  /** Wall-clock ms from a live Ollama call. Omit for cached demo drafts. */
  latency?: number;
  cachedDemo?: boolean;
  promptTokens?: number;
  completionTokens?: number;
}
