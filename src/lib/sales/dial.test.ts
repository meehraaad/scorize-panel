import { describe, expect, it } from 'vitest';
import { callHref, pbxNumber } from './dial';

describe('pbxNumber', () => {
  it('dials outside numbers with 98 like the PBX does', () => {
    expect(pbxNumber('09121234567')).toBe('989121234567');
    expect(pbxNumber('+98 912 123 4567')).toBe('989121234567');
    expect(pbxNumber('00989121234567')).toBe('989121234567');
    expect(pbxNumber('989121234567')).toBe('989121234567');
    expect(pbxNumber('02191018457')).toBe('982191018457');
  });

  it('leaves other numbers as digits', () => {
    expect(pbxNumber('104')).toBe('104');
  });
});

describe('callHref', () => {
  it('uses the phone app when Linphone is off', () => {
    expect(callHref('09121234567', null)).toBe('tel:09121234567');
  });

  it('opens Linphone with the office domain when on', () => {
    expect(callHref('09121234567', 'pbx.example')).toBe('sip:989121234567@pbx.example');
  });
});
