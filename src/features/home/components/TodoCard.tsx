import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { useApproveApplication } from '@/lib/applicant/approval';
import type { ApplicationSummary, Todo } from '../api';
import { daysUntil } from '@/lib/dates';
import { SectionCard } from '@/components/ui/SectionCard';

/** An upload due this soon is shown in the urgent colour. */
const URGENT_DAYS = 7;

const KINDS: Record<Todo['kind'], { icon: IconName; tone: string }> = {
  approve: { icon: 'graduation', tone: 'bg-tint text-primary-text' },
  upload: { icon: 'upload', tone: 'bg-warn-tint text-warn' },
  form: { icon: 'pen', tone: 'bg-neutral-tint text-text' },
  pay: { icon: 'card', tone: 'bg-good-tint text-good' },
};

export function TodoCard({ todos }: { todos: Todo[] }) {
  const { t } = useTranslation('home');
  const f = useFormat();

  return (
    <SectionCard
      id="home-todos"
      title={t('todos.title')}
      end={
        todos.length > 0 && (
          <span className="text-sm text-text-2">
            {t('todos.count', { n: f.number(todos.length) })}
          </span>
        )
      }
    >
      {todos.length === 0 ? (
        <EmptyState title={t('todos.emptyTitle')}>{t('todos.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none divide-y divide-hair p-0">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4 lg:px-8 lg:py-5"
            >
              <span
                className={`flex size-11 flex-none items-center justify-center rounded-icon ${KINDS[todo.kind].tone}`}
              >
                <Icon name={KINDS[todo.kind].icon} />
              </span>
              <TodoBody todo={todo} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function TodoBody({ todo }: { todo: Todo }) {
  const { t } = useTranslation('home');
  const f = useFormat();

  switch (todo.kind) {
    case 'approve':
      return <ApproveTodo application={todo.application} />;
    case 'upload': {
      const days = todo.due_date === null ? null : daysUntil(todo.due_date);
      const urgent = days !== null && days <= URGENT_DAYS;
      return (
        <Row
          title={t('todos.upload.title', { document: todo.document })}
          meta={
            todo.due_date &&
            [
              t('todos.upload.meta', { date: f.dateShort(todo.due_date) }),
              urgent && t('todos.upload.urgent', { days: f.number(days) }),
            ]
              .filter(Boolean)
              .join(' · ')
          }
          urgent={urgent}
          action={
            <Link to="/documents" className={buttonClass('primary')}>
              {t('todos.upload.action')}
            </Link>
          }
        />
      );
    }
    case 'form': {
      const writing = t(`writingType.${todo.writing}`);
      return (
        <Row
          title={t('todos.form.title', { writing })}
          meta={t('todos.form.meta', { writing })}
          action={
            <Link to={`/documents/${todo.writing}`} className={buttonClass('outline')}>
              {t('todos.form.action')}
            </Link>
          }
        />
      );
    }
    case 'pay':
      return (
        <Row
          title={t('todos.pay.title', { number: f.number(todo.installment) })}
          meta={t('todos.pay.meta')}
          action={
            <Link to="/contract" className={buttonClass('primary')}>
              {t('todos.pay.action')}
            </Link>
          }
        />
      );
  }
}

function Row({
  title,
  meta,
  urgent = false,
  action,
}: {
  title: string;
  meta?: string | null;
  urgent?: boolean;
  action: ReactNode;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <span className="text-base leading-relaxed font-semibold">{title}</span>
        {meta && (
          <span className={`text-sm leading-7 ${urgent ? 'text-urgent' : 'text-text-2'}`}>
            {meta}
          </span>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{action}</div>
    </>
  );
}

/** Approve or reject an application the team prepared. Rejecting asks once, inline. */
function ApproveTodo({ application }: { application: ApplicationSummary }) {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const approve = useApproveApplication();
  const [confirming, setConfirming] = useState(false);
  const { university } = application;

  const meta = [
    `${tc(`degree.${application.degree}`)} ${application.program}`,
    application.deadline && t('todos.deadline', { date: f.dateShort(application.deadline) }),
    application.fee &&
      t('todos.fee', { fee: f.moneyName(application.fee.amount, application.fee.currency) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const decide = (approved: boolean) => {
    approve.mutate({ id: application.id, approved });
  };

  return (
    <>
      <Row
        title={t('todos.approve.title', { university })}
        meta={meta}
        action={
          !confirming && (
            <>
              <Button
                variant="danger"
                aria-label={t('todos.approve.rejectAria', { university })}
                disabled={approve.isPending}
                onClick={() => setConfirming(true)}
              >
                {t('todos.approve.reject')}
              </Button>
              <Button
                aria-label={t('todos.approve.acceptAria', { university })}
                disabled={approve.isPending}
                onClick={() => decide(true)}
              >
                {t('todos.approve.accept')}
              </Button>
            </>
          )
        }
      />
      {confirming && (
        <InlineConfirm
          message={t('todos.approve.confirm', { university })}
          confirmLabel={t('todos.approve.confirmYes')}
          cancelLabel={t('todos.approve.confirmNo')}
          pending={approve.isPending}
          onConfirm={() => decide(false)}
          onCancel={() => setConfirming(false)}
        />
      )}
      {approve.isError && (
        <div className="w-full">
          <Notice tone="error">{t('todos.error')}</Notice>
        </div>
      )}
    </>
  );
}
