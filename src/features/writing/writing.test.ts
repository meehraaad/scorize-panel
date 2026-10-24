import { describe, expect, it } from 'vitest';
import en from '@/locales/en/writing.json';
import fa from '@/locales/fa/writing.json';
import { cvForm } from './cvForm';
import { isField, isList, missingInForm, type FormSpec } from './formSpec';
import { sopForm } from './sopForm';

/**
 * The form specs build their dictionary keys at run time (see formSpec.ts), so TypeScript can't
 * check them: this test does, for every form and every language.
 */

const has = (dictionary: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      dictionary,
    ) !== undefined;

function keysFor(spec: FormSpec) {
  const keys = [
    'title',
    'subtitle',
    'noOrder',
    'doneTitle',
    'finalNote',
    'tips.0',
    'tips.1',
    'tips.2',
    'tips.3',
  ];
  for (const section of spec.sections) {
    keys.push(`section.${section.id}.title`, `section.${section.id}.description`);
    for (const part of section.parts) {
      keys.push(`field.${part.name}`);
      if (part.kind === 'interests') keys.push(`help.${part.name}`);
      const fields = isList(part) ? part.fields : isField(part) ? [part] : [];
      if (isList(part)) {
        keys.push(`add.${part.name}`);
        for (const field of part.fields) keys.push(`item.${part.name}.${field.name}`);
      }
      for (const field of fields)
        for (const value of field.options?.values ?? [])
          keys.push(`option.${field.options?.set ?? ''}.${String(value)}`);
    }
  }
  return keys;
}

describe.each([sopForm, cvForm])('$type form', (spec) => {
  it.each([
    ['fa', fa],
    ['en', en],
  ])('has every dictionary key in %s', (_language, dictionary) => {
    const missing = keysFor(spec).filter((key) => !has(dictionary, `${spec.type}.${key}`));
    expect(missing).toEqual([]);
  });

  it('gives each part a unique name', () => {
    const names = spec.sections.flatMap((section) => section.parts.map((part) => part.name));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('CV form', () => {
  it('needs the photo, a degree, a course and a reference before the final submit', () => {
    const keys = missingInForm(cvForm, {}).map((item) => item.key);
    expect(keys).toEqual(
      expect.arrayContaining(['pass_photo', 'educations', 'courses', 'cv_references']),
    );
    // Optional lists (tests, publications, …) never block it.
    expect(keys).not.toContain('english_tests');
  });

  it('points at an entry with required fields left', () => {
    const keys = missingInForm(cvForm, {
      educations: [{ id: 1, level: 3, name: 'IUT', study_field: null }],
    }).map((item) => item.key);
    expect(keys).toContain('educations.0');
    expect(keys).not.toContain('educations');
  });
});
