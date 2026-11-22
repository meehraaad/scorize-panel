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
    deadline: seed.draft.due,
  };
  let state = updateExecution(seed, { type: 'create', id, criteria: seed.draft });
  const activeRequest = () => {
    const request = openRequest(state);
    if (!request) throw new Error('Expected an open search request');
    return request;
  };
  expect(nextActor[activeRequest().phase]).toBe('researcher');
  expect(updateExecution(state, { type: 'deliver', id })).toBe(state);
  state = updateExecution(state, { type: 'option', id, option });
  state = updateExecution(state, {
    type: 'option',
    id,
    option: { ...option, id: 'option-2', university: 'دانشگاه تورین' },
  });
  state = updateExecution(state, { type: 'deliver', id });
  expect(nextActor[activeRequest().phase]).toBe(caseFile.admissionOwner);
  expect(nextActor[activeRequest().phase]).toBe('mina');

  state = updateExecution(state, { type: 'share', id, optionId: option.id });
  expect(nextActor[activeRequest().phase]).toBe('applicant');
  expect(sharedProgram(activeRequest())).toEqual(option);
  expect(updateExecution(state, { type: 'apply', id })).toBe(state);

  state = updateExecution(state, { type: 'confirm', id });
  expect(nextActor[activeRequest().phase]).toBe('mina');
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
