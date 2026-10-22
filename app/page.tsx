'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, RefreshCw } from 'lucide-react';
import { DigestCard } from '@/components/features/digest-card';
import { DraftCard } from '@/components/features/draft-card';
import { Button } from '@/components/ui/button';
import type { MorningDigest, Draft } from '@/src/types';

const MOCK_DIGEST: MorningDigest = {
  date: new Date().toISOString(),
  summary: `Good morning! 3 notifications need your attention today.\n2 items can be reviewed later at your convenience.\nYour most urgent items are a bug report and a PR review.`,
  needsYou: {
    classification: 'needs-you',
    count: 3,
    items: [
      { repo: 'acme/main-app', title: 'Critical bug: App crashes on startup', reason: 'mention' },
      { repo: 'acme/main-app', title: 'Review requested: Add dark mode support', reason: 'review_requested' },
      { repo: 'you/awesome-lib', title: 'How to implement custom authentication?', reason: 'comment' },
    ],
  },
  canWait: {
    classification: 'can-wait',
    count: 2,
    items: [
      { repo: 'acme/utils-lib', title: 'Bump lodash from 4.17.19 to 4.17.21', reason: 'author' },
      { repo: 'you/awesome-lib', title: '🎉 Amazing work! Can we use this in production?', reason: 'subscribed' },
    ],
  },
  ignored: {
    classification: 'ignore',
    count: 1,
    items: [
      { repo: 'random/spam-repo', title: 'FREE GITHUB STARS! Click here now!!!', reason: 'mention' },
    ],
  },
  processedCount: 6,
};

export default function HomePage() {
  const [digest, setDigest] = useState<MorningDigest | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeline, setTimeline] = useState<Array<{time: string; event: string}>>([]);
  const [demoRun, setDemoRun] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setDigest(MOCK_DIGEST);
      
      const draftsResponse = await fetch('/api/drafts');
      if (draftsResponse.ok) {
        const draftsData = await draftsResponse.json();
        const list = Array.isArray(draftsData) ? draftsData : draftsData.drafts;
        setDrafts(list ?? []);
        setDemoRun(Boolean(draftsData.demo));
        if (Array.isArray(draftsData.timeline)) {
          setTimeline(draftsData.timeline);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (draftId: string) => {
    if (!workflowId) {
      setDrafts(prev => prev.map(d => 
        d.id === draftId ? { ...d, status: 'approved' as const } : d
      ));
      return;
    }

    try {
      await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, draftId }),
      });
      setDrafts(prev => prev.map(d => 
        d.id === draftId ? { ...d, status: 'approved' as const } : d
      ));
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = (draftId: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, status: 'rejected' as const } : d
    ));
  };

  const handleSnooze = async (draftId: string, hours: number) => {
    if (!workflowId) {
      setDrafts(prev => prev.map(d => 
        d.id === draftId ? { 
          ...d, 
          status: 'snoozed' as const,
          snoozedUntil: new Date(Date.now() + hours * 3600000).toISOString()
        } : d
      ));
      return;
    }

    try {
      await fetch('/api/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, draftId, hours }),
      });
      setDrafts(prev => prev.map(d => 
        d.id === draftId ? { 
          ...d, 
          status: 'snoozed' as const,
          snoozedUntil: new Date(Date.now() + hours * 3600000).toISOString()
        } : d
      ));
    } catch (error) {
      console.error('Failed to snooze:', error);
    }
  };

  const handleEdit = (draftId: string, newReply: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, draftReply: newReply } : d
    ));
  };

  const handleWake = (draftId: string) => {
    setDrafts(prev => prev.map(d =>
      d.id === draftId && d.status === 'snoozed'
        ? { ...d, status: 'pending' as const, snoozedUntil: undefined }
        : d
    ));
  };

  const pendingDrafts = drafts.filter(d => d.status === 'pending');
  const snoozedDrafts = drafts.filter(d => d.status === 'snoozed');
  const completedDrafts = drafts.filter(d => d.status === 'approved' || d.status === 'rejected');

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Moon className="h-8 w-8 text-white" />
            <h1 className="text-4xl font-bold">Snooze Desk</h1>
            <Sun className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-400">The lazy developer&apos;s overnight desk</p>
        </header>

        {/* Overnight Timeline */}
        {timeline.length > 0 && (
          <div data-testid="timeline" className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4 animate-in">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              {demoRun ? 'Demo run' : 'While you slept'}
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {timeline.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{entry.time}</span>
                  <span className="text-sm text-gray-300">{entry.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : (
          <div className="space-y-8">
            {digest && <DigestCard digest={digest} />}

            {pendingDrafts.length > 0 && (
              <section data-testid="pending-drafts">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-red-400">Pending Drafts</span>
                  <span className="text-sm text-gray-500">({pendingDrafts.length})</span>
                </h2>
                <div className="grid gap-4">
                  {pendingDrafts.map(draft => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onSnooze={handleSnooze}
                      onEdit={handleEdit}
                      onWake={handleWake}
                    />
                  ))}
                </div>
              </section>
            )}

            {snoozedDrafts.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-gray-400">Snoozed</span>
                  <span className="text-sm text-gray-500">({snoozedDrafts.length})</span>
                </h2>
                <div className="grid gap-4">
                  {snoozedDrafts.map(draft => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onSnooze={handleSnooze}
                      onWake={handleWake}
                    />
                  ))}
                </div>
              </section>
            )}

            {completedDrafts.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-green-400">Handled</span>
                  <span className="text-sm text-gray-500">({completedDrafts.length})</span>
                </h2>
                <div className="grid gap-4">
                  {completedDrafts.map(draft => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onSnooze={handleSnooze}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadData} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
