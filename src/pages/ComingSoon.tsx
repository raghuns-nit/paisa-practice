import { Construction } from 'lucide-react';

export function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <Construction className="h-12 w-12 text-ink-300 mb-4" />
      <h2 className="text-xl font-semibold text-ink-700">Coming Soon</h2>
      <p className="text-sm text-ink-500 mt-2 max-w-sm">
        This section is under construction. Check back as we build out more features.
      </p>
    </div>
  );
}
