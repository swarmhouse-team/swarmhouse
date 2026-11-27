import { warehouseMocks } from '@/entities/warehouse';
import { renderWithProviders } from '@/shared/lib/test-utils';
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { WarehouseFilter } from '../lib/filter-warehouses';
import { WarehouseList } from './warehouse-list';

function WarehouseListFixture() {
  const [activeFilter, setActiveFilter] = useState<WarehouseFilter>('all');
  return (
    <WarehouseList
      warehouses={warehouseMocks}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      onCreate={vi.fn()}
      onSettings={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

function renderWarehouseList() {
  return renderWithProviders(<WarehouseListFixture />);
}

describe('WarehouseList', () => {
  it('показывает все склады и правильные счётчики', () => {
    renderWarehouseList();

    expect(screen.getByRole('tab', { name: /Все/ })).toHaveTextContent('6');

    expect(screen.getByRole('tab', { name: /Мои/ })).toHaveTextContent('3');

    expect(screen.getByRole('tab', { name: /Доступные мне/ })).toHaveTextContent('3');

    expect(screen.getByText('Центральный склад')).toBeInTheDocument();

    expect(screen.getByText('Учебный склад')).toBeInTheDocument();
  });

  it('фильтрует склады владельца', () => {
    renderWarehouseList();

    fireEvent.click(screen.getByRole('tab', { name: /Мои/ }));

    expect(screen.getByText('Центральный склад')).toBeInTheDocument();

    expect(screen.getByText('Склад готовой продукции')).toBeInTheDocument();

    expect(screen.getByText('Южный распределительный центр')).toBeInTheDocument();

    expect(screen.queryByText('Северный терминал')).not.toBeInTheDocument();

    expect(screen.queryByText('Учебный склад')).not.toBeInTheDocument();
  });

  it('фильтрует доступные пользователю склады', () => {
    renderWarehouseList();

    fireEvent.click(screen.getByRole('tab', { name: /Доступные мне/ }));

    expect(screen.getByText('Северный терминал')).toBeInTheDocument();

    expect(screen.getByText('Экспериментальный полигон')).toBeInTheDocument();

    expect(screen.getByText('Учебный склад')).toBeInTheDocument();

    expect(screen.queryByText('Центральный склад')).not.toBeInTheDocument();
  });

  it('ищет склад по названию без учёта регистра', () => {
    renderWarehouseList();

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Поиск по названию склада',
      }),
      {
        target: {
          value: 'УЧЕБНЫЙ',
        },
      },
    );

    expect(screen.getByText('Учебный склад')).toBeInTheDocument();

    expect(screen.queryByText('Центральный склад')).not.toBeInTheDocument();
  });

  it('совмещает поиск и выбранный фильтр', () => {
    renderWarehouseList();

    fireEvent.click(screen.getByRole('tab', { name: /Мои/ }));

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Поиск по названию склада',
      }),
      {
        target: {
          value: 'центральный',
        },
      },
    );

    expect(screen.getByText('Центральный склад')).toBeInTheDocument();

    expect(screen.queryByText('Южный распределительный центр')).not.toBeInTheDocument();
  });

  it('показывает состояние отсутствия результатов', () => {
    renderWarehouseList();

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Поиск по названию склада',
      }),
      {
        target: {
          value: 'несуществующий склад',
        },
      },
    );

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('показывает состояние полного отсутствия складов', () => {
    renderWithProviders(
      <WarehouseList
        warehouses={[]}
        activeFilter="all"
        onFilterChange={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Складов пока нет')).toBeInTheDocument();
  });
});
