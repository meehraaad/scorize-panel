import type { DestinationEntry } from './destinationApi';
import type { ProgramDefinition } from './programTypes';
export function blankProgram(entry: DestinationEntry, text: string): ProgramDefinition {
  return {
    schema_version: 1,
    bundle: {
      schema_version: 1,
      synthetic: true,
      questions: [{ id: 'sample', text, kind: 'boolean' }],
      routes: [
        {
          id: entry.id,
          name: entry.title.fa || text,
          requirements: [
            {
              id: 'requirement-1',
              label: text,
              condition: { fact: 'sample', op: 'eq', value: true },
            },
          ],
        },
      ],
    },
    source: {
      title: '',
      url: '',
      checked_on: '',
      review_due: '',
      received_at: '',
      effective_on: '',
      status: 'draft',
    },
    coverage: { from: '', through: '' },
  };
}
