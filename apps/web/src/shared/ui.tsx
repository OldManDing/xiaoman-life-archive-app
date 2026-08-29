import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Children, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ForwardedRef, type InputHTMLAttributes, type ReactElement, type ReactNode, type RefObject, type SelectHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const pageShellStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '18px',
  minHeight: 'var(--nl-page-min-height, 100dvh)',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0 var(--nl-content-inline) calc(40px + env(safe-area-inset-bottom))',
  background: 'var(--nl-page-bg)',
  color: 'var(--nl-ink)',
  overflowX: 'hidden',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

const cardStyle: CSSProperties = {
  background: 'var(--nl-card-bg)',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid var(--nl-border-soft)',
  boxShadow: 'var(--nl-shadow-sm)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.02)',
  backdropFilter: 'blur(16px) saturate(1.02)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-ink)',
  fontFamily: 'var(--nl-font-display)',
  fontSize: 'var(--nl-title-page-size)',
  fontWeight: 780,
  lineHeight: 1.12,
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
        padding: 'calc(16px + env(safe-area-inset-top)) var(--nl-content-inline) 8px',
        background: background === 'var(--nl-glass-strong)' ? 'var(--nl-topbar-bg)' : background,
        borderBottom: '1px solid transparent',
        WebkitBackdropFilter: 'none',
        backdropFilter: 'none',
        boxShadow: 'none',
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(48px, auto) minmax(0, 1fr) minmax(48px, auto)',
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
        {title ? (
          <h1
            style={{
              ...headingStyle,
              minWidth: 0,
              textAlign: 'center',
              fontFamily: 'var(--nl-font-sans)',
              fontSize: '16px',
              fontWeight: 680,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h1>
        ) : (
          <span aria-hidden="true" />
        )}
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
  <section className="app-page-shell" style={pageShellStyle}>
    {!hideHeader ? (
      backTo || onBack ? (
        <>
          <AppTopBar title="" backTo={backTo} onBack={onBack} backLabel={backLabel} style={{ margin: '0 -22px' }} />
          <header className="page-shell-masthead" style={{ display: 'grid', gap: '9px', padding: '4px 0 8px' }}>
            <span aria-hidden="true" style={{ width: '28px', height: '2px', background: 'var(--nl-primary-2)' }} />
            <h1 style={{ ...headingStyle, fontSize: '29px', lineHeight: 1.08 }}>{title}</h1>
            {description ? <p style={{ margin: 0, maxWidth: '34em', color: 'var(--nl-muted)', lineHeight: 1.65, fontSize: '13px', fontWeight: 500 }}>{description}</p> : null}
          </header>
        </>
      ) : (
        <header style={{ padding: 'calc(30px + env(safe-area-inset-top)) 0 2px', display: 'grid', gap: '6px' }}>
          <h1 style={headingStyle}>{title}</h1>
          {description ? <p style={{ margin: '4px 0 0', color: 'var(--nl-muted)', lineHeight: 1.6, fontSize: '13px', fontWeight: 500 }}>{description}</p> : null}
        </header>
      )
    ) : null}
    {children}
  </section>
);

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="app-panel" style={{ ...cardStyle, ...style }}>{children}</div>
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
  fontWeight: 540,
  cursor: 'pointer',
  overflow: 'hidden',
  WebkitAppearance: 'none',
  appearance: 'none',
  isolation: 'isolate',
  background: 'var(--nl-control-bg-active)',
  borderColor: 'var(--nl-border-muted)',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
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

const assignDateInputRef = (ref: ForwardedRef<HTMLInputElement>, value: HTMLInputElement | null) => {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
};

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const useDialogFocus = (open: boolean, dialogRef: RefObject<HTMLElement | null>, restoreRef?: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const frame = window.requestAnimationFrame(() => {
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialog)?.focus?.();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus?.();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      (restoreRef?.current ?? previous)?.focus?.();
    };
  }, [dialogRef, open, restoreRef]);
};

type DateDraft = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const appDateWeekdays = ['日', '一', '二', '三', '四', '五', '六'];

const padDatePart = (value: number) => String(value).padStart(2, '0');

const clampDateNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const normalizeDateDraft = (draft: DateDraft): DateDraft => {
  const month = clampDateNumber(draft.month, 1, 12);
  const day = clampDateNumber(draft.day, 1, getDaysInMonth(draft.year, month));
  return {
    year: draft.year,
    month,
    day,
    hour: clampDateNumber(draft.hour, 0, 23),
    minute: clampDateNumber(draft.minute, 0, 59),
  };
};

