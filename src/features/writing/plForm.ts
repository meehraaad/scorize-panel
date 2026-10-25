import type { FormSpec } from './formSpec';

/**
 * Professor list form: what the search team needs to find professors that fit the applicant.
 * Django's ProfessorsListData and KnownProfessor (H50). Design: canvas V8 "فرم فهرست استادها"
 * (AppProfForm).
 */
export const plForm: FormSpec = {
  type: 'pl',
  progress: 'questions',
  aside: { tips: 3, ownTitle: true },
  sections: [
    {
      id: 'target',
      parts: [
        {
          kind: 'choice',
          name: 'degree',
          required: true,
          options: { set: 'degree', values: ['research_master', 'phd'] },
        },
        { kind: 'text', name: 'field', required: true, maxLength: 100 },
        { kind: 'term', name: 'start_term', required: true },
        {
          kind: 'checks',
          name: 'countries',
          required: true,
          wide: true,
          options: { set: 'country', values: ['ca', 'us', 'de', 'gb', 'nl', 'au', 'se'] },
        },
        // The applicant's ResearchInterests (H11): the email bot finds professors with them too.
        { kind: 'tags', name: 'research_interests', required: true, wide: true, ltr: true },
        {
          kind: 'choice',
          name: 'funding',
          required: true,
          wide: true,
          layout: 'stack',
          options: { set: 'funding', values: ['full', 'partial', 'any'] },
        },
      ],
    },
    {
      id: 'known',
      parts: [
        {
          kind: 'list',
          name: 'known_professors',
          title: 'name',
          subtitle: ['university'],
          link: 'url',
          fields: [
            { kind: 'text', name: 'name', required: true, maxLength: 100, ltr: true },
            { kind: 'text', name: 'university', required: true, maxLength: 150, ltr: true },
            { kind: 'url', name: 'url', maxLength: 300, ltr: true, wide: true },
          ],
        },
      ],
    },
    { id: 'limits', parts: [{ kind: 'textarea', name: 'exclusions' }] },
  ],
};
