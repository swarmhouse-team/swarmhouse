import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UiTextProvider, useUiText } from './ui-text-provider';

function CloseLabel() {
  const text = useUiText();
  return <span>{text.dialog.close}</span>;
}

describe('UiTextProvider', () => {
  it('uses English strings by default', () => {
    render(<CloseLabel />);

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('uses strings supplied by the application', () => {
    render(
      <UiTextProvider value={{ dialog: { close: 'Закрыть' } }}>
        <CloseLabel />
      </UiTextProvider>,
    );

    expect(screen.getByText('Закрыть')).toBeInTheDocument();
  });
});
