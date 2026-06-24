import { Link } from 'react-router-dom';
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react';

const pageShellStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '22px',
  minHeight: 'var(--nl-page-min-height, 100dvh)',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0 22px calc(40px + env(safe-area-inset-bottom))',
  background: 'var(--nl-page-bg)',
  color: 'var(--nl-ink)',
  overflowX: 'hidden',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

const cardStyle: CSSProperties = {
  background: 'var(--nl-card-bg)',
  borderRadius: '8px',
  padding: '18px',
  border: '1px solid var(--nl-border-soft)',
  boxShadow: 'var(--nl-shadow-sm)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.02)',
  backdropFilter: 'blur(16px) saturate(1.02)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-ink)',
  fontFamily: 'var(--nl-font-display)',
  fontSize: '31px',
  fontWeight: 800,
  lineHeight: 1.08,
};

const backControlStyle: CSSProperties = {
  minHeight: '44px',
  borderRadius: '8px',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--nl-muted-strong)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '0 12px 0 10px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 620,
  boxShadow: 'none',
  cursor: 'pointer',
};

const topBarBackStyle = (variant: 'icon' | 'pill' | 'text'): CSSProperties => {
  if (variant === 'text') {
    return {
      minHeight: '44px',
      minWidth: '44px',
      border: 'none',
      background: 'transparent',
      color: 'var(--nl-muted-strong)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: 0,
      textDecoration: 'none',
      fontSize: '15px',
      fontWeight: 560,
      cursor: 'pointer',
    };
  }

  if (variant === 'icon') {
    return {
      minHeight: '38px',
      width: '38px',
      height: '38px',
      padding: 0,
      gap: 0,
      border: 'none',
      background: 'transparent',
      borderRadius: 0,
      color: 'var(--nl-muted-strong)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textDecoration: 'none',
      cursor: 'pointer',
      boxShadow: 'none',
    };
  }

  return backControlStyle;
};

export const AppTopBar = ({
  title,
  backTo,
  backLabel = '返回',
  backVariant = 'icon',
  onBack,
  action,
  background = 'var(--nl-glass-strong)',
  style,
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  backVariant?: 'icon' | 'pill' | 'text';
  onBack?: () => void;
  action?: ReactNode;
  background?: string;
  style?: CSSProperties;
}) => {
  const backContent = (
    <>
      {backVariant === 'text' ? null : <ChevronLeft size={18} strokeWidth={2.5} />}
      {backVariant === 'icon' ? null : <span>{backLabel}</span>}
    </>
  );
  const resolvedBackStyle = topBarBackStyle(backVariant);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        padding: 'calc(18px + env(safe-area-inset-top)) 22px 10px',
        background: background === 'var(--nl-glass-strong)' ? 'var(--nl-topbar-bg)' : background,
        borderBottom: '1px solid transparent',
        WebkitBackdropFilter: 'blur(16px) saturate(1.01)',
        backdropFilter: 'blur(16px) saturate(1.01)',
        boxShadow: 'none',
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(56px, auto) minmax(0, 1fr) minmax(56px, auto)',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          {onBack ? (
            <button type="button" aria-label={backLabel} onClick={onBack} style={resolvedBackStyle}>
              {backContent}
            </button>
          ) : backTo ? (
            <Link to={backTo} aria-label={backLabel} style={resolvedBackStyle}>
              {backContent}
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
        <h1
          style={{
            ...headingStyle,
            minWidth: 0,
            textAlign: 'center',
            fontSize: '17px',
            fontWeight: 760,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{action ?? <span aria-hidden="true" />}</div>
      </div>
    </header>
  );
};

export const PageShell = ({
  title,
  description,
  hideHeader,
  backTo,
  onBack,
  backLabel = '返回',
  children,
}: {
  title: string;
  description?: string;
  hideHeader?: boolean;
  backTo?: string;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) => (
  <section style={pageShellStyle}>
    {!hideHeader ? (
      backTo || onBack ? (
        <AppTopBar title={title} description={description} backTo={backTo} onBack={onBack} backLabel={backLabel} style={{ margin: '0 -22px' }} />
      ) : (
        <header style={{ padding: 'calc(34px + env(safe-area-inset-top)) 0 4px', display: 'grid', gap: '8px' }}>
          <h1 style={{ ...headingStyle, fontSize: '32px' }}>{title}</h1>
          {description ? <p style={{ margin: '4px 0 0', color: 'var(--nl-muted)', lineHeight: 1.6, fontSize: '13px', fontWeight: 500 }}>{description}</p> : null}
        </header>
      )
    ) : null}
    {children}
  </section>
);

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...cardStyle, ...style }}>{children}</div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'grid', gap: '7px', fontSize: '12px', color: 'var(--nl-muted)', fontWeight: 580 }}>
    <span>{label}</span>
    {children}
  </label>
);

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '48px',
  borderRadius: '8px',
  border: '1px solid var(--nl-border-soft)',
  padding: '13px 14px',
  fontSize: '15px',
  color: 'var(--nl-ink)',
  background: 'var(--nl-control-bg)',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
  transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
};

export const dateControlStyle: CSSProperties = {
  ...inputStyle,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 14px',
  color: 'var(--nl-ink)',
  fontWeight: 520,
  cursor: 'pointer',
  overflow: 'hidden',
  WebkitAppearance: 'none',
  appearance: 'none',
};

export const hiddenNativeDateInputStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  colorScheme: 'light',
  border: 'none',
  padding: 0,
};

