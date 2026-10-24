import type { FieldSpec, FormSpec, ListSpec } from './formSpec';

/**
 * CV information form: Django's CVData and its related lists (user_profile/writing/models.py).
 * The CV is written in English, so entries are typed left to right.
 */

const en = (name: string, maxLength: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  kind: 'text',
  name,
  maxLength,
  ltr: true,
  ...extra,
});
const month = (name: string, required = false): FieldSpec => ({ kind: 'month', name, required });
const notes = (name: string): FieldSpec => ({ kind: 'textarea', name, ltr: true });

const list = (spec: Omit<ListSpec, 'kind'>): ListSpec => ({ kind: 'list', ...spec });

export const cvForm: FormSpec = {
  type: 'cv',
  progress: 'sections',
  sections: [
    {
      id: 'personal',
      parts: [
        {
          kind: 'choice',
          name: 'template',
          required: true,
          wide: true,
          options: { set: 'template', values: ['na', 'eu'] },
        },
        en('name', 128, { required: true }),
        { kind: 'select', name: 'sex', required: true, options: { set: 'sex', values: [2, 1] } },
        { kind: 'date', name: 'date_of_birth', required: true },
        { kind: 'tel', name: 'phone_number', required: true, maxLength: 14, ltr: true },
        { kind: 'email', name: 'email', required: true, ltr: true },
        en('city', 256, { required: true }),
      ],
    },
    { id: 'photo', parts: [{ kind: 'photo', name: 'pass_photo', required: true }] },
    {
      id: 'education',
      parts: [
        list({
          name: 'educations',
          required: true,
          title: 'name',
          subtitle: ['level', 'study_field', 'gpa'],
          period: ['start_date', 'end_date'],
          fields: [
            // Education.EducationLevel
            {
              kind: 'select',
              name: 'level',
              required: true,
              options: { set: 'level', values: [1, 2, 3, 4, 5] },
            },
            en('name', 128, { required: true }),
            en('study_field', 256, { required: true }),
            { kind: 'number', name: 'gpa' },
            month('start_date'),
            month('end_date'),
            en('city', 128),
            en('thesis_title', 256, { wide: true }),
            en('thesis_supervisor', 128),
          ],
        }),
      ],
    },
    {
      id: 'tests',
      parts: [
        list({
          name: 'english_tests',
          title: 'title',
          subtitle: ['score', 'date_of_receipt'],
          fields: [
            en('title', 64, { required: true }),
            { kind: 'number', name: 'score', required: true },
            month('date_of_receipt', true),
            notes('description'),
          ],
        }),
      ],
    },
    {
      id: 'publications',
      parts: [
        list({
          name: 'publications',
          title: 'title',
          subtitle: ['journal', 'status'],
          fields: [
            en('title', 300, { required: true, wide: true }),
            en('authors', 256, { wide: true }),
            en('journal', 128),
            {
              kind: 'select',
              name: 'status',
              required: true,
              options: { set: 'publicationStatus', values: ['p', 'a', 'ur', 's', 'us', 'up'] },
            },
            month('published_date'),
            en('hyperlink', 256),
            notes('description'),
          ],
        }),
        list({
          name: 'books',
          title: 'title',
          subtitle: ['publication', 'status'],
          fields: [
            en('title', 128, { required: true, wide: true }),
            en('authors', 256),
            {
              kind: 'choice',
              name: 'is_translation',
              required: true,
              options: { set: 'translation', values: [false, true] },
            },
            en('translators', 256),
            en('publication', 256),
            {
              kind: 'select',
              name: 'status',
              required: true,
              options: { set: 'bookStatus', values: ['p', 'b', 'up'] },
            },
            month('publication_date'),
            en('isbn', 16),
          ],
        }),
      ],
    },
    {
      id: 'work',
      parts: [
        list({
          name: 'work_experiences',
          title: 'position',
          subtitle: ['place', 'city'],
          period: ['start_date', 'end_date'],
          fields: [
            en('position', 128, { required: true }),
            en('place', 128, { required: true }),
            month('start_date', true),
            month('end_date'),
            en('city', 128),
            en('description', 256, { wide: true }),
          ],
        }),
      ],
    },
    {
      id: 'contact',
      parts: [
        list({
          name: 'contact_info',
          title: 'title',
          subtitle: ['info'],
          fields: [en('title', 64, { required: true }), en('info', 128, { required: true })],
        }),
      ],
    },
    {
      id: 'awards',
      parts: [
        list({
          name: 'appreciations',
          title: 'title',
          subtitle: ['place', 'date'],
          fields: [
            en('title', 256, { required: true, wide: true }),
            en('place', 256),
            month('date'),
          ],
        }),
      ],
    },
    {
      id: 'courses',
      parts: [
        list({
          name: 'courses',
          required: true,
          title: 'title',
          subtitle: ['grade', 'professor_name'],
          fields: [
            en('title', 256, { required: true }),
            { kind: 'number', name: 'grade' },
            en('professor_name', 128),
            notes('description'),
          ],
        }),
      ],
    },
    {
      id: 'certificates',
      parts: [
        list({
          name: 'certificates',
          title: 'title',
          subtitle: ['place_of_issue', 'date_of_issue'],
          fields: [
            en('title', 128, { required: true }),
            en('place_of_issue', 128),
            month('date_of_issue'),
          ],
        }),
      ],
    },
    {
      id: 'memberships',
      parts: [
        list({
          name: 'memberships',
          title: 'name',
          subtitle: ['city'],
          period: ['start_date', 'end_date'],
          fields: [
            en('name', 256, { required: true }),
            en('city', 128),
            month('start_date'),
            month('end_date'),
            notes('description'),
          ],
        }),
      ],
    },
    {
      id: 'skills',
      parts: [
        { kind: 'textarea', name: 'scientific_skills', required: true, ltr: true },
        { kind: 'textarea', name: 'personal_skills', ltr: true },
        { kind: 'textarea', name: 'extracurricular_activities', ltr: true },
      ],
    },
    {
      id: 'references',
      parts: [
        list({
          name: 'cv_references',
          required: true,
          title: 'professor_name',
          subtitle: ['position', 'university_name'],
          fields: [
            en('professor_name', 64, { required: true }),
            en('position', 64),
            en('university_name', 128, { required: true }),
            en('department_name', 128),
            { kind: 'email', name: 'email', required: true, ltr: true },
          ],
        }),
      ],
    },
    { id: 'interests', parts: [{ kind: 'interests', name: 'research_interests' }] },
  ],
};
