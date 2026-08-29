import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

import {} from './uiStyles';

export const PageShell = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => {
  useEffect(() => {
    document.title = `${title} · 年轮管理后台`;
    return () => {
      document.title = '年轮管理后台';
    };
  }, [title]);

  return (
    <section className="admin-page-shell">
      <header className="admin-page-header">
        <h1>{title}</h1>
        {description ? <p className="admin-page-description">{description}</p> : null}
      </header>
      {children}
    </section>
  );
};

export const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={['admin-panel', className].filter(Boolean).join(' ')}>{children}</div>
);

export const EmptyState = ({ message, title = '暂无可处理数据', children }: { message: string; title?: string; children?: ReactNode }) => (
  <div className="admin-empty-state">
    <strong>{title}</strong>
    <p className="admin-text-muted">{message}</p>
    {children ? <div className="admin-empty-state-actions">{children}</div> : null}
  </div>
);

export const AdminButton = ({
  children,
  className,
  tone = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) => (
  <button {...props} className={['admin-button', `admin-button-${tone}`, className].filter(Boolean).join(' ')}>
    {children}
  </button>
);



type AdminOption = {
  value: string;
  label: ReactNode;
  disabled: boolean;
};

const getOptionValue = (value: SelectHTMLAttributes<HTMLSelectElement>['value']) => {
  if (Array.isArray(value)) return String(value[0] ?? '');
  if (value === undefined || value === null) return '';
  return String(value);
};

const readAdminOptions = (children: ReactNode) =>
  Children.toArray(children)
    .filter((child): child is ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }> => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: child.props.value === undefined ? String(child.props.children ?? '') : String(child.props.value),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    }));

export const AdminSelect = ({
  children,
  className,
  disabled,
  value,
  defaultValue,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const options = useMemo(() => readAdminOptions(children), [children]);
  const selectedValue = getOptionValue(value ?? defaultValue);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, [open]);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );

  const focusOption = (index: number) => {
    const target = options[index];
    if (!target || target.disabled) return;
    optionRefs.current[index]?.focus();
  };

  const commitValue = (option: AdminOption) => {
    if (disabled || option.disabled) return;
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <span
      ref={shellRef}
      className={['admin-select-shell', open ? 'admin-select-shell-open' : ''].filter(Boolean).join(' ')}
    >
    <select
      {...props}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
      className={['admin-select-native', className].filter(Boolean).join(' ')}
      tabIndex={-1}
      aria-hidden="true"
    >
      {children}
    </select>
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-disabled={disabled || undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listboxId : undefined}
      tabIndex={disabled ? -1 : 0}
      className="admin-select-trigger"
      onClick={() => {
        if (!disabled) setOpen((current) => !current);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen((current) => !current);
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
          window.setTimeout(() => focusOption(activeIndex), 0);
        }
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <span className="admin-select-value">{selectedOption?.label ?? '请选择'}</span>
      <ChevronDown className="admin-select-chevron" size={16} strokeWidth={2.3} />
    </button>
    {open && !disabled ? (
      <span id={listboxId} role="listbox" className="admin-select-menu">
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            type="button"
            role="option"
            aria-selected={option.value === selectedValue}
            disabled={option.disabled}
            className="admin-select-option"
            onClick={() => commitValue(option)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusOption(Math.min(index + 1, options.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (index === 0) {
                  setOpen(false);
                  triggerRef.current?.focus();
                } else {
                  focusOption(index - 1);
                }
              } else if (event.key === 'Home') {
                event.preventDefault();
                focusOption(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                focusOption(options.length - 1);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                commitValue(option);
              }
            }}
          >
            <span>{option.label}</span>
            {option.value === selectedValue ? <Check size={15} strokeWidth={2.4} /> : null}
          </button>
        ))}
      </span>
    ) : null}
  </span>
  );
};

const formatAdminDateInputValue = (value: InputHTMLAttributes<HTMLInputElement>['value'], type: string) => {
  if (typeof value !== 'string' || !value) return '';
  if (type === 'date') return value.replace(/-/g, '/');

  const [datePart, timePart = ''] = value.split('T');
  const time = timePart.slice(0, 5);
  if (!datePart || !time) return value.replace('T', ' ');
  return `${datePart.replace(/-/g, '/')} ${time}`;
};

const getAdminDatePlaceholder = (
  placeholder: string | undefined,
  ariaLabel: InputHTMLAttributes<HTMLInputElement>['aria-label'],
  type: string,
) => {
  if (placeholder) return placeholder;
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) return ariaLabel.replace(/\s*\*$/, '');
  return type === 'date' ? '选择日期' : '选择时间';
};

export const AdminDateInput = ({
  className,
  type = 'date',
  placeholder,
  value,
  defaultValue,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => {
  const displayValue = formatAdminDateInputValue(value ?? defaultValue, type);
  const displayPlaceholder = getAdminDatePlaceholder(placeholder, props['aria-label'], type);
  const isEmpty = !displayValue;

  return (
  <span className="admin-date-input-shell">
    <input
      {...props}
      type={type}
      value={value}
      defaultValue={defaultValue}
      className={['admin-date-input', className].filter(Boolean).join(' ')}
    />
    <span
      className={['admin-date-display', isEmpty ? 'admin-date-display-empty' : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span className="admin-date-display-value">{displayValue || displayPlaceholder}</span>
      <span className="admin-date-input-icon">
        <CalendarDays size={16} strokeWidth={2.2} />
      </span>
    </span>
  </span>
  );
};

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => (
  <span className={`admin-badge admin-badge-${tone}`}>{children}</span>
);
