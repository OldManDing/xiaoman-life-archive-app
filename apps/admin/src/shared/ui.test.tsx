import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminDateInput } from './ui';

describe('AdminDateInput', () => {
  it('keeps date controls on the shared admin input shell', () => {
    render(<AdminDateInput aria-label="start time" type="datetime-local" className="audit-date-filter" />);

    const input = screen.getByLabelText('start time');

    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveClass('admin-date-input');
    expect(input).toHaveClass('audit-date-filter');
    expect(input.parentElement).toHaveClass('admin-date-input-shell');
    expect(input.parentElement?.querySelector('.admin-date-input-icon')).toBeTruthy();
  });
});
