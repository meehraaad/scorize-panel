import { describe, expect, it } from 'vitest';
import { wordDiff } from './textDiff';

describe('wordDiff', () => {
  it('marks the words a seller changed in a clause', () => {
    expect(wordDiff('اسکورایز ۶ اپلای انجام می‌دهد.', 'اسکورایز ۸ اپلای انجام می‌دهد.')).toEqual([
      { kind: 'same', text: 'اسکورایز ' },
      { kind: 'removed', text: '۶ ' },
      { kind: 'added', text: '۸ ' },
      { kind: 'same', text: 'اپلای انجام می‌دهد.' },
    ]);
  });

  it('handles added and removed text at the ends', () => {
    expect(wordDiff('a b', 'a b c')).toEqual([
      { kind: 'same', text: 'a b ' },
      { kind: 'added', text: 'c' },
    ]);
    expect(wordDiff('', 'new')).toEqual([{ kind: 'added', text: 'new' }]);
    expect(wordDiff('old', '')).toEqual([{ kind: 'removed', text: 'old' }]);
    expect(wordDiff('same', 'same')).toEqual([{ kind: 'same', text: 'same' }]);
  });
});
