import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Heading } from './heading';

const headingCases = [
  [1, 'H1'],
  [2, 'H2'],
  [3, 'H3'],
  [4, 'H4'],
  [5, 'H5'],
  [6, 'H6'],
] as const;

describe('Heading', () => {
  it.each(headingCases)('renders h%s for level %s', (level, tagName) => {
    render(<Heading level={level}>Заголовок</Heading>);

    expect(screen.getByText('Заголовок').tagName).toBe(tagName);
  });

  it('size changes appearance without changing the tag', () => {
    render(
      <Heading level={2} size="sm">
        Заголовок секции
      </Heading>,
    );

    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Заголовок секции',
    });

    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveClass('text-lg');
  });

  it('renders its child when asChild is enabled', () => {
    render(
      <Heading level={3} asChild>
        <div>Заголовок карточки</div>
      </Heading>,
    );

    expect(screen.getByText('Заголовок карточки').tagName).toBe('DIV');
  });
});
