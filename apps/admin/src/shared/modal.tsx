import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 弹窗打开期间的通用行为：Escape 关闭、Tab 焦点圈定、背景滚动锁定、关闭后焦点还原。
 */
export const useDialogA11y = (open: boolean, onClose: () => void) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const initialFocus = container.querySelector<HTMLElement>('[data-autofocus]') ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      initialFocus?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === first || !containerRef.current.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !containerRef.current.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  return containerRef;
};

export const AdminModal = ({
  open,
  title,
  eyebrow,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) => {
  const containerRef = useDialogA11y(open, onClose);

  if (!open) return null;

  return (
    <div className="admin-modal-overlay" role="presentation">
      <section className={['admin-modal', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={title} ref={containerRef}>
        <div className="admin-modal-header">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h2>{title}</h2>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label={`关闭${title}弹窗`} title={`关闭${title}弹窗`}>
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
};
