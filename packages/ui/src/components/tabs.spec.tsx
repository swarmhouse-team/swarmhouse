import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function TestTabs({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const [value, setValue] = useState('general');

  return (
    <Tabs value={value} onValueChange={setValue} orientation={orientation}>
      <TabsList aria-label="Settings">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
      </TabsList>
      <TabsContent value="general">General content</TabsContent>
      <TabsContent value="users">Users content</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('changes the active tab', () => {
    render(<TestTabs />);

    fireEvent.click(screen.getByRole('tab', { name: 'Users' }));

    expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Users content');
  });

  it('supports vertical keyboard navigation', () => {
    render(<TestTabs orientation="vertical" />);

    const generalTab = screen.getByRole('tab', { name: 'General' });
    generalTab.focus();
    fireEvent.keyDown(generalTab, { key: 'ArrowDown' });

    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('tab', { name: 'Users' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
  });
});
