import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { parseValue, toValue } from '@/lib/calendar';
import { toast } from '@/lib/toast';
import { VISA_STATUSES, useSaveVisaResult, type ServiceVisaResult, type VisaStatus } from '../api';

/** What each status needs (Django's VisaResult rules, checked again there). */
const NO_APPOINTMENT: readonly VisaStatus[] = ['getting_appointment'];
const RESOLVED: readonly VisaStatus[] = [
  'granted',
  'refused',
  'missed_appointment',
  'canceled_appointment',
];

type Errors = Partial<
  Record<'title' | 'appointment_at' | 'resolved_at' | 'appointment_proof', string | undefined>
>;

const asValue = (iso: string | null, time: boolean) => (iso ? toValue(new Date(iso), time) : '');
const asIso = (value: string) => parseValue(value)?.toISOString() ?? null;

/**
 * Records a visa result for a visa service (the same rows the old site records), or changes one.
 * The service's stage follows it. `result` null: a new one.
 */
export function VisaResultForm({
  caseId,
  service,
  countries,
  result,
  onDone,
}: {
  caseId: number;
  service: number;
  countries: { id: number; name: string }[];
  result: ServiceVisaResult | null;
  onDone: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const save = useSaveVisaResult(caseId, service);
  const proofId = useId();
  const [title, setTitle] = useState(result?.title ?? t('services.visa.form.defaultTitle'));
  const [status, setStatus] = useState<VisaStatus>(result?.status ?? 'getting_appointment');
  const [embassy, setEmbassy] = useState(String(result?.embassy_id ?? countries[0]?.id ?? ''));
  const [appointment, setAppointment] = useState(asValue(result?.appointment_at ?? null, true));
  const [resolved, setResolved] = useState(asValue(result?.resolved_at ?? null, false));
  const [note, setNote] = useState(result?.note ?? '');
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const needsAppointment = !NO_APPOINTMENT.includes(status) && status !== 'canceled_appointment';

  const submit = () => {
    const found: Errors = {};
    if (!title.trim()) found.title = t('services.visa.form.titleRequired');
    if (needsAppointment && !appointment)
      found.appointment_at = t('services.visa.form.appointmentRequired');
    if ((needsAppointment || appointment) && !proof && !result?.proof)
      found.appointment_proof = t('services.visa.form.proofRequired');
    if (RESOLVED.includes(status) && !resolved)
      found.resolved_at = t('services.visa.form.resolvedRequired');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        id: result?.id ?? null,
        input: {
          title: title.trim(),
          status,
          embassy: Number(embassy),
          appointment_at: NO_APPOINTMENT.includes(status) ? null : asIso(appointment),
          resolved_at: RESOLVED.includes(status) ? asIso(resolved) : null,
          note,
          appointment_proof: proof,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t('services.visa.form.done', { status: t(`services.visa.status.${status}`) }),
          );
          onDone();
        },
        onError: (error) => {
          // The server's own check, per field.
          if (
            error instanceof ApiError &&
            error.status === 400 &&
            error.body &&
            typeof error.body === 'object'
          ) {
            const body = error.body as Record<string, string[] | undefined>;
            setErrors({
              appointment_at: body['appointment_at']?.[0],
              resolved_at: body['resolved_at']?.[0],
              appointment_proof: body['appointment_proof']?.[0],
              title: body['title']?.[0],
            });
            return;
          }
          toast.error(t('saveError'));
        },
      },
    );
  };

  return (
    <section
      aria-label={t(result ? 'services.visa.form.editTitle' : 'services.visa.form.newTitle')}
      className="flex flex-col gap-4 rounded-2xl bg-canvas p-4"
    >
      <TextField
        label={t('services.visa.form.title')}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
      />
      <SelectField
        label={t('services.visa.form.status')}
        value={status}
        onChange={setStatus}
        options={VISA_STATUSES.map((value) => ({
          value,
          label: t(`services.visa.status.${value}`),
        }))}
      />
      <SelectField
        label={t('services.visa.form.embassy')}
        value={embassy}
        onChange={setEmbassy}
        options={countries.map((country) => ({ value: String(country.id), label: country.name }))}
      />
      {!NO_APPOINTMENT.includes(status) && (
        <LazyDatePicker
          time
          clearable
          label={t('services.visa.form.appointment')}
          value={appointment}
          onChange={setAppointment}
          error={errors.appointment_at}
        />
      )}
      {!NO_APPOINTMENT.includes(status) && (
        <div className="flex flex-col gap-2">
          <label htmlFor={proofId} className="text-[15px] font-medium">
            {t('services.visa.form.proof')}
          </label>
          <input
            id={proofId}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            aria-describedby={errors.appointment_proof ? `${proofId}-error` : undefined}
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
            className="min-h-11 text-sm"
          />
          {result?.proof && !proof && (
            <span className="text-sm text-text-2">{t('services.visa.form.proofKept')}</span>
          )}
          {errors.appointment_proof && (
            <span id={`${proofId}-error`} className="text-sm text-danger">
              {errors.appointment_proof}
            </span>
          )}
        </div>
      )}
      {RESOLVED.includes(status) && (
        <LazyDatePicker
          label={t('services.visa.form.resolved')}
          value={resolved}
          onChange={setResolved}
          error={errors.resolved_at}
        />
      )}
      <TextAreaField
        label={t('services.visa.form.note')}
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={submit}>
          {t(result ? 'services.visa.form.saveEdit' : 'services.visa.form.saveNew')}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t('services.dialog.cancel')}
        </Button>
      </div>
    </section>
  );
}
