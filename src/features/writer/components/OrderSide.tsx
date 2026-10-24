import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { OrderData } from '../api';
import { orderPath } from '../paths';

/** Beside the order: the program's rules, the case's files, the latest messages. */
export function OrderSide({ order }: { order: OrderData }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const programLink = safeHref(order.program_url);
  return (
    <>
      <SectionCard variant="panel" id="writer-requirements" title={t('side.requirements')}>
        {order.requirements.length === 0 ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('side.noRequirements')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {order.requirements.map((rule) => (
              <li key={rule} className="flex gap-2.5 text-sm leading-7">
                <span
                  aria-hidden="true"
                  className="mt-[11px] size-1.5 flex-none rounded-full bg-primary"
                />
                {rule}
              </li>
            ))}
          </ul>
        )}
        {programLink && (
          <a
            href={programLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium"
          >
            {t('side.programPage')}
          </a>
        )}
      </SectionCard>

      <SectionCard variant="panel" id="writer-documents" title={t('side.documents')}>
        {order.documents.length === 0 ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('side.noDocuments')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {order.documents.map((document) => (
              <li key={document.url}>
                <a
                  href={safeHref(document.url)}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-11 items-center text-[15px] font-medium"
                >
                  {document.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard variant="panel" id="writer-messages" title={t('side.messages')}>
        {order.messages.length === 0 ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('side.noMessages')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {order.messages.map((message) => (
              <li
                key={message.id}
                className={`flex flex-col gap-1 rounded-2xl px-4 py-3 ${message.mine ? 'bg-tint' : 'bg-canvas'}`}
              >
                <span className="text-xs text-text-2">
                  {t('side.messageBy', {
                    name: message.mine ? t('side.you') : message.author,
                    time: f.timeAgo(message.at),
                  })}
                </span>
                <span className="text-sm leading-7">{message.text}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to={orderPath(order.id, 'tickets')} className="text-sm font-medium">
          {t('side.toChat')}
        </Link>
      </SectionCard>
    </>
  );
}
