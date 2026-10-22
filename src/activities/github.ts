import { Octokit } from '@octokit/rest';
import type { GitHubNotification } from '../types';
import * as Sentry from '@sentry/nextjs';
import { activityTags } from './gemma';

export async function fetchGitHubNotifications(
  githubToken: string,
): Promise<GitHubNotification[]> {
  return Sentry.startSpan(
    { name: 'fetch_github_notifications', op: 'ai.activity', attributes: { ...activityTags() } },
    async (span) => {
      const octokit = new Octokit({ auth: githubToken });
      const { data } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
        all: false,
        participating: true,
      });
      span?.setAttributes({
        'github.notification_count': data.length,
      });
      return data as GitHubNotification[];
    },
  );
}

export async function postGitHubComment(
  githubToken: string,
  notificationUrl: string,
  comment: string,
): Promise<void> {
  return Sentry.startSpan(
    { name: 'post_github_comment', op: 'ai.activity', attributes: { ...activityTags() } },
    async (span) => {
      const octokit = new Octokit({ auth: githubToken });
      
      const urlMatch = notificationUrl.match(/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (!urlMatch) {
        throw new Error('Invalid notification URL format');
      }
      
      const [, owner, repo, issueNumber] = urlMatch;

      span?.setAttributes({
        'github.owner': owner,
        'github.repo': repo,
        'github.issue_number': issueNumber,
      });
      
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(issueNumber, 10),
        body: comment,
      });
    },
  );
}
