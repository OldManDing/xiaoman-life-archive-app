import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogA11y } from './useDialogA11y';

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