const parseDateInputValue = (rawValue: InputHTMLAttributes<HTMLInputElement>['value'], type: 'date' | 'datetime-local'): DateDraft => {
  const now = new Date();
  const fallback: DateDraft = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
  const value = typeof rawValue === 'string' ? rawValue : '';
  if (!value) return fallback;

  const [datePart, timePart = ''] = value.split('T');
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!dateMatch) return fallback;

  const timeMatch = /^(\d{2}):(\d{2})/.exec(timePart);
  return normalizeDateDraft({
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: type === 'datetime-local' && timeMatch ? Number(timeMatch[1]) : fallback.hour,
    minute: type === 'datetime-local' && timeMatch ? Number(timeMatch[2]) : fallback.minute,
  });
};

const formatDateDraftValue = (draft: DateDraft, type: 'date' | 'datetime-local') => {
  const normalized = normalizeDateDraft(draft);
  const date = [normalized.year, padDatePart(normalized.month), padDatePart(normalized.day)].join('-');
  if (type === 'date') return date;
  return `${date}T${padDatePart(normalized.hour)}:${padDatePart(normalized.minute)}`;
};

const shiftDateDraftMonth = (draft: DateDraft, delta: number): DateDraft => {
  const next = new Date(draft.year, draft.month - 1 + delta, 1);
  return normalizeDateDraft({
    ...draft,
    year: next.getFullYear(),
    month: next.getMonth() + 1,
  });
};

const getDateGridDays = (year: number, month: number) => {
  const leading = new Date(year, month - 1, 1).getDay();
  const total = getDaysInMonth(year, month);
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
};

type AppDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: 'date' | 'datetime-local';
  displayValue?: string;
  placeholder?: string;
  variant?: 'default' | 'line';
  controlStyle?: CSSProperties;
  textStyle?: CSSProperties;
};

