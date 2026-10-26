import { ShieldAlert } from 'lucide-react';

interface VerifyBadgeProps {
  ruleKey?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export function VerifyBadge({ label = 'Verify', size = 'sm' }: VerifyBadgeProps) {
  const sz = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-warning-50 border border-warning-500/30 text-warning-700 font-medium ${sz}`}
      title="This rule is unverified. Check the official source before relying on it."
    >
      <ShieldAlert className={size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
      {label}
    </span>
  );
}
