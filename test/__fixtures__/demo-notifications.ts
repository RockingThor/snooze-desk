import type { GitHubNotification } from '../../src/types';

export const DEMO_NOTIFICATIONS: GitHubNotification[] = [
  {
    id: '1',
    subject: {
      title: 'Critical bug: App crashes on startup after v2.1.0 update',
      url: 'https://api.github.com/repos/acme/main-app/issues/427',
      type: 'Issue',
    },
    repository: {
      full_name: 'acme/main-app',
      html_url: 'https://github.com/acme/main-app',
    },
    reason: 'mention',
    unread: true,
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    url: 'https://api.github.com/notifications/threads/1',
  },
  {
    id: '2',
    subject: {
      title: 'Review requested: Add dark mode support with theme provider',
      url: 'https://api.github.com/repos/acme/main-app/pulls/312',
      type: 'PullRequest',
    },
    repository: {
      full_name: 'acme/main-app',
      html_url: 'https://github.com/acme/main-app',
    },
    reason: 'review_requested',
    unread: true,
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    url: 'https://api.github.com/notifications/threads/2',
  },
  {
    id: '3',
    subject: {
      title: 'Bump lodash from 4.17.19 to 4.17.21',
      url: 'https://api.github.com/repos/acme/utils-lib/pulls/89',
      type: 'PullRequest',
    },
    repository: {
      full_name: 'acme/utils-lib',
      html_url: 'https://github.com/acme/utils-lib',
    },
    reason: 'author',
    unread: true,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    url: 'https://api.github.com/notifications/threads/3',
  },
  {
    id: '4',
    subject: {
      title: 'How to implement custom authentication with OAuth2 and refresh tokens?',
      url: 'https://api.github.com/repos/you/awesome-lib/issues/156',
      type: 'Issue',
    },
    repository: {
      full_name: 'you/awesome-lib',
      html_url: 'https://github.com/you/awesome-lib',
    },
    reason: 'comment',
    unread: true,
    updated_at: new Date(Date.now() - 10800000).toISOString(),
    url: 'https://api.github.com/notifications/threads/4',
  },
  {
    id: '5',
    subject: {
      title: '🎉 Amazing work! Can we use this in production?',
      url: 'https://api.github.com/repos/you/awesome-lib/discussions/42',
      type: 'Discussion',
    },
    repository: {
      full_name: 'you/awesome-lib',
      html_url: 'https://github.com/you/awesome-lib',
    },
    reason: 'subscribed',
    unread: true,
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    url: 'https://api.github.com/notifications/threads/5',
  },
  {
    id: '6',
    subject: {
      title: 'FREE GITHUB STARS! Click here now!!!',
      url: 'https://api.github.com/repos/random/spam-repo/issues/999',
      type: 'Issue',
    },
    repository: {
      full_name: 'random/spam-repo',
      html_url: 'https://github.com/random/spam-repo',
    },
    reason: 'mention',
    unread: true,
    updated_at: new Date(Date.now() - 43200000).toISOString(),
    url: 'https://api.github.com/notifications/threads/6',
  },
];

// Enriched context for realistic drafts
export const DEMO_NOTIFICATION_CONTEXTS: Record<string, string> = {
  '1': `Stack trace:
Error: Cannot read property 'theme' of undefined
    at ThemeProvider.render (ThemeProvider.tsx:45)
    at App.tsx:12
    at main.tsx:8

Only happens after updating from v2.0.8 to v2.1.0. Rolling back fixes it. 50+ users affected.`,

  '2': `Changes in this PR:
- Added ThemeProvider component with context API
- Implemented dark/light mode toggle in header
- Updated 23 components to use theme variables
- Added system preference detection
- Tests: 12 new, all passing

CI: All checks passed. Ready for review.`,

  '4': `I'm integrating your lib with our auth system. The docs show basic examples but I need:
1. How to handle refresh tokens (do you store them?)
2. Custom claims in JWT
3. Role-based permissions
4. Session timeout configuration

Using Next.js 14 with App Router. Any examples would help!`,
};

export const DEMO_MODEL = 'gemma4:e4b';
