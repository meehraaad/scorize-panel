import { describe, expect, it } from 'vitest';
import en from '@/locales/en/writing.json';
import fa from '@/locales/fa/writing.json';
import { cvForm } from './cvForm';
import { isField, isList, missingInForm, upcomingTerms, type FormSpec } from './formSpec';
import { plForm } from './plForm';
import { recommendationForm } from './recommendationForm';
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
    ...Array.from({ length: spec.aside.tips }, (_, index) => `tips.${String(index)}`),
    ...(spec.aside.ownTitle ? ['tipsTitle'] : []),
  ];
  for (const section of spec.sections) {
    keys.push(`section.${section.id}.title`, `section.${section.id}.description`);
    for (const part of section.parts) {
      keys.push(`field.${part.name}`);
      if (part.kind === 'interests') keys.push(`help.${part.name}`);
      const fields = isList(part) ? part.fields : isField(part) ? [part] : [];
      if (isList(part)) {
        keys.push(`add.${part.name}`);
        if (part.link) keys.push(`linkLabel.${part.name}`);
        for (const field of part.fields) keys.push(`item.${part.name}.${field.name}`);
      }
      for (const field of fields)
        for (const value of field.options?.values ?? [])
          keys.push(`option.${field.options?.set ?? ''}.${String(value)}`);
    }
  }
  return keys;
}

describe.each([sopForm, cvForm, recommendationForm, plForm])('$type form', (spec) => {
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

describe('recommendation form', () => {
  it('asks for courses only in an academic letter', () => {
    const base = {
      full_name: 'Reza Kamyab',
      name_en: 'Reza Kamyab',
      position: 'CTO',
      organization: 'Cafe Bazaar',
      email: 'r@example.com',
      relationship: 'Manager, 2 years',
      work: 'Search ranking',
      qualities: 'Ownership',
      delivery: 'sign_only',
    };
    const keys = (kind: string) =>
      missingInForm(recommendationForm, { recommenders: [{ id: 1, kind, ...base }] }).map(
        (item) => item.key,
      );
    expect(keys('work')).toEqual([]);
    expect(keys('academic')).toEqual(['recommenders.0']);
  });
});

describe('upcomingTerms', () => {
  it('lists the next intakes after a date, in order', () => {
    expect(upcomingTerms(new Date(2026, 9, 24), 4)).toEqual([
      '2027-winter',
      '2027-spring',
      '2027-summer',
      '2027-fall',
    ]);
  });
});
