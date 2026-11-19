import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { GOALS, INTAKE_FIELDS, type IntakeInputs, type IntakeField } from './destinationApi';
const STATES = ['unknown', 'known', 'needs_confirmation', 'not_applicable'] as const;
const TIMELINES = ['flexible', 'under_one_year', 'one_to_two_years'] as const;
export function DestinationFields({
  value,
  onChange,
  countries,
}: {
  value: IntakeInputs;
  onChange: (value: IntakeInputs) => void;
  countries: { code: string; name: string }[];
}) {
  const { t, i18n } = useTranslation('assessments');
  const regions = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const countryName = (code: string) =>
    regions.of(code) ?? countries.find((c) => c.code === code)?.name ?? code;
  const set = (field: IntakeField, next: string | string[] | null) =>
    onChange({ ...value, [field]: { status: 'known', value: next } });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {INTAKE_FIELDS.map((field) => {
        const fact = value[field];
        const selected = Array.isArray(fact?.value) ? fact.value : [];
        return (
          <fieldset key={field} className="border-line min-w-0 rounded-2xl border p-3">
            <legend className="px-2 font-bold">{t(`destinations.fields.${field}`)}</legend>
            <div className="flex flex-col gap-3">
              <SelectField
                label={t('destinations.answerStatus', { field: t(`destinations.fields.${field}`) })}
                value={fact?.status ?? 'unknown'}
                options={STATES.map((status) => ({
                  value: status,
                  label: t(`calculator.choices.${status}`),
                }))}
                onChange={(status) => onChange({ ...value, [field]: { status, value: null } })}
              />
              {fact?.status === 'known' && field === 'goals' && (
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((goal) => (
                    <TogglePill
                      key={goal}
                      label={t(`destinations.goals.${goal}`)}
                      checked={selected.includes(goal)}
                      onChange={(checked) =>
                        set(
                          field,
                          checked ? [...selected, goal] : selected.filter((v) => v !== goal),
                        )
                      }
                    />
                  ))}
                </div>
              )}
              {fact?.status === 'known' &&
                (field === 'destinations' || field === 'citizenships') && (
                  <>
                    <SelectField
                      label={t('destinations.addCountry', {
                        field: t(`destinations.fields.${field}`),
                      })}
                      value=""
                      options={[
                        { value: '', label: t('calculator.choose') },
                        ...countries.map((c) => ({ value: c.code, label: countryName(c.code) })),
                      ]}
                      onChange={(code) => {
                        if (code && !selected.includes(code)) set(field, [...selected, code]);
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      {selected.map((code) => (
                        <Button
                          key={code}
                          variant="outline"
                          aria-label={t('destinations.removeCountry', {
                            country: countryName(code),
                            field: t(`destinations.fields.${field}`),
                          })}
                          onClick={() =>
                            set(
                              field,
                              selected.filter((v) => v !== code),
                            )
                          }
                        >
                          {countryName(code)}
                        </Button>
                      ))}
                    </div>
                    {field === 'destinations' && (
                      <Button variant="outline" onClick={() => set(field, [])}>
                        {t('destinations.openCountries')}
                      </Button>
                    )}
                  </>
                )}
              {fact?.status === 'known' && field === 'residence' && (
                <SelectField
                  label={t('destinations.residenceCountry')}
                  value={typeof fact.value === 'string' ? fact.value : ''}
                  options={[
                    { value: '', label: t('calculator.choose') },
                    ...countries.map((c) => ({ value: c.code, label: countryName(c.code) })),
                  ]}
                  onChange={(code) => set(field, code)}
                />
              )}
              {fact?.status === 'known' && field === 'timeline' && (
                <SelectField
                  label={t('destinations.timelineChoice')}
                  value={typeof fact.value === 'string' ? fact.value : ''}
                  options={[
                    { value: '', label: t('calculator.choose') },
                    ...TIMELINES.map((v) => ({ value: v, label: t(`destinations.timeline.${v}`) })),
                  ]}
                  onChange={(v) => set(field, v)}
                />
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
