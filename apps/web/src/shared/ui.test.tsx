import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppDateInput } from './ui';

describe('AppDateInput', () => {
  it('uses the shared app date shell for date fields', () => {
    const onChange = vi.fn();

    render(
      <AppDateInput
        aria-label="birthday"
        value="2026-07-26"
        displayValue="2026/07/26"
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText('birthday');

    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('data-date-input-type')).toBe('date');
    expect(input.classList.contains('app-date-time-input')).toBe(true);
    expect(input.parentElement?.classList.contains('app-date-control')).toBe(true);
    expect(input.parentElement?.textContent).toContain('2026/07/26');
  });

  it('keeps datetime fields on the same visual shell', () => {
    render(
      <AppDateInput
        aria-label="event time"
        type="datetime-local"
        value=""
        placeholder="选择时间"
        variant="line"
        onChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText('event time');
    const shellStyle = input.parentElement?.getAttribute('style') ?? '';

    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('data-date-input-type')).toBe('datetime-local');
    expect(input.parentElement?.classList.contains('app-date-control-line')).toBe(true);
    expect(shellStyle).toContain('background: transparent');
    expect(shellStyle).toContain('border-radius: 0');
    expect(input.parentElement?.textContent).toContain('选择时间');
  });

  it('forwards changes through the native date input', () => {
    const onChange = vi.fn();

    render(<AppDateInput aria-label="birthday" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('birthday'), { target: { value: '2026-07-26' } });

    expect(onChange).toHaveBeenCalled();
  });

  it('opens the themed app date sheet and commits the selected day', () => {
    const onChange = vi.fn();

    render(<AppDateInput aria-label="birthday" value="2026-07-01" displayValue="2026/07/01" onChange={onChange} />);

    fireEvent.click(screen.getByText('2026/07/01').parentElement as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'birthday' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '2026-07-15' }),
      }),
    );
  });
});
