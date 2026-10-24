import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import type { BotProblem } from '../api';
import { casePath, type CaseTab } from '../paths';

/** Where each problem is fixed. */
const FIX_TAB: Record<BotProblem['kind'], CaseTab> = {
  few_texts: 'applications',
  no_account: 'applications',
  no_cv: 'documents',
  no_interests: 'documents',
};

/** Why the professor-email bot can't send, each with a link to where it is fixed. */
export function BotProblems({ caseId, problems }: { caseId: number; problems: BotProblem[] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  if (problems.length === 0) return null;
  return (
    <Notice tone="warn">
      <span className="flex flex-col gap-1">
        <span className="font-bold">{t('bot.problems.title')}</span>
        <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5 text-text">
          {problems.map((problem) => (
            <li key={problem.kind}>
              {problem.kind === 'few_texts'
                ? t('bot.problems.few_texts', {
                    have: f.number(problem.have),
                    need: f.number(problem.need),
                  })
                : t(`bot.problems.${problem.kind}`)}{' '}
              <Link
                to={casePath(caseId, FIX_TAB[problem.kind])}
                className="font-semibold text-primary-text underline-offset-4 hover:underline"
              >
                {t(`bot.fix.${problem.kind}`)}
              </Link>
            </li>
          ))}
        </ul>
      </span>
    </Notice>
  );
}
