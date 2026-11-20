import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('рендерит кнопку с текстом и классами варианта', () => {
    render(<Button variant="destructive">Удалить</Button>);

    const button = screen.getByRole('button', { name: 'Удалить' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('с asChild рендерит дочерний элемент вместо button', () => {
    render(
      <Button asChild>
        <a href="https://example.com">Склады</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Склады' })).toHaveAttribute('data-slot', 'button');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('поддерживает компактную иконку с destructive hover', () => {
    render(<Button variant="ghost-destructive" size="icon-sm" aria-label="Удалить пользователя" />);

    expect(screen.getByRole('button', { name: 'Удалить пользователя' })).toHaveClass(
      'size-8',
      'hover:text-destructive',
    );
  });
});