export const selectControlStyle: CSSProperties = {
  width: '100%',
  minHeight: '44px',
  borderRadius: '8px',
  border: '1px solid var(--nl-border-soft)',
  padding: '10px 13px',
  boxSizing: 'border-box',
  color: 'var(--nl-ink)',
  background: 'var(--nl-control-bg)',
  fontSize: '14px',
  lineHeight: 1.35,
  fontWeight: 560,
  cursor: 'pointer',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
  transition: 'border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
};

type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const textFromNode = (node: ReactNode): string =>
  Children.toArray(node)
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item);
      if (isValidElement<{ children?: ReactNode }>(item)) return textFromNode(item.props.children);
      return '';
    })
    .join('');

const optionsFromChildren = (children: ReactNode): AppSelectOption[] =>
  Children.toArray(children)
    .filter((child): child is ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }> => isValidElement(child))
    .map((child) => {
      const label = textFromNode(child.props.children).trim();
      const optionValue = child.props.value == null ? label : String(child.props.value);
      return {
        value: optionValue,
        label,
        disabled: child.props.disabled,
      };
    });

export const AppSelect = ({
  children,
  containerStyle,
  selectStyle,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  containerStyle?: CSSProperties;
  selectStyle?: CSSProperties;
}) => {
  const listboxId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const selectedValue = props.value == null ? '' : String(props.value);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options.find((option) => option.value === '') ?? options[0];
  const placeholder = !selectedValue || selectedOption?.value === '';

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const emitChange = (nextValue: string) => {
    const event = {
      target: { value: nextValue, name: props.name },
      currentTarget: { value: nextValue, name: props.name },
    } as unknown as ChangeEvent<HTMLSelectElement>;
    props.onChange?.(event);
    setOpen(false);
  };

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
      <select aria-hidden="true" tabIndex={-1} value={selectedValue} disabled={props.disabled} onChange={props.onChange} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
        {children}
      </select>
      <button
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          ...selectControlStyle,
          minHeight: props.disabled ? selectControlStyle.minHeight : selectControlStyle.minHeight,
          opacity: props.disabled ? 0.55 : 1,
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          color: placeholder ? 'var(--nl-muted-placeholder)' : 'var(--nl-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          textAlign: 'left',
          ...selectStyle,
          ...(open ? { border: '1px solid var(--nl-primary-border)', background: 'var(--nl-control-bg-active)', boxShadow: '0 0 0 3px rgba(var(--nl-primary-rgb),0.055)' } : {}),
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOption?.label ?? ''}</span>
        <ChevronDown size={16} strokeWidth={2.1} style={{ flexShrink: 0, opacity: 0.58, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }} />
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={props['aria-label']}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 30,
            maxHeight: '220px',
            overflowY: 'auto',
            borderRadius: '8px',
            border: '1px solid var(--nl-border-strong)',
            background: 'var(--nl-glass-strong)',
            boxShadow: 'var(--nl-shadow-md)',
            WebkitBackdropFilter: 'blur(12px)',
            backdropFilter: 'blur(12px)',
            padding: '7px',
          }}
        >
          {options.map((option, index) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  emitChange(option.value);
                }}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  border: 'none',
                  borderRadius: '8px',
                  background: selected ? 'var(--nl-primary-soft)' : 'transparent',
                  color: option.disabled ? 'var(--nl-muted-disabled)' : 'var(--nl-ink)',
                  padding: '7px 32px 7px 9px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: selected ? 620 : 520,
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
                {selected ? <Check size={16} strokeWidth={2.3} style={{ position: 'absolute', right: '9px', color: 'var(--nl-accent)' }} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
};

export const AppSegmentedControl = ({
  value,
  options,
  onChange,
  ariaLabel,
  style,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
  style?: CSSProperties;
}) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    style={{
      display: 'flex',
      gap: '6px',
      padding: '4px',
      borderRadius: '8px',
      background: 'var(--nl-control-bg)',
      border: '1px solid var(--nl-border-soft)',
      boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
      ...style,
    }}
  >
    {options.map((option, index) => {
      const selected = option.value === value;
      return (
        <button
          key={`${option.value}-${index}`}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: '44px',
            border: 'none',
            borderRadius: '6px',
            background: selected ? 'var(--nl-primary-soft)' : 'transparent',
            color: selected ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
            fontSize: options.length > 4 ? '12px' : '13px',
            fontWeight: selected ? 660 : 540,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.16s ease, color 0.16s ease',
          }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical',
};

export const primaryButtonStyle: CSSProperties = {
  minHeight: '48px',
  border: '1px solid var(--nl-primary-border)',
  borderRadius: '8px',
  padding: '12px 18px',
  background: 'var(--nl-primary-gradient)',
  color: 'var(--nl-on-primary)',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  lineHeight: 1.2,
  textDecoration: 'none',
  boxShadow: '0 12px 24px rgba(var(--nl-primary-rgb),0.1), inset 0 1px 0 var(--nl-inset-highlight-faint)',
  transition: 'transform 0.14s ease, box-shadow 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, opacity 0.16s ease',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid var(--nl-border-soft)',
  background: 'var(--nl-control-bg)',
  color: 'var(--nl-muted-strong)',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
};

export const compactPrimaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  minHeight: '40px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: '0 9px 18px rgba(var(--nl-primary-rgb),0.085), inset 0 1px 0 var(--nl-inset-highlight-faint)',
};

export const compactSecondaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: '40px',
  padding: '8px 13px',
  fontSize: '13px',
  fontWeight: 650,
};

export const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.55,
  color: 'var(--nl-muted)',
};
