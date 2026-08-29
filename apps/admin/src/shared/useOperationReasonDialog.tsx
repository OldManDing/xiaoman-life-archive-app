import { useEffect, useRef, useState } from 'react';

import { AdminModal } from './modal';
import { primaryButtonStyle, secondaryButtonStyle } from './uiStyles';

export const useOperationReasonDialog = () => {
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{ actionName: string; reason: string; error: string | null } | null>(null);

  const requestOperationReason = (actionName: string) => new Promise<string | null>((resolve) => {
    resolverRef.current?.(null);
    resolverRef.current = resolve;
    setDialog({ actionName, reason: '', error: null });
  });

  const closeDialog = (value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const reasonDialog = dialog ? (
    <AdminModal open title={dialog.actionName} eyebrow="后台操作确认" onClose={() => closeDialog(null)}>
      <label className="admin-modal-field">
        操作原因
        <textarea
          value={dialog.reason}
          onChange={(event) => setDialog((current) => (current ? { ...current, reason: event.target.value, error: null } : current))}
          placeholder="写清楚为什么要执行这次操作，方便审计复盘"
          autoFocus
        />
      </label>
      {dialog.error ? <p className="admin-modal-error">{dialog.error}</p> : null}
      <div className="admin-modal-actions">
        <button type="button" style={secondaryButtonStyle} onClick={() => closeDialog(null)}>取消</button>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => {
            const normalized = dialog.reason.trim();
            if (!normalized) {
              setDialog((current) => (current ? { ...current, error: '请填写操作原因' } : current));
              return;
            }
            closeDialog(normalized);
          }}
        >
          确认执行
        </button>
      </div>
    </AdminModal>
  ) : null;

  return { requestOperationReason, reasonDialog };
};
