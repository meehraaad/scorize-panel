import type { FieldSpec, FormSpec } from './formSpec';

const text = (name: string, maxLength: number, ltr = false): FieldSpec => ({
  kind: 'text',
  name,
  maxLength,
  required: true,
  ...(ltr ? { ltr } : {}),
});

/**
 * Recommendation letters form: one entry per recommender, up to the number of letters in the
 * contract (`count` of the form). The writer writes each letter in the recommender's voice.
 * Django's Recommendation rows (H50: `full_name`, `organization`, `courses` are its `name`,
 * `university`, `course_or_project`). Design: canvas V8 "فرم اطلاعات توصیه‌نامه" (AppRecForm).
 */
export const recommendationForm: FormSpec = {
  type: 'recommendation',
  progress: 'sections',
  aside: { tips: 3, ticket: true },
  sections: [
    {
      id: 'recommenders',
      parts: [
        {
          kind: 'list',
          name: 'recommenders',
          required: true,
          title: 'full_name',
          subtitle: ['kind'],
          fields: [
            {
              kind: 'choice',
              name: 'kind',
              required: true,
              wide: true,
              options: { set: 'kind', values: ['academic', 'work'] },
            },
            text('full_name', 100),
            text('name_en', 100, true),
            text('position', 150),
            text('organization', 150),
            { kind: 'email', name: 'email', required: true, maxLength: 254, ltr: true },
            text('relationship', 200),
            {
              kind: 'textarea',
              name: 'courses',
              required: true,
              when: { name: 'kind', value: 'academic' },
            },
            { kind: 'textarea', name: 'work', required: true },
            { kind: 'textarea', name: 'qualities', required: true },
            {
              kind: 'choice',
              name: 'delivery',
              required: true,
              wide: true,
              layout: 'stack',
              options: { set: 'delivery', values: ['self_upload', 'sign_only'] },
            },
          ],
        },
      ],
    },
  ],
};
