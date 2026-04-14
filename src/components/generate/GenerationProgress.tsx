import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

interface QAStatus {
  attempt: number;
  maxAttempts: number;
  objectiveScore: number;
  perceptualScore: number;
  issues: string[];
  suggestions: string[];
  passed: boolean;
}

interface Props {
  progress: number;
  message: string;
  generating: boolean;
  qaStatus: QAStatus | null;
}

export function GenerationProgress({ progress, message, generating, qaStatus }: Props) {
  if (!generating && !qaStatus) return null;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {generating && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{message}</p>
              <p className="text-[10px] text-muted-foreground">{Math.round(progress)}% complete</p>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* QA Results */}
      {qaStatus && !generating && (
        <div
          className={`rounded-lg border p-4 space-y-3 ${
            qaStatus.passed
              ? 'border-primary/30 bg-primary/5'
              : 'border-yellow-500/30 bg-yellow-500/5'
          }`}
        >
          <div className="flex items-center gap-2">
            {qaStatus.passed ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold">
              Quality Check {qaStatus.passed ? 'Passed' : '— Issues Detected'}
            </span>
            {qaStatus.attempt > 1 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                <RotateCcw className="h-3 w-3" />
                {qaStatus.attempt} attempts
              </span>
            )}
          </div>

          {/* Score bars */}
          <div className="grid grid-cols-2 gap-3">
            <ScoreBar label="Objective" score={qaStatus.objectiveScore} />
            <ScoreBar label="Perceptual" score={qaStatus.perceptualScore} />
          </div>

          {/* Issues */}
          {qaStatus.issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Issues</p>
              <ul className="space-y-1">
                {qaStatus.issues.slice(0, 4).map((issue, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-yellow-500 mt-px">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {qaStatus.suggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Suggestions</p>
              <ul className="space-y-1">
                {qaStatus.suggestions.slice(0, 3).map((sug, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-px">→</span>
                    {sug}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? 'bg-primary' : score >= 4 ? 'bg-yellow-500' : 'bg-destructive';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold">{score}/10</span>
      </div>
      <div className="h-1 rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
