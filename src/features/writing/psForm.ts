import type { FormSpec } from './formSpec';

/**
 * Personal statement form: Django's PersonalStatement (user_profile/writing/models.py), the old
 * site's three questions. The canvas has no design of its own for it: the SOP form's layout
 * (canvas V8 note).
 */
export const psForm: FormSpec = {
  type: 'ps',
  progress: 'questions',
  aside: { tips: 3, phone: true },
  sections: [
    {
      id: 'background',
      parts: [{ kind: 'textarea', name: 'personal_mentality', required: true }],
    },
    {
      id: 'character',
      parts: [
        { kind: 'textarea', name: 'descriptive_character', required: true },
        { kind: 'textarea', name: 'educational_problems', required: true },
      ],
    },
  ],
};