export const AppDateInput = forwardRef<HTMLInputElement, AppDateInputProps>(({
  type = 'date',
  displayValue,
  placeholder,
  variant = 'default',
  controlStyle,
  textStyle,
  disabled,
  className,
  value,
  onChange,
  onKeyDown,
  onPointerDown,
  ...props
}, forwardedRef) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const dialogRef = useRef<HTMLSpanElement | null>(null);
  const dialogTitleId = useId();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<DateDraft>(() => parseDateInputValue(value ?? props.defaultValue, type));
  const isDateTime = type === 'datetime-local';
  const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value);
  const lineVariantStyle: CSSProperties = variant === 'line'
    ? {
        minHeight: '44px',
        width: 'auto',
        minWidth: 0,
        padding: '0 0 0 2px',
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
        boxShadow: 'none',
        justifyContent: 'flex-end',
      }
    : {};
  const Icon = isDateTime ? Clock : CalendarDays;

  useEffect(() => {
    if (!isPickerOpen) return;
    setDraft(parseDateInputValue(value ?? props.defaultValue, type));
  }, [isPickerOpen, props.defaultValue, type, value]);

  useEffect(() => {
    if (!isPickerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPickerOpen]);

  const openPicker = () => {
    if (disabled) return;
    setPickerOpen(true);
  };

  useDialogFocus(isPickerOpen, dialogRef, triggerRef);

  const emitDateValue = (nextValue: string) => {
    const event = {
      target: { value: nextValue, name: props.name },
      currentTarget: { value: nextValue, name: props.name },
    } as ChangeEvent<HTMLInputElement>;
    onChange?.(event);
  };

  const commitPickerValue = () => {
    emitDateValue(formatDateDraftValue(draft, type));
    setPickerOpen(false);
  };

  const updateMonth = (delta: number) => setDraft((current) => shiftDateDraftMonth(current, delta));

  const updateTime = (key: 'hour' | 'minute', rawValue: string) => {
    const max = key === 'hour' ? 23 : 59;
    const next = Number(rawValue.replace(/\D/g, ''));
    setDraft((current) => ({
      ...current,
      [key]: Number.isFinite(next) ? clampDateNumber(next, 0, max) : 0,
    }));
  };

  const calendarDays = getDateGridDays(draft.year, draft.month);
  const today = parseDateInputValue(formatDateDraftValue(parseDateInputValue('', type), 'date'), 'date');

  return (
    <>
      <span
        ref={triggerRef}
        className={['app-date-control', 'app-date-control-' + variant].filter(Boolean).join(' ')}
        onClick={openPicker}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={isPickerOpen}
        aria-label={typeof props['aria-label'] === 'string' ? `${props['aria-label']} 控件` : placeholder || (isDateTime ? '选择时间' : '选择日期')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        style={{
          ...dateControlStyle,
          ...lineVariantStyle,
          minHeight: variant === 'line' ? lineVariantStyle.minHeight : dateControlStyle.minHeight,
          color: hasValue ? 'var(--nl-ink)' : 'var(--nl-muted-placeholder)',
          opacity: disabled ? 0.58 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...controlStyle,
        }}
      >
        <input
          {...props}
          ref={(node) => {
            inputRef.current = node;
            assignDateInputRef(forwardedRef, node);
          }}
          className={['app-date-time-input', className].filter(Boolean).join(' ')}
          type="text"
          inputMode="none"
          autoComplete="off"
          data-date-input-type={type}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onPointerDown={(event) => {
            onPointerDown?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            openPicker();
          }}
          tabIndex={-1}
          aria-hidden="true"
          style={hiddenNativeDateInputStyle}
        />
        <Icon size={isDateTime ? 15 : 17} strokeWidth={2.05} color="var(--nl-muted-strong)" style={{ pointerEvents: 'none', opacity: variant === 'line' ? 0.7 : 0.82, flexShrink: 0 }} />
        <span
          style={{
            pointerEvents: 'none',
            flex: variant === 'line' ? '0 1 auto' : 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: variant === 'line' ? '14px' : '14px',
            fontWeight: variant === 'line' ? 600 : 560,
            ...textStyle,
          }}
        >
          {displayValue || placeholder || (isDateTime ? '选择时间' : '年/月/日')}
        </span>
      </span>
      {isPickerOpen && typeof document !== 'undefined' ? createPortal(
        <span className="app-date-sheet-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPickerOpen(false);
        }}>
          <span ref={dialogRef} className="app-date-sheet" role="dialog" aria-modal="true" aria-label={typeof props['aria-label'] === 'string' ? props['aria-label'] : '选择日期'} tabIndex={-1}>
            <span className="app-date-sheet-header">
              <span>
                <span className="app-date-sheet-kicker">{isDateTime ? '发生时间' : '日期'}</span>
                <strong id={dialogTitleId}>{draft.year}年{padDatePart(draft.month)}月</strong>
              </span>
              <span className="app-date-sheet-actions">
                <button type="button" onClick={() => setPickerOpen(false)}>取消</button>
                <button type="button" className="app-date-sheet-confirm" onClick={commitPickerValue}>确定</button>
              </span>
            </span>
            <span className="app-date-sheet-nav" aria-label="切换月份">
              <button type="button" aria-label={`上一年：${draft.year - 1}`} onClick={() => updateMonth(-12)}>{draft.year - 1}</button>
              <button type="button" aria-label="上一月" onClick={() => updateMonth(-1)}>
                <ChevronLeft size={16} strokeWidth={2.4} />
              </button>
              <span>{draft.year}.{padDatePart(draft.month)}</span>
              <button type="button" aria-label="下一月" onClick={() => updateMonth(1)}>
                <ChevronRight size={16} strokeWidth={2.4} />
              </button>
              <button type="button" aria-label={`下一年：${draft.year + 1}`} onClick={() => updateMonth(12)}>{draft.year + 1}</button>
            </span>
            <span className="app-date-weekdays">
              {appDateWeekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </span>
            <span className="app-date-grid">
              {calendarDays.map((day, index) => {
                const selected = day === draft.day;
                const isToday = day === today.day && draft.month === today.month && draft.year === today.year;
                return day ? (
                  <button
                    key={day}
                    type="button"
                    className={[
                      'app-date-day',
                      selected ? 'app-date-day-selected' : '',
                      isToday ? 'app-date-day-today' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setDraft((current) => ({ ...current, day }))}
                    aria-pressed={selected}
                  >
                    {day}
                  </button>
                ) : <span key={`blank-${index}`} className="app-date-day-empty" />;
              })}
            </span>
            {isDateTime ? (
              <span className="app-date-time-panel">
                <span>时间</span>
                <label>
                  <input
                    inputMode="numeric"
                    value={padDatePart(draft.hour)}
                    onChange={(event) => updateTime('hour', event.target.value)}
                    aria-label="小时"
                  />
                  <small>时</small>
                </label>
                <label>
                  <input
                    inputMode="numeric"
                    value={padDatePart(draft.minute)}
                    onChange={(event) => updateTime('minute', event.target.value)}
                    aria-label="分钟"
                  />
                  <small>分</small>
                </label>
              </span>
            ) : null}
          </span>
        </span>,
        document.body,
      ) : null}
    </>
  );
});

