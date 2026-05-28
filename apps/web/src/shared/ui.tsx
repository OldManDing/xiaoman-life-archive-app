import { Link } from 'react-router-dom';
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react';

const pageShellStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '18px',
  minHeight: '100dvh',
  padding: '0 20px 28px',
  background: '#f4f8fc',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  borderRadius: '26px',
  padding: '18px',
  border: '1px solid rgba(126,145,170,0.22)',
  boxShadow: '0 12px 30px rgba(25, 35, 55, 0.08)',
  backdropFilter: 'blur(14px)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: '#172033',
  fontSize: '22px',
  fontWeight: 850,
  lineHeight: 1.3,
};

const backControlStyle: CSSProperties = {
  minHeight: '44px',
  borderRadius: '999px',
  border: '1px solid rgba(126,145,170,0.24)',
  background: 'rgba(255,255,255,0.9)',
  color: '#334155',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '0 12px 0 10px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: '0 8px 18px rgba(25, 35, 55, 0.07)',
  cursor: 'pointer',
};

const topBarBackStyle = (variant: 'icon' | 'pill' | 'text'): CSSProperties => {
  if (variant === 'text') {
    return {
      minHeight: '44px',
      minWidth: '44px',
      border: 'none',
      background: 'transparent',
      color: '#334155',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: 0,
      textDecoration: 'none',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
    };
  }

  if (variant === 'icon') {
    return {
      minHeight: '44px',
      width: '44px',
      padding: 0,
      gap: 0,
      border: 'none',
      background: 'transparent',
      color: '#172033',
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
  description,
  backTo,
  backLabel = '返回',
  backVariant = 'icon',
  onBack,
  action,
  background = 'rgba(248, 251, 255, 0.84)',
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
        padding: 'calc(13px + env(safe-area-inset-top)) 20px 11px',
        background,
        borderBottom: '1px solid rgba(126,145,170,0.18)',
        backdropFilter: 'blur(22px)',
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
            fontWeight: 850,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{action ?? <span aria-hidden="true" />}</div>
      </div>
      {description ? (
        <p
          style={{
            margin: '9px auto 0',
            maxWidth: '320px',
            color: '#687386',
            lineHeight: 1.55,
            fontSize: '13px',
            textAlign: 'center',
          }}
        >
          {description}
        </p>
      ) : null}
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
        <AppTopBar title={title} description={description} backTo={backTo} onBack={onBack} backLabel={backLabel} style={{ margin: '0 -20px' }} />
      ) : (
        <header style={{ padding: 'calc(24px + env(safe-area-inset-top)) 0 8px', display: 'grid', gap: '8px' }}>
          <h1 style={{ ...headingStyle, fontSize: '24px', fontWeight: 700 }}>{title}</h1>
          {description ? <p style={{ margin: '8px 0 0', color: '#687386', lineHeight: 1.6, fontSize: '14px' }}>{description}</p> : null}
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
  <label style={{ display: 'grid', gap: '8px', fontSize: '12px', color: '#687386', fontWeight: 850 }}>
    <span>{label}</span>
    {children}
  </label>
);

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '48px',
  borderRadius: '18px',
  border: '1px solid rgba(126,145,170,0.24)',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#172033',
  background: 'rgba(255,255,255,0.92)',
  outline: 'none',
  boxShadow: '0 6px 14px rgba(25,35,55,0.04)',
  transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
};

export const selectControlStyle: CSSProperties = {
  width: '100%',
  minHeight: '44px',
  borderRadius: '18px',
  border: '1px solid rgba(126,145,170,0.24)',
  padding: '10px 13px',
  boxSizing: 'border-box',
  color: '#172033',
  background: 'rgba(255,255,255,0.9)',
  fontSize: '14px',
  lineHeight: 1.35,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  boxShadow: '0 6px 14px rgba(25,35,55,0.04)',
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
          color: placeholder ? '#687386' : '#172033',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          textAlign: 'left',
          ...selectStyle,
          ...(open ? { border: '1px solid rgba(47,102,216,0.42)', background: '#ffffff', boxShadow: '0 0 0 4px rgba(47,102,216,0.1)' } : {}),
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
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 30,
            maxHeight: '220px',
            overflowY: 'auto',
            borderRadius: '20px',
            border: '1px solid rgba(126,145,170,0.22)',
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 24px 48px rgba(25, 35, 55, 0.16)',
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
                onClick={() => emitChange(option.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  border: 'none',
                  borderRadius: '13px',
                  background: selected ? '#eef6ff' : 'transparent',
                  color: option.disabled ? '#a8a29e' : '#172033',
                  padding: '7px 32px 7px 9px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: selected ? 700 : 600,
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
                {selected ? <Check size={16} strokeWidth={2.3} style={{ position: 'absolute', right: '9px', color: '#2f66d8' }} /> : null}
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
      borderRadius: '999px',
      background: 'rgba(232,239,248,0.8)',
      border: '1px solid rgba(126,145,170,0.22)',
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
            borderRadius: '999px',
            background: selected ? '#17342f' : 'transparent',
            color: selected ? '#ffffff' : '#334155',
            fontSize: options.length > 4 ? '12px' : '13px',
            fontWeight: 700,
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
  minHeight: '46px',
  border: 'none',
  borderRadius: '999px',
  padding: '12px 18px',
  background: '#17342f',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  lineHeight: 1.2,
  textDecoration: 'none',
  boxShadow: '0 12px 24px rgba(23,52,47,0.22)',
  transition: 'transform 0.14s ease, box-shadow 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, opacity 0.16s ease',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(126,145,170,0.24)',
  background: 'rgba(255,255,255,0.92)',
  color: '#334155',
  boxShadow: '0 8px 18px rgba(25,35,55,0.07)',
};

export const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#687386',
};
