import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './icon';

describe('Icon', () => {
  it('renders an icon from the registry', () => {
    render(<Icon name="x" data-testid="icon" className="size-5" />);

    expect(screen.getByTestId('icon')).toHaveClass('size-5');
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
  });
});
