import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AdminDateInput } from './ui';

describe('AdminDateInput', () => {
  it('keeps date controls on the shared admin input shell', () => {
    render(<AdminDateInput aria-label="start time" type="datetime-local" className="audit-date-filter" placeholder="开始时间" />);

    const input = screen.getByLabelText('start time');

    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveClass('admin-date-input');
    expect(input).toHaveClass('audit-date-filter');
    // 透明覆盖层样式已收编到 .admin-date-input 类，不再有内联样式
    expect(input.getAttribute('style')).toBeNull();
    expect(input.parentElement).toHaveClass('admin-date-input-shell');
    expect(input.parentElement?.querySelector('.admin-date-display')).toBeTruthy();
    expect(input.parentElement?.textContent).toContain('开始时间');
    expect(input.parentElement?.querySelector('.admin-date-input-icon')).toBeTruthy();
  });

  it('uses the warm admin control palette instead of the old teal one', () => {
    const css = readFileSync('src/index.css', 'utf8');

    expect(css).not.toContain('#2f6f65');
    expect(css).not.toContain('#8fb2aa');
    expect(css).not.toContain('rgba(20, 184, 166');
    expect(css).toContain('#806b56');
    expect(css).toContain('#f7efe1');
    expect(css).toContain('.admin-audit-filter-form .admin-date-display');
    expect(css).toContain('padding: 10px 42px 10px 12px');
  });
});
