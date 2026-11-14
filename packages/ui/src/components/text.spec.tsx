import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Text } from './text';

describe('Text', () => {
  it('renders a paragraph by default', () => {
    render(<Text>Описание платформы</Text>);

    expect(screen.getByText('Описание платформы').tagName).toBe('P');
  });

  it.each([
    ['p', 'P'],
    ['span', 'SPAN'],
    ['div', 'DIV'],
    ['li', 'LI'],
  ] as const)('renders %s when as is specified', (as, tagName) => {
    render(<Text as={as}>Текст</Text>);

    expect(screen.getByText('Текст').tagName).toBe(tagName);
  });

  it('applies variants and merges className', () => {
    render(
      <Text variant="muted" size="sm" weight="semibold" className="mt-4">
        Дополнительная информация
      </Text>,
    );

    expect(screen.getByText('Дополнительная информация')).toHaveClass(
      'text-muted-foreground',
      'text-sm',
      'font-semibold',
      'mt-4',
    );
  });

  it('renders its child when asChild is enabled', () => {
    render(
      <Text asChild variant="destructive">
        <strong>Ошибка</strong>
      </Text>,
    );

    const text = screen.getByText('Ошибка');

    expect(text.tagName).toBe('STRONG');
    expect(text).toHaveClass('text-destructive');
  });
});
