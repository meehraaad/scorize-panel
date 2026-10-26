import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { DocumentsData } from '../api';

const ROW = 'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] bg-surface px-4 py-3';

/**
 * What only the applicant can do now, above everything else: documents to upload and writing
 * forms to fill. Nothing waiting: not shown. Design: "Scorize New User Dashboard" canvas,
 * Documents.
 */
export function WaitingCard({ data }: { data: DocumentsData }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const forms = (data.writing ?? []).filter((order) => order.step === 'form');
  if (data.required.length === 0 && forms.length === 0) return null;

  return (
    <section
      aria-labelledby="docs-waiting"
      className="flex flex-col gap-3 rounded-[24px] bg-tint p-5 lg:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="docs-waiting" className="m-0 font-display text-xl font-bold">
          {t('waiting.title')}
        </h2>
        <p className="m-0 text-sm text-text-2">{t('waiting.subtitle')}</p>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
        {data.required.length > 0 && (
          <li className={ROW}>
            <Icon name="upload" className="text-primary-text" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold">
              {t('waiting.upload', { n: f.number(data.required.length) })}
            </span>
            <a href="#docs-required" className={buttonClass('primary', 'max-sm:w-full')}>
              {t('waiting.uploadAction')}
            </a>
          </li>
        )}
        {forms.map((order) => (
          <li key={order.type} className={ROW}>
            <Icon name="pen" className="text-primary-text" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold">
              {t('waiting.form', { name: t(`writing.name.${order.type}`) })}
            </span>
            <Link
              to={`/documents/${order.type}`}
              className={buttonClass('outline', 'max-sm:w-full')}
            >
              {t('waiting.formAction')}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
