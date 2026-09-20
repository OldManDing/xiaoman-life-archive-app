import { useEffect, useRef, useState } from 'react';

import { AdminModal } from './modal';
import { primaryButtonStyle, secondaryButtonStyle } from './uiStyles';

export type OperationReasonContext = {
  /** 受影响对象，例如「小满妈妈（13800000000）」或「媒体 m_001 · 图片」。 */
  target: string;
  /** 这次操作的业务后果，例如「下架后用户端不再展示该媒体」。 */
  consequence?: string;
};

export const useOperationReasonDialog = () => {
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{
    actionName: string;
    context: OperationReasonContext | null;
    reason: string;
    error: string | null;
  } | null>(null);

  // context 用来在确认框里回显「对谁做了什么、会造成什么后果」。
  // 破坏性操作此前只有一个标题 + 输入框，管理员很容易点错行还不自知。
  const requestOperationReason = (actionName: string, context?: OperationReasonContext) =>
    new Promise<string | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setDialog({ actionName, context: context ?? null, reason: '', error: null });
    });

  const closeDialog = (value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const reasonDialog = dialog ? (
    <AdminModal open title={dialog.actionName} eyebrow="后台操作确认" onClose={() => closeDialog(null)}>
      {dialog.context ? (
        <div className="admin-modal-context">
          <p className="admin-modal-subtitle">对象：{dialog.context.target}</p>
          {dialog.context.consequence ? <p className="admin-modal-consequence">{dialog.context.consequence}</p> : null}
        </div>
      ) : null}
      <label className="admin-modal-field">
        操作原因
        <textarea
          value={dialog.reason}
          maxLength={200}
          onChange={(event) => setDialog((current) => (current ? { ...current, reason: event.target.value, error: null } : current))}
          placeholder="写清楚为什么要执行这次操作，方便审计复盘（至少 2 个字）"
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
            // 后端所有动作 DTO 都对 reason 有 @MinLength(2) 约束，前端必须同口径校验，
            // 否则用户填一个字只会换来一次 400。
            if (normalized.length < 2) {
              setDialog((current) => (current ? { ...current, error: '操作原因至少需要 2 个字' } : current));
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
