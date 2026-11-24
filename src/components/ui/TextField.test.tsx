import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

function Field(props: Partial<Parameters<typeof TextField>[0]>) {
  const [value, setValue] = useState('');
  return (
    <TextField
      label="field"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      {...props}
    />
  );
}

describe('TextField digits', () => {
  it('makes Persian and Arabic digits Latin in number fields', async () => {
    const user = userEvent.setup();
    render(<Field inputMode="tel" />);
    const input = screen.getByLabelText('field');
    await user.type(input, '۰۹۱٢3');
    expect(input).toHaveValue('09123');
  });

  it('keeps them in free text, unless asked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Field />);
    await user.type(screen.getByLabelText('field'), 'پلاک ۱۲');
    expect(screen.getByLabelText('field')).toHaveValue('پلاک ۱۲');
    unmount();
    render(<Field latinDigits />);
    await user.type(screen.getByLabelText('field'), 'IR۸۲');
    expect(screen.getByLabelText('field')).toHaveValue('IR82');
  });
});
