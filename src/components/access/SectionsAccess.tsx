import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TogglePill } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useUser } from '@/lib/auth/session';
import { toast } from '@/lib/toast';
import { sectionsQuery, WRITE_SECTION, type AccessPerson } from '@/lib/access/api';
import { useSaveSections } from '@/lib/access/people';

const same = (a: ReadonlySet<string>, b: readonly string[]) =>
  a.size === b.length && b.every((item) => a.has(item));

/**
 * One person's access in plain sections: what their team gives them (a box, nothing to change),
 * then the 14 sections as switches under four headings; the writing section opens its kinds of
 * document. The board (superusers) has everything and nothing to switch. HR (not a superuser)
 * can't switch a protected section, their own or a superuser's: the API refuses the same. Used by
 * the access pages' dialog and the staff file's access tab, like `usePersonAccess`.
 */
export function useSectionsAccess(person: AccessPerson, onSaved?: () => void) {
  const { t } = useTranslation('access');
  const list = useQuery(sectionsQuery);
  const save = useSaveSections(person.id);
  const me = useUser();
  const limited = !me.is_superuser;
  const editable = person.editable !== false && !person.is_superuser;
  const [on, setOn] = useState(() => new Set(person.sections ?? []));
  const [docs, setDocs] = useState(() => new Set(person.writing ?? []));

  const writeOn = on.has(WRITE_SECTION);
  const changed =
    editable &&
    (!same(on, person.sections ?? []) || !same(docs, writeOn ? (person.writing ?? []) : []));
  const missingKinds = writeOn && docs.size === 0;

  const toggle = (id: string, value: boolean) => {
    const next = new Set(on);
    if (value) next.add(id);
    else next.delete(id);
    setOn(next);
    // Writing switched on starts with every kind; the person's own kinds when they had some.
    if (id === WRITE_SECTION && value && docs.size === 0) {
      const write = list.data?.sections.find((section) => section.id === WRITE_SECTION);
      setDocs(new Set(write?.options.map((option) => option.id) ?? []));
    }
    if (id === WRITE_SECTION && !value) setDocs(new Set());
  };

  const submit = () =>
    save.mutate(
      { sections: [...on], writing: writeOn ? [...docs] : [] },
      {
        onSuccess: () => {
          toast.success(t('person.saved', { name: person.name }));
          onSaved?.();
        },
        onError: () => toast.error(t('saveError')),
      },
    );

  const fields = (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-2xl bg-canvas px-4 py-3.5">
        <Icon name="check" size={18} className="mt-0.5 flex-none text-good" />
        <span className="flex flex-col gap-0.5">
          <span className="text-label text-text-2">{t('sections.fromTeam')}</span>
          <span className="text-body font-medium">
            {person.is_superuser ? t('sections.boardBase') : (person.base ?? t('sections.noTeam'))}
          </span>
        </span>
      </div>
      {person.is_superuser ? (
        <p className="m-0 text-body leading-7 text-text-2">{t('sections.board')}</p>
      ) : !list.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          {person.editable === false && (
            <p className="m-0 text-body leading-7">{t('person.lockedForYou')}</p>
          )}
          {list.data.areas.map((area) => (
            <section key={area.id} className="flex flex-col" aria-label={area.label}>
              <h3 className="m-0 pb-1 text-label font-semibold text-text-2">{area.label}</h3>
              <div className="flex flex-col divide-y divide-[var(--hair)]">
                {list.data.sections
                  .filter((section) => section.area === area.id)
                  .map((section) => {
                    const locked = !editable || (limited && section.protected);
                    return (
                      <div key={section.id}>
                        <Switch
                          label={section.label}
                          description={
                            limited && section.protected
                              ? `${section.about} ${t('sections.superusersOnly')}`
                              : section.about
                          }
                          checked={on.has(section.id)}
                          disabled={locked}
                          onChange={(value) => toggle(section.id, value)}
                        />
                        {section.options.length > 0 && on.has(section.id) && (
                          <div
                            className="flex flex-wrap gap-2 pb-3"
                            role="group"
                            aria-label={t('sections.kinds')}
                          >
                            {section.options.map((option) => (
                              <TogglePill
                                key={option.id}
                                label={option.label}
                                checked={docs.has(option.id)}
                                disabled={locked}
                                onChange={(value) => {
                                  const next = new Set(docs);
                                  if (value) next.add(option.id);
                                  else next.delete(option.id);
                                  setDocs(next);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
          {missingKinds && (
            <p className="m-0 text-label text-danger" role="alert">
              {t('sections.pickKinds')}
            </p>
          )}
        </>
      )}
    </div>
  );
  return {
    fields,
    canSave: editable,
    changed: changed && !missingKinds,
    pending: save.isPending,
    submit,
  };
}
