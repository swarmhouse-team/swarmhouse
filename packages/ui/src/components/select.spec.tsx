import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('Select', () => {
  it('показывает выбранное значение в триггере', () => {
    render(
      <Select defaultValue="owner">
        <SelectTrigger aria-label="Роль пользователя">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="owner">Владелец</SelectItem>
          <SelectItem value="observer">Наблюдатель</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Роль пользователя' });

    expect(trigger).toHaveTextContent('Владелец');
    expect(trigger).toHaveAttribute('data-slot', 'select-trigger');
  });

  it('поддерживает заблокированное состояние', () => {
    render(
      <Select defaultValue="owner" disabled>
        <SelectTrigger aria-label="Роль пользователя">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="owner">Владелец</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Роль пользователя' })).toBeDisabled();
  });

  it('задаёт размер дочерним элементам через корневой Select', () => {
    render(
      <Select size="sm" defaultValue="owner">
        <SelectTrigger aria-label="Роль пользователя">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="owner">Владелец</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Роль пользователя' })).toHaveAttribute(
      'data-size',
      'sm',
    );
  });
});
