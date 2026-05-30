import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

import { badgeStyle, cardStyle, headingStyle, inputStyle, mutedTextStyle } from './uiStyles';

export const PageShell = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section className="admin-page-shell" style={{ display: 'grid', gap: '12px', width: '100%', minWidth: 0 }}>
    <header className="admin-page-header" style={{ display: 'grid', gap: '8px' }}>
      <h1 style={headingStyle}>{title}</h1>
      {description ? <p style={mutedTextStyle}>{description}</p> : null}
    </header>
    {children}
  </section>
);

export const Panel = ({ children }: { children: ReactNode }) => <div className="admin-panel" style={{ ...cardStyle, minWidth: 0, overflow: 'hidden' }}>{children}</div>;

export const EmptyState = ({ message, title = '暂无可处理数据', children }: { message: string; title?: string; children?: ReactNode }) => (
  <div className="admin-empty-state">
    <strong>{title}</strong>
    <p style={mutedTextStyle}>{message}</p>
    {children ? <div className="admin-empty-state-actions">{children}</div> : null}
  </div>
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
    <span ref={shellRef} className="admin-select-shell" style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
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

export const AdminDateInput = ({
  className,
  containerStyle,
  inputStyle: inputStyleOverride,
  type = 'date',
  disabled,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  containerStyle?: CSSProperties;
  inputStyle?: CSSProperties;
}) => (
  <span className="admin-date-input-shell" style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
    <input
      {...props}
      type={type}
      disabled={disabled}
      className={['admin-date-input', className].filter(Boolean).join(' ')}
      style={{
        ...inputStyle,
        height: '42px',
        minHeight: '42px',
        padding: '10px 42px 10px 12px',
        opacity: disabled ? 0.62 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        ...inputStyleOverride,
      }}
    />
    <span className="admin-date-input-icon" aria-hidden="true">
      <CalendarDays size={16} strokeWidth={2.2} />
    </span>
  </span>
);

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => {
  const toneStyle = {
    neutral: { background: '#f6f8f7', borderColor: '#cbd5d1', color: '#263532' },
    success: { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' },
    warning: { background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' },
    danger: { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
    info: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
  }[tone];

  return <span style={{ ...badgeStyle, ...toneStyle }}>{children}</span>;
};
