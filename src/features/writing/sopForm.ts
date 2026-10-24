import type { FieldSpec, FormSpec } from './formSpec';

/** SOP information form: Django's SopData (user_profile/writing/models.py). */

const text = (name: string, maxLength: number, required = false): FieldSpec => ({
  kind: 'text',
  name,
  maxLength,
  required,
});
const long = (name: string, required = false): FieldSpec => ({ kind: 'textarea', name, required });

export const sopForm: FormSpec = {
  type: 'sop',
  progress: 'questions',
  aside: { tips: 4, phone: true },
  sections: [
    {
      id: 'education',
      parts: [
        {
          kind: 'select',
          name: 'grade',
          required: true,
          // SopData.GradeType
          options: { set: 'grade', values: [1, 2, 3, 4, 5, 6] },
        },
        text('field_of_study', 50, true),
        text('university_1', 50, true),
        text('Rate_1', 50, true),
        text('university_2', 50),
        text('Rate_2', 50),
        text('university_3', 50),
        text('Rate_3', 50),
      ],
    },
    {
      id: 'goal',
      parts: [
        text('field_of_study_for_apply', 50, true),
        text('university_for_apply', 100),
        text('city_for_apply', 100, true),
        {
          kind: 'choice',
          name: 'general_sop',
          required: true,
          wide: true,
          options: { set: 'generalSop', values: [false, true] },
        },
      ],
    },
    {
      id: 'story',
      parts: [
        long('reason', true),
        long('interest', true),
        long('reason_to_continuation', true),
        long('university_reason'),
      ],
    },
    {
      id: 'experience',
      parts: [long('project', true), long('internship'), long('essay'), long('thesis')],
    },
    { id: 'career', parts: [long('job', true)] },
  ],
};
