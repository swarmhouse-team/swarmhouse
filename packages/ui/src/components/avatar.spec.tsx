import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';

describe('Avatar', () => {
  it('supports size and visual variants', () => {
    render(
      <Avatar size="sm" variant="dashed">
        AB
      </Avatar>,
    );

    expect(screen.getByText('AB')).toHaveClass('size-8', 'border-dashed');
  });
});
