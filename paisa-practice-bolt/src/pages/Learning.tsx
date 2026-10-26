import { useState, useEffect } from 'react';
import {
  BookOpen, CheckCircle2, Circle, Award, Loader2, ChevronRight, ChevronDown,
  Brain, GraduationCap, Lightbulb, TrendingUp, ShieldAlert, PiggyBank,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { VerifyBadge } from '../components/VerifyBadge';
import type { LearningProgress } from '../lib/types';

interface QuizOption {
  text: string;
  correct: boolean;
}

interface QuizQuestion {
  question: string;
  options: QuizOption[];
  explanation: string;
}

interface Module {
  key: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  color: string;
  badge: string;
  quiz: QuizQuestion[];
}

const MODULES: Module[] = [
  {
    key: 'banking_basics',
    title: 'Banking Basics',
    description: 'Learn how banks work — accounts, deposits, withdrawals, and the role of RBI.',
    icon: BookOpen,
    color: 'bg-brand-500',
    badge: 'Banking Novice',
    quiz: [
      {
        question: 'What does RBI stand for?',
        options: [
          { text: 'Reserve Bank of India', correct: true },
          { text: 'Royal Bank of India', correct: false },
          { text: 'Rural Banking Institution', correct: false },
          { text: 'Regulated Bank of India', correct: false },
        ],
        explanation: 'The Reserve Bank of India is the central bank that regulates the country\'s monetary policy and banking system.',
      },
      {
        question: 'What is the full form of KYC?',
        options: [
          { text: 'Keep Your Cash', correct: false },
          { text: 'Know Your Customer', correct: true },
          { text: 'Key Your Code', correct: false },
          { text: 'Kindly Yield Cash', correct: false },
        ],
        explanation: 'KYC (Know Your Customer) is the process banks use to verify the identity of their clients.',
      },
      {
        question: 'Which account typically earns the highest interest among these?',
        options: [
          { text: 'Current Account', correct: false },
          { text: 'Savings Account', correct: false },
          { text: 'Fixed Deposit', correct: true },
          { text: 'Zero Balance Account', correct: false },
        ],
        explanation: 'Fixed Deposits lock your money for a period and typically offer higher interest than savings or current accounts.',
      },
      {
        question: 'What is the purpose of a passbook?',
        options: [
          { text: 'To store passwords', correct: false },
          { text: 'To record all account transactions', correct: true },
          { text: 'To apply for loans', correct: false },
          { text: 'To pay taxes', correct: false },
        ],
        explanation: 'A passbook is a record of all deposits, withdrawals, and interest in your bank account.',
      },
    ],
  },
  {
    key: 'savings_deposits',
    title: 'Savings & Deposits',
    description: 'Understand savings accounts, fixed deposits, recurring deposits, and compounding.',
    icon: PiggyBank,
    color: 'bg-accent-500',
    badge: 'Savings Savvy',
    quiz: [
      {
        question: 'What is the power of compounding?',
        options: [
          { text: 'Earning interest only on your principal', correct: false },
          { text: 'Earning interest on principal plus accumulated interest', correct: true },
          { text: 'Paying compound fees', correct: false },
          { text: 'Combining multiple accounts', correct: false },
        ],
        explanation: 'Compounding means you earn interest on your interest, which accelerates wealth growth over time.',
      },
      {
        question: 'In a Recurring Deposit (RD), you typically:',
        options: [
          { text: 'Deposit a lump sum once', correct: false },
          { text: 'Deposit a fixed amount every month', correct: true },
          { text: 'Withdraw money anytime', correct: false },
          { text: 'Pay a monthly fee', correct: false },
        ],
        explanation: 'An RD requires you to deposit a fixed amount each month for a set period, building savings gradually.',
      },
      {
        question: 'What happens if you break a Fixed Deposit before maturity?',
        options: [
          { text: 'You earn more interest', correct: false },
          { text: 'You may pay a premature withdrawal penalty', correct: true },
          { text: 'Nothing changes', correct: false },
          { text: 'Your account is closed permanently', correct: false },
        ],
        explanation: 'Banks usually charge a penalty (lower interest rate) for breaking an FD before its maturity date.',
      },
      {
        question: 'What is DICGC deposit insurance limit?',
        options: [
          { text: '₹1 lakh', correct: false },
          { text: '₹2 lakh', correct: false },
          { text: '₹5 lakh', correct: true },
          { text: '₹10 lakh', correct: false },
        ],
        explanation: 'DICGC insures bank deposits up to ₹5 lakh per depositor per bank (including principal and interest).',
      },
      {
        question: 'Which yields more for the same rate and tenure?',
        options: [
          { text: 'Simple interest', correct: false },
          { text: 'Compound interest', correct: true },
          { text: 'Both are equal', correct: false },
          { text: 'Depends on the bank', correct: false },
        ],
        explanation: 'Compound interest always yields more than simple interest for the same rate and tenure, because interest earns interest.',
      },
    ],
  },
  {
    key: 'insurance_101',
    title: 'Insurance 101',
    description: 'Premiums, sum insured, claims, nominees, and why insurance matters.',
    icon: ShieldAlert,
    color: 'bg-blue-500',
    badge: 'Insurance Aware',
    quiz: [
      {
        question: 'What is a "sum insured"?',
        options: [
          { text: 'The premium you pay', correct: false },
          { text: 'The maximum amount the insurer will pay for a claim', correct: true },
          { text: 'The policy term', correct: false },
          { text: 'The number of claims allowed', correct: false },
        ],
        explanation: 'Sum insured is the maximum payout the insurance company will provide for covered claims under your policy.',
      },
      {
        question: 'Who is a "nominee" in insurance?',
        options: [
          { text: 'The insurance agent', correct: false },
          { text: 'The person who receives the benefit if the policyholder dies', correct: true },
          { text: 'The bank', correct: false },
          { text: 'The government', correct: false },
        ],
        explanation: 'A nominee is the person you designate to receive the insurance payout in case of your death.',
      },
      {
        question: 'What is a premium?',
        options: [
          { text: 'The payout you receive', correct: false },
          { text: 'The amount you pay for insurance cover', correct: true },
          { text: 'A discount on insurance', correct: false },
          { text: 'A type of policy', correct: false },
        ],
        explanation: 'A premium is the periodic payment you make to keep your insurance policy active.',
      },
      {
        question: 'Term life insurance primarily provides:',
        options: [
          { text: 'Investment returns', correct: false },
          { text: 'Pure life cover for a fixed period', correct: true },
          { text: 'Health benefits', correct: false },
          { text: 'Tax-free maturity', correct: false },
        ],
        explanation: 'Term insurance provides pure protection — a death benefit if the insured dies during the term, with no investment component.',
      },
    ],
  },
  {
    key: 'investment_fundamentals',
    title: 'Investment Fundamentals',
    description: 'Mutual funds, SIPs, risk vs reward, diversification, and the magic of long-term investing.',
    icon: TrendingUp,
    color: 'bg-purple-500',
    badge: 'Investment Ready',
    quiz: [
      {
        question: 'What does SIP stand for?',
        options: [
          { text: 'Single Investment Plan', correct: false },
          { text: 'Systematic Investment Plan', correct: true },
          { text: 'Savings Insurance Policy', correct: false },
          { text: 'Secure Interest Product', correct: false },
        ],
        explanation: 'A SIP (Systematic Investment Plan) lets you invest a fixed amount at regular intervals, averaging market volatility.',
      },
      {
        question: 'What does "diversification" mean in investing?',
        options: [
          { text: 'Putting all money in one stock', correct: false },
          { text: 'Spreading investments across different assets', correct: true },
          { text: 'Trading frequently', correct: false },
          { text: 'Investing only in gold', correct: false },
        ],
        explanation: 'Diversification spreads risk by investing across different asset classes, reducing the impact of any single investment failing.',
      },
      {
        question: 'Generally, higher investment risk means:',
        options: [
          { text: 'Guaranteed higher returns', correct: false },
          { text: 'Potential for higher returns but more uncertainty', correct: true },
          { text: 'No returns', correct: false },
          { text: 'Lower returns', correct: false },
        ],
        explanation: 'The risk-return tradeoff: higher potential returns usually come with higher risk and uncertainty.',
      },
      {
        question: 'What is an "exit load" in a mutual fund?',
        options: [
          { text: 'A fee to enter the fund', correct: false },
          { text: 'A fee charged when you withdraw within a short period', correct: true },
          { text: 'A government tax', correct: false },
          { text: 'A bonus for staying invested', correct: false },
        ],
        explanation: 'An exit load is a fee charged when you redeem mutual fund units before a specified holding period, discouraging early exits.',
      },
    ],
  },
  {
    key: 'tax_planning',
    title: 'Tax Planning',
    description: 'Understand income tax slabs, 80C deductions, and how to save tax legally.',
    icon: GraduationCap,
    color: 'bg-rose-500',
    badge: 'Tax Smart',
    quiz: [
      {
        question: 'Under Section 80C, what is the maximum deduction limit?',
        options: [
          { text: '₹1 lakh', correct: false },
          { text: '₹1.5 lakh', correct: true },
          { text: '₹2 lakh', correct: false },
          { text: '₹50,000', correct: false },
        ],
        explanation: 'Section 80C allows deductions up to ₹1.5 lakh through PPF, ELSS, life insurance premium, and other eligible investments.',
      },
      {
        question: 'Which of these qualifies for 80C deduction?',
        options: [
          { text: 'Savings account interest', correct: false },
          { text: 'PPF contribution', correct: true },
          { text: 'Lottery winnings', correct: false },
          { text: 'Credit card bills', correct: false },
        ],
        explanation: 'PPF (Public Provident Fund) contributions qualify for 80C deduction up to ₹1.5 lakh per year.',
      },
      {
        question: 'What is a PAN card?',
        options: [
          { text: 'A bank passbook', correct: false },
          { text: 'A Permanent Account Number for tax identification', correct: true },
          { text: 'An insurance policy', correct: false },
          { text: 'A pension scheme', correct: false },
        ],
        explanation: 'PAN (Permanent Account Number) is a 10-character alphanumeric identifier issued by the Income Tax Department.',
      },
      {
        question: 'Health insurance premiums can be deducted under which section?',
        options: [
          { text: 'Section 80C', correct: false },
          { text: 'Section 80D', correct: true },
          { text: 'Section 80E', correct: false },
          { text: 'Section 80G', correct: false },
        ],
        explanation: 'Section 80D allows deduction for health insurance premiums paid for yourself, family, and parents.',
      },
    ],
  },
  {
    key: 'scam_awareness',
    title: 'Scam Awareness',
    description: 'Recognise phishing, OTP fraud, fake investment schemes, and how to protect yourself.',
    icon: ShieldAlert,
    color: 'bg-orange-500',
    badge: 'Scam Sentinel',
    quiz: [
      {
        question: 'Someone calls saying they are from your bank and asks for your OTP. You should:',
        options: [
          { text: 'Share the OTP to verify your identity', correct: false },
          { text: 'Never share your OTP with anyone', correct: true },
          { text: 'Share it only if they know your name', correct: false },
          { text: 'Share the first 3 digits only', correct: false },
        ],
        explanation: 'Banks never ask for your OTP. Sharing it allows fraudsters to authorise transactions from your account.',
      },
      {
        question: 'An investment promises "guaranteed 20% monthly returns". This is likely:',
        options: [
          { text: 'A great opportunity', correct: false },
          { text: 'A scam — guaranteed high returns are a red flag', correct: true },
          { text: 'A government scheme', correct: false },
          { text: 'A bank deposit', correct: false },
        ],
        explanation: 'No legitimate investment guarantees very high returns. Such promises are a hallmark of Ponzi schemes and scams.',
      },
      {
        question: 'You receive an SMS with a link claiming your account is blocked. You should:',
        options: [
          { text: 'Click the link and enter credentials', correct: false },
          { text: 'Contact your bank through official channels instead', correct: true },
          { text: 'Forward it to friends', correct: false },
          { text: 'Ignore it and delete it', correct: false },
        ],
        explanation: 'Phishing SMS links lead to fake sites. Always verify by contacting your bank through official numbers or the app.',
      },
      {
        question: 'What is "vishing"?',
        options: [
          { text: 'Voice-based phishing over phone calls', correct: true },
          { text: 'A type of insurance', correct: false },
          { text: 'A banking app', correct: false },
          { text: 'A savings scheme', correct: false },
        ],
        explanation: 'Vishing (voice phishing) is fraud where scammers call you pretending to be from a bank or authority to steal information.',
      },
      {
        question: 'If you suspect fraud on your account, the first step is to:',
        options: [
          { text: 'Wait and see if it resolves', correct: false },
          { text: 'Block your card / freeze the account and report to the bank immediately', correct: true },
          { text: 'Post about it on social media', correct: false },
          { text: 'Call the fraudster back', correct: false },
        ],
        explanation: 'Act immediately — block cards, freeze accounts, and report to your bank and cyber crime helpline (1930) to limit damage.',
      },
    ],
  },
];

const GLOSSARY: { term: string; definition: string }[] = [
  { term: 'EMI', definition: 'Equated Monthly Instalment — a fixed monthly payment to repay a loan over a set period, consisting of principal and interest.' },
  { term: 'CIBIL Score', definition: 'A 3-digit credit score (300-900) that reflects your creditworthiness based on repayment history. Higher scores improve loan approval chances.' },
  { term: 'NAV', definition: 'Net Asset Value — the per-unit price of a mutual fund, calculated as total assets minus liabilities divided by units outstanding.' },
  { term: 'Inflation', definition: 'The general rise in prices over time, which reduces purchasing power. Investments should ideally beat inflation.' },
  { term: 'Liquidity', definition: 'How easily an asset can be converted to cash without losing value. Savings accounts are liquid; real estate is not.' },
  { term: 'Compound Interest', definition: 'Interest calculated on both the principal and accumulated interest, causing wealth to grow faster over time.' },
  { term: 'Diversification', definition: 'Spreading investments across different assets to reduce risk — don\'t put all your eggs in one basket.' },
  { term: 'Tax Deduction', definition: 'An amount that reduces your taxable income, lowering the tax you owe. Examples include 80C and 80D deductions.' },
  { term: 'Nominee', definition: 'A person designated to receive the proceeds of an account, insurance policy, or investment in case of the holder\'s death.' },
  { term: 'Phishing', definition: 'A fraudulent attempt to obtain sensitive information (passwords, OTPs) by disguising as a trustworthy entity via email, SMS, or calls.' },
];

export function Learning() {
  const { profile } = useAuth();
  const [progress, setProgress] = useState<Record<string, LearningProgress>>({});
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('profile_id', profile.id);
      const map: Record<string, LearningProgress> = {};
      for (const row of (data as LearningProgress[]) ?? []) {
        map[row.module_key] = row;
      }
      setProgress(map);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const refresh = () => setRefreshKey((k) => k + 1);

  const completedCount = Object.values(progress).filter((p) => p.status === 'completed').length;
  const earnedBadges = Object.values(progress).filter((p) => p.badges.length > 0).flatMap((p) => p.badges);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Learning</h1>
        <p className="text-sm text-ink-500 mt-1">Financial literacy modules, quizzes, and a glossary</p>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-rose-600 to-rose-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <GraduationCap className="h-5 w-5 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Completed</span>
          </div>
          <p className="text-3xl font-bold">{completedCount}/{MODULES.length}</p>
          <p className="text-sm opacity-80 mt-1">Modules finished</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Award className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">Badges</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{earnedBadges.length}</p>
          <p className="text-sm text-ink-500 mt-1">Achievements earned</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">
            {Object.values(progress).filter((p) => p.status === 'in_progress').length}
          </p>
          <p className="text-sm text-ink-500 mt-1">Modules started</p>
        </div>
      </div>

      {/* Badges earned */}
      {earnedBadges.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-800 mb-2 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" /> Earned Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            {earnedBadges.map((badge, i) => (
              <span key={i} className="badge bg-amber-50 text-amber-700 border border-amber-200">
                <Award className="h-3 w-3" /> {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <h2 className="text-lg font-semibold text-ink-800 mb-3">Learning Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const prog = progress[mod.key];
            const isCompleted = prog?.status === 'completed';
            const isInProgress = prog?.status === 'in_progress';
            const Icon = mod.icon;
            return (
              <div key={mod.key} className="card-hover p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-10 w-10 rounded-lg ${mod.color} flex items-center justify-center text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-success-500" />
                  ) : isInProgress ? (
                    <Circle className="h-5 w-5 text-warning-400 fill-warning-100" />
                  ) : (
                    <Circle className="h-5 w-5 text-ink-200" />
                  )}
                </div>
                <h3 className="font-semibold text-ink-900">{mod.title}</h3>
                <p className="text-sm text-ink-500 mt-1 flex-1">{mod.description}</p>
                {prog && (
                  <p className="text-xs text-ink-400 mt-2">
                    Score: {prog.score}/{mod.quiz.length} · {prog.status.replace(/_/g, ' ')}
                  </p>
                )}
                <button
                  onClick={() => setActiveModule(mod)}
                  className="btn-secondary w-full mt-3 !py-1.5 text-xs"
                >
                  {isCompleted ? 'Retake Quiz' : isInProgress ? 'Continue' : 'Start'} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Glossary */}
      <div className="card">
        <button
          onClick={() => setShowGlossary(!showGlossary)}
          className="w-full flex items-center justify-between p-4 hover:bg-ink-50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-ink-800 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Financial Glossary
          </h2>
          {showGlossary ? <ChevronDown className="h-5 w-5 text-ink-400" /> : <ChevronRight className="h-5 w-5 text-ink-400" />}
        </button>
        {showGlossary && (
          <div className="border-t border-ink-100 divide-y divide-ink-100">
            {GLOSSARY.map((entry) => (
              <div key={entry.term} className="px-4 py-3">
                <p className="text-sm font-medium text-ink-800">{entry.term}</p>
                <p className="text-sm text-ink-500 mt-0.5">{entry.definition}</p>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center gap-2">
              <VerifyBadge label="Educational content is simplified for the demo" />
            </div>
          </div>
        )}
      </div>

      {activeModule && (
        <QuizModal
          module={activeModule}
          profileId={profile.id}
          existingProgress={progress[activeModule.key]}
          onClose={() => setActiveModule(null)}
          onDone={() => { setActiveModule(null); refresh(); }}
        />
      )}

      {loading && <div className="text-center text-ink-400 text-sm"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading progress...</div>}
    </div>
  );
}

function QuizModal({ module, profileId, existingProgress, onClose, onDone }: {
  module: Module;
  profileId: string;
  existingProgress?: LearningProgress;
  onClose: () => void;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const score = module.quiz.reduce((s, q, i) => s + (answers[i] !== undefined && q.options[answers[i]].correct ? 1 : 0), 0);
  const allAnswered = module.quiz.every((_, i) => answers[i] !== undefined);
  const passed = score >= Math.ceil(module.quiz.length * 0.6);

  async function handleSubmit() {
    setLoading(true);
    const status: LearningProgress['status'] = passed ? 'completed' : 'in_progress';
    const badges = passed ? [module.badge] : existingProgress?.badges ?? [];

    await supabase.from('learning_progress').upsert({
      profile_id: profileId,
      module_key: module.key,
      status,
      score,
      badges,
      updated_at: new Date().toISOString(),
    });

    setLoading(false);
    setSubmitted(true);
  }

  const Icon = module.icon;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg ${module.color} flex items-center justify-center text-white`}>
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-ink-900">{module.title}</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <p className="text-sm text-ink-500">{module.description}</p>

        {!submitted ? (
          <div className="space-y-5">
            {module.quiz.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium text-ink-800 mb-2">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        answers[qi] === oi
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 text-ink-700 hover:border-ink-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={answers[qi] === oi}
                        onChange={() => setAnswers({ ...answers, [qi]: oi })}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <span>{opt.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || loading}
              className="btn-primary w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Submit Quiz</>}
            </button>
            {!allAnswered && <p className="text-xs text-ink-400 text-center">Answer all questions to submit</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-lg px-4 py-3 text-center ${passed ? 'bg-success-50 border border-success-500/30' : 'bg-warning-50 border border-warning-500/30'}`}>
              <p className={`text-2xl font-bold ${passed ? 'text-success-700' : 'text-warning-700'}`}>
                {score}/{module.quiz.length}
              </p>
              <p className={`text-sm ${passed ? 'text-success-600' : 'text-warning-600'}`}>
                {passed ? '🎉 You passed!' : 'Keep learning — you need 60% to pass'}
              </p>
            </div>

            {passed && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">Badge earned: {module.badge}</span>
              </div>
            )}

            <div className="space-y-3">
              {module.quiz.map((q, qi) => {
                const chosen = answers[qi];
                const correct = chosen !== undefined && q.options[chosen].correct;
                return (
                  <div key={qi} className="rounded-lg border border-ink-200 p-3">
                    <p className="text-sm font-medium text-ink-800">{qi + 1}. {q.question}</p>
                    <p className={`text-sm mt-1 ${correct ? 'text-success-600' : 'text-error-600'}`}>
                      {correct ? '✓ Correct' : `✗ Correct answer: ${q.options.find((o) => o.correct)?.text}`}
                    </p>
                    <p className="text-xs text-ink-500 mt-1 italic">{q.explanation}</p>
                  </div>
                );
              })}
            </div>

            <button onClick={onDone} className="btn-primary w-full">
              <CheckCircle2 className="h-4 w-4" /> Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
