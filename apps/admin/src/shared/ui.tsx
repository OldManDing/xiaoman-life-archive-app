import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type CSSProperties, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

import { badgeStyle, cardStyle, headingStyle, inputStyle, mutedTextStyle } from './uiStyles';

export const PageShell = ({ title, children }: { title: string; description?: string; children: ReactNode }) => (
  <section className="admin-page-shell" style={{ display: 'grid', gap: '12px', width: '100%', minWidth: 0 }}>
    <header className="admin-page-header" style={{ display: 'grid', gap: '4px' }}>
      <h1 style={headingStyle}>{title}</h1>
    </header>
    {children}
  </section>
);

export const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={['admin-panel', className].filter(Boolean).join(' ')} style={{ ...cardStyle, minWidth: 0, overflow: 'visible' }}>
    {children}
  </div>
);

export const EmptyState = ({ message, title = '暂无可处理数据', children }: { message: string; title?: string; children?: ReactNode }) => (
  <div className="admin-empty-state">
    <strong>{title}</strong>
    <p style={mutedTextStyle}>{message}</p>
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

const adminSelectStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '42px',
  padding: '10px 36px 10px 12px',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: '#ffffff',
  lineHeight: 1.35,
};

type AdminOption = {
  value: string;
  label: ReactNode;
  disabled: boolean;
};

const hiddenNativeSelectStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
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
  containerStyle,
  selectStyle,
  className,
  disabled,
  value,
  defaultValue,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  containerStyle?: CSSProperties;
  selectStyle?: CSSProperties;
}) => {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLSpanElement | null>(null);
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

  const commitValue = (option: AdminOption) => {
    if (disabled || option.disabled) return;
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  return (
    <span
      ref={shellRef}
      className={['admin-select-shell', open ? 'admin-select-shell-open' : ''].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}
    >
    <select
      {...props}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
      className={['admin-select-native', className].filter(Boolean).join(' ')}
      tabIndex={-1}
      style={{
        ...hiddenNativeSelectStyle,
      }}
    >
      {children}
    </select>
    <button
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
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setOpen(true);
        }
        if (event.key === 'Escape') setOpen(false);
      }}
      style={{
        ...adminSelectStyle,
        opacity: disabled ? 0.62 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        ...selectStyle,
      }}
    >
      <span className="admin-select-value">{selectedOption?.label ?? '请选择'}</span>
      <ChevronDown className="admin-select-chevron" size={16} strokeWidth={2.3} />
    </button>
    {open && !disabled ? (
      <span id={listboxId} role="listbox" className="admin-select-menu">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === selectedValue}
            disabled={option.disabled}
            className="admin-select-option"
            onClick={() => commitValue(option)}
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
  containerStyle,
  inputStyle: inputStyleOverride,
  type = 'date',
  disabled,
  placeholder,
  value,
  defaultValue,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  containerStyle?: CSSProperties;
  inputStyle?: CSSProperties;
}) => {
  const displayValue = formatAdminDateInputValue(value ?? defaultValue, type);
  const displayPlaceholder = getAdminDatePlaceholder(placeholder, props['aria-label'], type);
  const isEmpty = !displayValue;

  return (
  <span className="admin-date-input-shell" style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
    <input
      {...props}
      type={type}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={['admin-date-input', className].filter(Boolean).join(' ')}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: '42px',
        padding: 0,
        border: 0,
        background: 'transparent',
        opacity: 0,
        color: 'transparent',
        caretColor: 'transparent',
        WebkitTextFillColor: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1.35,
        colorScheme: 'light',
        fontVariantNumeric: 'tabular-nums',
        zIndex: 2,
      }}
    />
    <span
      className={['admin-date-display', isEmpty ? 'admin-date-display-empty' : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={inputStyleOverride}
    >
      <span className="admin-date-display-value">{displayValue || displayPlaceholder}</span>
      <span className="admin-date-input-icon">
        <CalendarDays size={16} strokeWidth={2.2} />
      </span>
    </span>
  </span>
  );
};

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => {
  const toneStyle = {
    neutral: { background: '#f7efe1', borderColor: 'rgba(139, 116, 79, 0.18)', color: '#4d412f' },
    success: { background: '#eef8ef', borderColor: '#b9dfbe', color: '#2d6d38' },
    warning: { background: '#fff4df', borderColor: '#edd19d', color: '#8a5a19' },
    danger: { background: '#fff0ed', borderColor: '#efc3bb', color: '#a33a30' },
    info: { background: '#f4ecd9', borderColor: '#dfc89b', color: '#6d552d' },
  }[tone];

  return <span style={{ ...badgeStyle, ...toneStyle }}>{children}</span>;
};
