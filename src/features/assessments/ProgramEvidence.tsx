import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { api } from '@/lib/api/client';
import type { Question } from './api';

type Report = {
  id: string;
  revision: number;
  kind: string;
  confirmed_at: string | null;
  value: { test?: string; date?: string; scores?: Record<string, number | null> } | null;
};
export function ProgramEvidence({
  binding,
  disabled,
  onSelect,
}: {
  binding: NonNullable<Question['shared_binding']>;
  disabled: boolean;
  onSelect: (reference: { id: string; revision: number }, selector: string, value: number) => void;
}) {
  const { t } = useTranslation('assessments');
  const query = useQuery({
    queryKey: ['shared-assessment-evidence'],
    queryFn: () => api<{ evidence: Report[] }>('/applicant/v1/assessments/shared-evidence/'),
  });
  const [reportId, setReportId] = useState('');
  const [skill, setSkill] = useState('');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const choices = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const reports = (query.data?.evidence ?? []).filter(
    (item) => item.kind === binding.kind && item.confirmed_at && item.value?.test === binding.test,
  );
  const report = reports.find((item) => item.id === reportId);
  const score = report?.value?.scores?.[skill];
  return (
    <div className="flex flex-col gap-2">
      <p>{t('sharedFacts.programExplanation')}</p>
      <SelectField
        label={t('sharedFacts.programReport')}
        value={reportId}
        disabled={disabled}
        options={[
          { value: '', label: t('calculator.choose') },
          ...reports.map((item) => ({
            value: item.id,
            label: `${choices[item.value?.test ?? ''] ?? t('calculator.unknown')} — ${item.value?.date ?? t('calculator.unknown')}`,
          })),
        ]}
        onChange={(value) => {
          setReportId(value);
          setSkill('');
        }}
      />
      <SelectField
        label={t('sharedFacts.programSkill')}
        value={skill}
        disabled={disabled || !report}
        options={[
          { value: '', label: t('calculator.choose') },
          ...[binding.skill].map((value) => ({
            value,
            label: labels[value] ?? t('calculator.unknown'),
          })),
        ]}
        onChange={setSkill}
      />
      <Button
        variant="outline"
        disabled={
          disabled ||
          !report ||
          skill !== binding.skill ||
          typeof score !== 'number' ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > 9 ||
          (score * 2) % 1 !== 0
        }
        onClick={() => {
          if (report && typeof score === 'number')
            onSelect({ id: report.id, revision: report.revision }, skill, score);
        }}
      >
        {t('sharedFacts.programUse')}
      </Button>
    </div>
  );
}