export const selectControlStyle: CSSProperties = {
  width: '100%',
  minHeight: '44px',
  borderRadius: '8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--nl-border-soft)',
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const rawValue = props.value ?? props.defaultValue;
  const selectedValue = typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : '';
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options.find((option) => option.value === '') ?? options[0];
  const placeholder = !selectedValue || selectedOption?.value === '';
  const firstEnabledIndex = () => options.findIndex((option) => !option.disabled);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue && !option.disabled);
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
  }, [open, options, selectedIndex]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const option = document.getElementById(optionId(activeIndex));
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, listboxId, open]);

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
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
  }, []);

  const emitChange = (nextValue: string) => {
    const event = {
      target: { value: nextValue, name: props.name },
      currentTarget: { value: nextValue, name: props.name },
    } as unknown as ChangeEvent<HTMLSelectElement>;
    props.onChange?.(event);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: 1 | -1) => {
    if (!options.length) return;
    setActiveIndex((current) => {
      const start = current >= 0 ? current : selectedIndex;
      for (let step = 1; step <= options.length; step += 1) {
        const candidate = (start + delta * step + options.length) % options.length;
        if (!options[candidate]?.disabled) return candidate;
      }
      return current;
    });
  };

  const selectActive = () => {
    const option = options[activeIndex];
    if (option && !option.disabled) emitChange(option.value);
  };

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
      <select aria-hidden="true" tabIndex={-1} value={selectedValue} disabled={props.disabled} onChange={props.onChange} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
        {children}
      </select>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(1);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(-1);
            return;
          }
          if (event.key === 'Home' && open) {
            event.preventDefault();
            setActiveIndex(firstEnabledIndex());
            return;
          }
          if (event.key === 'End' && open) {
            event.preventDefault();
            for (let index = options.length - 1; index >= 0; index -= 1) {
              if (!options[index]?.disabled) {
                setActiveIndex(index);
                break;
              }
            }
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) selectActive();
            else setOpen(true);
            return;
          }
          if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
            const nextQuery = `${typeaheadRef.current}${event.key}`.toLocaleLowerCase();
            typeaheadRef.current = nextQuery;
            const match = options.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(nextQuery));
            if (match >= 0) {
              if (open) setActiveIndex(match);
              else emitChange(options[match].value);
            }
            if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
            typeaheadTimerRef.current = window.setTimeout(() => { typeaheadRef.current = ''; }, 500);
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
          ...(open ? { background: 'var(--nl-control-bg-active)', boxShadow: '0 0 0 3px rgba(var(--nl-primary-rgb),0.055)' } : {}),
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
            background: 'var(--nl-popover-bg)',
            boxShadow: 'var(--nl-shadow-md)',
            padding: '7px',
          }}
        >
          {options.map((option, index) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={`${option.value}-${index}`}
                id={optionId(index)}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                tabIndex={-1}
                disabled={option.disabled}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  emitChange(option.value);
                }}
                onMouseEnter={() => {
                  if (!option.disabled) setActiveIndex(index);
                }}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  border: 'none',
                  borderRadius: '8px',
                    background: selected ? 'var(--nl-primary-soft)' : activeIndex === index ? 'var(--nl-surface-soft)' : 'transparent',
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
          tabIndex={selected || (!options.some((item) => item.value === value) && index === 0) ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + delta + options.length) % options.length;
            const next = options[nextIndex];
            if (next) {
              onChange(next.value);
              window.setTimeout(() => {
                const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button:nth-of-type(${nextIndex + 1})`);
                target?.focus();
              }, 0);
            }
          }}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: '44px',
            border: 'none',
             borderRadius: '11px',
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
  boxShadow: '0 10px 24px rgba(var(--nl-shadow-rgb),0.1), inset 0 1px 0 var(--nl-inset-highlight-faint)',
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
