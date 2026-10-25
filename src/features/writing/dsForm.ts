import type { FormSpec } from './formSpec';

/**
 * Diversity statement form: Django's DiversityStatement (user_profile/writing/models.py), the old
 * site's four questions. The canvas has no design of its own for it: the SOP form's layout
 * (canvas V8 note).
 */
export const dsForm: FormSpec = {
  type: 'ds',
  progress: 'questions',
  aside: { tips: 3, phone: true },
  sections: [
    {
      id: 'experience',
      parts: [
        { kind: 'textarea', name: 'interaction_experience', required: true },
        { kind: 'textarea', name: 'discrimination_experience' },
      ],
    },
    {
      id: 'identity',
      parts: [
        {
          kind: 'choice',
          name: 'is_minority',
          required: true,
          wide: true,
          options: { set: 'minority', values: [false, true] },
        },
        { kind: 'textarea', name: 'diversity_of_religious_beliefs', required: true },
      ],
    },
  ],
};
