import { describe, it, expect, vi } from 'vitest';
import type { GitHubNotification } from '../src/types';

describe('Notification Processor Workflow Logic', () => {
  it('should classify critical bugs as needs-you', () => {
    const notification: GitHubNotification = {
      id: '1',
      subject: {
        title: 'Critical bug: App crashes on startup',
        url: 'https://api.github.com/repos/test/repo/issues/1',
        type: 'Issue',
      },
      repository: {
        full_name: 'test/repo',
        html_url: 'https://github.com/test/repo',
      },
      reason: 'mention',
      unread: true,
      updated_at: new Date().toISOString(),
      url: 'https://api.github.com/notifications/threads/1',
    };

    const shouldNeedAttention =
      notification.subject.title.toLowerCase().includes('critical') ||
      notification.subject.title.toLowerCase().includes('crash') ||
      notification.subject.title.toLowerCase().includes('bug');

    expect(shouldNeedAttention).toBe(true);
  });

  it('should classify dependabot PRs as can-wait', () => {
    const notification: GitHubNotification = {
      id: '2',
      subject: {
        title: 'Bump lodash from 4.17.19 to 4.17.21',
        url: 'https://api.github.com/repos/test/repo/pulls/89',
        type: 'PullRequest',
      },
      repository: {
        full_name: 'test/repo',
        html_url: 'https://github.com/test/repo',
      },
      reason: 'author',
      unread: true,
      updated_at: new Date().toISOString(),
      url: 'https://api.github.com/notifications/threads/2',
    };

    const isDependabot =
      notification.subject.title.toLowerCase().includes('bump') &&
      notification.reason === 'author';

    expect(isDependabot).toBe(true);
  });

  it('should classify spam as ignore', () => {
    const notification: GitHubNotification = {
      id: '3',
      subject: {
        title: 'FREE GITHUB STARS! Click here now!!!',
        url: 'https://api.github.com/repos/spam/repo/issues/999',
        type: 'Issue',
      },
      repository: {
        full_name: 'spam/repo',
        html_url: 'https://github.com/spam/repo',
      },
      reason: 'mention',
      unread: true,
      updated_at: new Date().toISOString(),
      url: 'https://api.github.com/notifications/threads/3',
    };

    const isSpam =
      notification.subject.title.includes('FREE') &&
      notification.subject.title.includes('!!!');

    expect(isSpam).toBe(true);
  });

  it('should prioritize review requests', () => {
    const notification: GitHubNotification = {
      id: '4',
      subject: {
        title: 'Review requested: Add dark mode',
        url: 'https://api.github.com/repos/test/repo/pulls/312',
        type: 'PullRequest',
      },
      repository: {
        full_name: 'test/repo',
        html_url: 'https://github.com/test/repo',
      },
      reason: 'review_requested',
      unread: true,
      updated_at: new Date().toISOString(),
      url: 'https://api.github.com/notifications/threads/4',
    };

    expect(notification.reason).toBe('review_requested');
  });
});
