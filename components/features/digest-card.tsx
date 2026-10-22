import { Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { MorningDigest } from '@/src/types';

interface DigestCardProps {
  digest: MorningDigest;
}

export function DigestCard({ digest }: DigestCardProps) {
  return (
    <Card data-testid="digest" className="border-white/20 animate-in">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-white" />
          <CardTitle className="text-xl">Morning Digest</CardTitle>
        </div>
        <p className="text-sm text-gray-400">
          {new Date(digest.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-white/5 p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-white">
            {digest.summary}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-md border border-red-600/20 bg-red-600/10 p-3">
            <span className="text-sm font-medium text-red-400">Needs Your Attention</span>
            <span className="text-lg font-bold text-red-400">{digest.needsYou.count}</span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-3">
            <span className="text-sm font-medium text-gray-300">Can Wait</span>
            <span className="text-lg font-bold text-gray-300">{digest.canWait.count}</span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-3">
            <span className="text-sm font-medium text-gray-500">Ignored</span>
            <span className="text-lg font-bold text-gray-500">{digest.ignored.count}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
