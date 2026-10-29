import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnswerText } from './AnswerText';

describe('AnswerText', () => {
  it('reads the Markdown models write, as React elements', () => {
    const { container } = render(
      <AnswerText
        text={'## فروش مهر\n**۹۰** سرنخ\n\n- اول\n* دوم\n1. یک\n۲. دو\n---\n<b>نه</b> `کد`'}
      />,
    );
    expect(screen.getByText('فروش مهر').tagName).toBe('STRONG');
    expect(screen.getByText('۹۰').tagName).toBe('STRONG');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    // Never HTML: tags show as text.
    expect(screen.getByText('<b>نه</b> کد')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });
});
