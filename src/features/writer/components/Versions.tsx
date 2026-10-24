import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FileDrop, FileTile, PickedFile } from '@/components/ui/Files';
import { StepDot } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkFile, extensionOf, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { useSendVersion, VERSION_FILE, type OrderData, type OrderVersion } from '../api';

/** The order's versions, oldest first, each with the applicant's revision request; then the next. */
export function Versions({ order }: { order: OrderData }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const delivered = order.state === 'delivered';
  return (
    <SectionCard variant="panel" size="lg" id="writer-versions" title={t('versions.title')}>
      {order.versions.length === 0 && !delivered && (
        <p className="m-0 text-sm leading-7 text-text-2">{t('versions.none')}</p>
      )}
      <ol className="m-0 flex list-none flex-col gap-5 p-0">
        {order.versions.map((version) => (
          <li key={version.id} className="flex gap-3.5">
            <StepDot number={f.number(version.number)} state="done" />
            <Version version={version} />
          </li>
        ))}
        {!delivered && (
          <li className="flex gap-3.5">
            <StepDot number={f.number(order.versions.length + 1)} state="current" />
            <NextVersion order={order} />
          </li>
        )}
      </ol>
    </SectionCard>
  );
}

function Version({ version }: { version: OrderVersion }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 text-base font-bold">
          {version.final
            ? t('versions.final')
            : t('versions.draft', { n: f.number(version.number) })}
        </h3>
        <span className="text-[13px] text-text-2">
          {t(version.final ? 'versions.delivered' : 'versions.sent', {
            date: f.dateShort(version.sent_at),
          })}
        </span>
      </div>
      <FileTile
        ext={extensionOf(version.file.name)}
        name={version.file.name}
        href={version.file.url}
        meta={
          version.file.words === null
            ? t('versions.open')
            : t('versions.words', { n: f.number(version.file.words) })
        }
      />
      {version.note && <p className="m-0 text-sm leading-7 text-text-2">{version.note}</p>}
      {version.revision && (
        <div className="flex flex-col gap-2 rounded-[18px] bg-warn-tint px-4 py-3.5 text-text">
          <span className="text-sm font-semibold text-warn">
            {t('versions.revision', { date: f.dateShort(version.revision.requested_at) })}
          </span>
          <ol className="m-0 flex flex-col gap-1.5 ps-5 text-sm leading-7">
            {version.revision.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Upload the next draft (to the applicant) or the final file (to the case's documents). */
function NextVersion({ order }: { order: OrderData }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const send = useSendVersion(order.id);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<FileProblem | 'missing' | null>(null);
  const [note, setNote] = useState('');
  const number = order.versions.length + 1;

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    const issue = checkFile(picked, VERSION_FILE);
    setProblem(issue);
    setFile(issue ? null : picked);
  };
  const submit = (final: boolean) => {
    if (!file) {
      setProblem('missing');
      return;
    }
    upload(file, note.trim(), final);
  };
  const upload = (picked: File, text: string, final: boolean) =>
    send.mutate(
      {
        file: picked,
        note: text,
        final,
        messages: {
          done: t(`versions.done.${final ? 'final' : 'draft'}`),
          failed: t('versions.error'),
          retry: () => upload(picked, text, final),
        },
      },
      {
        onSuccess: () => {
          setFile(null);
          setNote('');
        },
      },
    );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="flex min-w-0 flex-1 flex-col gap-3.5"
    >
      <h3 className="m-0 text-base font-bold">
        {order.state === 'revision'
          ? t('versions.revised')
          : t('versions.draft', { n: f.number(number) })}
      </h3>
      {file ? (
        <PickedFile
          ext={extensionOf(file.name)}
          name={file.name}
          meta={t('versions.size', { n: f.number(Math.max(1, Math.round(file.size / 1024))) })}
          removeLabel={t('versions.remove')}
          disabled={send.isPending}
          onRemove={() => setFile(null)}
        />
      ) : (
        <FileDrop
          id="writer-version-file"
          accept={VERSION_FILE.types}
          errorId={problem ? 'writer-version-error' : null}
          chooseLabel={t('versions.choose')}
          inputLabel={t('versions.choose')}
          hint={t('versions.hint')}
          onFile={pick}
        />
      )}
      {problem && (
        <span id="writer-version-error" className="text-[13px] leading-7 text-danger">
          {t(`versions.problem.${problem}`)}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="writer-version-note" className="text-[15px] font-semibold">
          {t('versions.note')}{' '}
          <span className="text-xs font-normal text-text-2">{t('optional')}</span>
        </label>
        <textarea
          id="writer-version-note"
          rows={3}
          value={note}
          placeholder={t('versions.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          className="w-full resize-y rounded-2xl bg-canvas px-4 py-3.5 text-[15px] leading-8 text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-0 placeholder:text-text-2 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={send.isPending}>
          {t('versions.send')}
        </Button>
        <Button
          variant="outline"
          disabled={send.isPending || !order.can_finalize}
          aria-describedby="writer-final-hint"
          onClick={() => submit(true)}
        >
          {t('versions.deliver')}
        </Button>
        <span id="writer-final-hint" className="flex-[1_1_260px] text-[13px] leading-7 text-text-2">
          {t('versions.finalHint')}
        </span>
      </div>
    </form>
  );
}
