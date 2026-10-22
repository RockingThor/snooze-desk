import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/src/lib/temporal-client', () => ({
  startWorkflow: vi.fn().mockResolvedValue({
    workflowId: 'test-workflow',
    runId: 'test-run',
  }),
  approveNotification: vi.fn().mockResolvedValue(undefined),
  snoozeNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_, fn) => fn({ setAttributes: vi.fn() })),
  captureException: vi.fn(),
}));

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/notifications', () => {
    it('should start a workflow with demo mode', async () => {
      const { startWorkflow } = await import('@/src/lib/temporal-client');
      const { POST } = await import('../app/api/notifications/route');

      const request = new Request('http://localhost/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ demoMode: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(startWorkflow).toHaveBeenCalledWith({
        githubToken: undefined,
        ollamaModel: undefined,
        demoMode: true,
      });
      expect(data.workflowId).toBe('test-workflow');
    });
  });

  describe('POST /api/approve', () => {
    it('should approve a draft', async () => {
      const { approveNotification } = await import('@/src/lib/temporal-client');
      const { POST } = await import('../app/api/approve/route');

      const request = new Request('http://localhost/api/approve', {
        method: 'POST',
        body: JSON.stringify({ workflowId: 'test-workflow', draftId: 'draft-1' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(approveNotification).toHaveBeenCalledWith('test-workflow', 'draft-1');
      expect(data.success).toBe(true);
    });

    it('should return 400 for missing parameters', async () => {
      const { POST } = await import('../app/api/approve/route');

      const request = new Request('http://localhost/api/approve', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request as any);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/drafts', () => {
    it('returns cached demo drafts with no latency', async () => {
      const { GET } = await import('../app/api/drafts/route');
      const request = {
        nextUrl: { searchParams: new URLSearchParams() },
      };
      const response = await GET(request as any);
      const data = await response.json();

      expect(data.demo).toBe(true);
      expect(data.timeline.length).toBeGreaterThan(0);
      expect(data.drafts.length).toBe(3);
      for (const draft of data.drafts) {
        expect(draft.cachedDemo).toBe(true);
        expect(draft.latency).toBeUndefined();
        expect(draft.model).toBe('gemma4:e4b');
      }
    });
  });

  describe('POST /api/snooze', () => {
    it('should snooze a draft', async () => {
      const { snoozeNotification } = await import('@/src/lib/temporal-client');
      const { POST } = await import('../app/api/snooze/route');

      const request = new Request('http://localhost/api/snooze', {
        method: 'POST',
        body: JSON.stringify({ workflowId: 'test-workflow', draftId: 'draft-1', hours: 4 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(snoozeNotification).toHaveBeenCalledWith('test-workflow', 'draft-1', 4);
      expect(data.success).toBe(true);
    });
  });
});
