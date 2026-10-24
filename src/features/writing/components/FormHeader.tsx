import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { tabClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { writingQuery, type WritingForm } from '../api';
import { FORM_TYPES, type FormType } from '../formSpec';
import type { useDraft } from '../useDraft';
import { useFormText } from '../useFormText';

type Draft = ReturnType<typeof useDraft>;

/**
 * Top of every writing form: back to documents, the form's title, the autosave status, and tabs
 * to the contract's other writing forms and the writing ticket.
 */
export function FormHeader({
  type,
  form,
  draft,
}: {
  type: FormType;
  form: WritingForm;
  draft: Draft;
}) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  return (
    <div className="flex flex-col gap-4">
      <BackLink to="/documents">{t('back')}</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[26px] leading-snug font-bold lg:text-[34px]">
            {text('title')}
          </h1>
          <p className="m-0 max-w-[64ch] text-[15px] leading-8 text-text-2 lg:text-base">
            {text('subtitle')}
          </p>
        </div>
        {!form.is_final && <SaveStatus type={type} draft={draft} />}
      </div>
      <nav
        aria-label={t('tabs.label')}
        className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
      >
        {FORM_TYPES.filter((order) => form.orders.includes(order)).map((order) => (
          <NavLink
            key={order}
            to={`/documents/${order}`}
            className={({ isActive }) => tabClass(isActive)}
          >
            {t(`tabs.${order}`)}
          </NavLink>
        ))}
        <Link to="/tickets" className={tabClass(false)}>
          {t('tabs.ticket')}
        </Link>
      </nav>
    </div>
  );
}

/** "Saving…", "Saved · 2 minutes ago", or a failed save with a retry. */
function SaveStatus({ type, draft }: { type: FormType; draft: Draft }) {
  const { t } = useTranslation('writing');
  const f = useFormat();
  const { data } = useSuspenseQuery(writingQuery(type));
  const savedAt = data?.updated_at;

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-text-2">
      {draft.failed ? (
        <>
          <Icon name="alert" size={18} className="text-danger" />
          <span className="text-danger">{t('save.failed')}</span>
          <button
            type="button"
            onClick={draft.saveNow}
            className="-my-3 min-h-11 font-medium text-primary-text"
          >
            {t('save.retry')}
          </button>
        </>
      ) : draft.saving ? (
        t('save.saving')
      ) : draft.dirty ? (
        t('save.unsaved')
      ) : (
        savedAt && (
          <>
            <Icon name="check" size={18} className="text-good" />
            {t('save.saved', { time: f.timeAgo(savedAt) })}
          </>
        )
      )}
    </span>
  );
}
