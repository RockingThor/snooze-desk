'use client';

import { useState, useEffect } from 'react';
import { Clock, Check, X, GitPullRequest, MessageSquare, AlertCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Draft } from '@/src/types';
import { formatDistanceToNow } from 'date-fns';

interface DraftCardProps {
  draft: Draft;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSnooze: (id: string, hours: number) => void;
  onEdit?: (id: string, newReply: string) => void;
  onWake?: (id: string) => void;
}

export function DraftCard({ draft, onApprove, onReject, onSnooze, onEdit, onWake }: DraftCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReply, setEditedReply] = useState(draft.draftReply);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (draft.status === 'snoozed' && draft.snoozedUntil) {
      const timer = setInterval(() => {
        const now = Date.now();
        const target = new Date(draft.snoozedUntil!).getTime();
        const diff = target - now;
        
        if (diff <= 0) {
          setCountdown('Ready to wake');
          clearInterval(timer);
          onWake?.(draft.id);
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setCountdown(`${minutes}m ${seconds}s`);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [draft.status, draft.snoozedUntil, draft.id, onWake]);

  const handleSaveEdit = () => {
    onEdit?.(draft.id, editedReply);
    setIsEditing(false);
  };

  const getTypeIcon = () => {
    switch (draft.type) {
      case 'PullRequest':
        return <GitPullRequest className="h-4 w-4" />;
      case 'Issue':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = () => {
    switch (draft.classification) {
      case 'needs-you':
        return 'destructive';
      case 'can-wait':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusDisplay = () => {
    switch (draft.status) {
      case 'approved':
        return <Badge variant="success">✓ Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline">Rejected</Badge>;
      case 'snoozed':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {countdown}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      data-testid={`draft-${draft.notificationId}`}
      data-status={draft.status}
      className={draft.classification === 'needs-you' ? 'border-red-600/30' : draft.status === 'approved' ? 'border-green-600/30' : ''}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {getTypeIcon()}
              <CardTitle className="text-base leading-tight">{draft.title}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getBadgeVariant()}>
                {draft.classification.replace('-', ' ')}
              </Badge>
              <span className="text-xs text-gray-500">{draft.repo}</span>
            </div>
          </div>
          {getStatusDisplay()}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {draft.context && (
          <pre className="rounded-md border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
            {draft.context}
          </pre>
        )}
        <div className="rounded-md bg-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">AI Reasoning:</p>
          <p className="text-sm text-gray-300">{draft.reasoning}</p>
        </div>

        {draft.draftReply && (
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-400 mb-2">Draft Reply:</p>
            {isEditing ? (
              <textarea
                data-testid="draft-reply"
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded px-2 py-1 text-sm text-white min-h-[100px]"
              />
            ) : (
              <p className="text-sm text-white whitespace-pre-wrap">{draft.draftReply}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          <span>{formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}</span>
          {draft.model && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {draft.cachedDemo
                ? `${draft.model}, cached demo draft`
                : draft.model}
            </span>
          )}
          {!draft.cachedDemo && draft.latency != null && (
            <span>{(draft.latency / 1000).toFixed(1)}s live</span>
          )}
        </div>
      </CardContent>

      {draft.status === 'pending' && (
        <CardFooter className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="success" data-testid="save-edit" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="success"
                data-testid="approve"
                onClick={() => onApprove(draft.id)}
                className="flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              {onEdit && (
                <Button size="sm" variant="outline" data-testid="edit" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSnooze(draft.id, 4)}
                className="flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                4h
              </Button>
              {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="snooze-30s"
                  onClick={() => onSnooze(draft.id, 30 / 3600)}
                  className="flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  30s
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(draft.id)}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
