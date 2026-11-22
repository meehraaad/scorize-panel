import { expect, it } from 'vitest';
import {
  caseFile,
  nextActor,
  openRequest,
  seedExecution,
  sharedProgram,
  updateExecution,
} from './data';

it('hands the search across roles, shares one option and converts it only once', () => {
  const seed = seedExecution();
  const id = 'search-1';
  const option = {
    id: 'option-1',
    university: 'دانشگاه بولونیا',
    program: 'علوم داده',
    deadline: seed.applications[0]!.deadline,
  };
  let state = updateExecution(seed, { type: 'create', id, criteria: seed.draft });
  expect(nextActor[openRequest(state)!.phase]).toBe('researcher');
  expect(updateExecution(state, { type: 'deliver', id })).toBe(state);
  state = updateExecution(state, { type: 'option', id, option });
  state = updateExecution(state, {
    type: 'option',
    id,
    option: { ...option, id: 'option-2', university: 'دانشگاه تورین' },
  });
  state = updateExecution(state, { type: 'deliver', id });
  expect(nextActor[openRequest(state)!.phase]).toBe(caseFile.admissionOwner);
  expect(nextActor[openRequest(state)!.phase]).toBe('mina');

  state = updateExecution(state, { type: 'share', id, optionId: option.id });
  expect(nextActor[openRequest(state)!.phase]).toBe('applicant');
  expect(sharedProgram(openRequest(state)!)).toEqual(option);
  expect(updateExecution(state, { type: 'apply', id })).toBe(state);

  state = updateExecution(state, { type: 'confirm', id });
  expect(nextActor[openRequest(state)!.phase]).toBe('mina');
  state = updateExecution(state, { type: 'apply', id });
  expect(openRequest(state)).toBeUndefined();
  expect(state.applications).toEqual([...seed.applications, option]);
  expect(updateExecution(state, { type: 'apply', id })).toBe(state);

  const anotherId = 'search-2';
  state = updateExecution(state, { type: 'create', id: anotherId, criteria: seed.draft });
  state = updateExecution(state, {
    type: 'option',
    id: anotherId,
    option: { ...option, id: 'option-3', university: ' دانشگاه   بولونیا ' },
  });
  state = updateExecution(state, { type: 'deliver', id: anotherId });
  state = updateExecution(state, { type: 'share', id: anotherId, optionId: 'option-3' });
  state = updateExecution(state, { type: 'confirm', id: anotherId });
  state = updateExecution(state, { type: 'apply', id: anotherId });
  expect(state.applications).toEqual([...seed.applications, option]);
});
