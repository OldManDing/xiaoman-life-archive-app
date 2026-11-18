import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export type AppConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
};

type DialogState = Required<Pick<AppConfirmOptions, 'title' | 'confirmText' | 'cancelText' | 'tone'>> & {
  message?: string;
};

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'grid',
  placeItems: 'center',
  padding: '24px 20px',
  background: 'rgba(58, 42, 30, 0.34)',
  WebkitBackdropFilter: 'blur(6px)',
  backdropFilter: 'blur(6px)',
};

const CARD_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: '330px',
  padding: '22px 20px 18px',
  borderRadius: '26px',
  background: '#FFFBF6',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  boxShadow: '0 18px 44px rgba(115, 58, 16, 0.18)',
  display: 'grid',
  gap: '10px',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--nl-font-display, "Noto Serif SC", serif)',
  fontSize: '20px',
  fontWeight: 600,
  lineHeight: 1.35,
  color: 'var(--nl-ink, #3A2A1E)',
  textAlign: 'center',
};

const MESSAGE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  lineHeight: 1.75,
  color: 'var(--nl-muted-strong, #6F5745)',
  textAlign: 'center',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  marginTop: '8px',
};

const BASE_BUTTON: React.CSSProperties = {
  minHeight: '48px',
  height: '48px',
  borderRadius: '999px',
  border: '1px solid transparent',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CANCEL_BUTTON: React.CSSProperties = {
  ...BASE_BUTTON,
  background: 'rgba(255, 250, 244, 0.9)',
  border: '1px solid rgba(120, 80, 40, 0.16)',
  color: 'var(--nl-muted-strong, #6F5745)',
};

const ConfirmDialog = ({ state, onResolve }: { state: DialogState; onResolve: (value: boolean) => void }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResolve(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onResolve]);

  const confirmStyle: React.CSSProperties = {
    ...BASE_BUTTON,
    background: state.tone === 'danger' ? '#A8482C' : '#A9581B',
    color: '#FFFFFF',
    boxShadow: state.tone === 'danger'
      ? '0 10px 22px rgba(168, 72, 44, 0.18)'
      : '0 10px 22px rgba(146, 96, 52, 0.18)',
  };

  return (
    <div
      style={OVERLAY_STYLE}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        style={CARD_STYLE}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby={state.message ? 'app-confirm-message' : undefined}
      >
        <h2 id="app-confirm-title" style={TITLE_STYLE}>{state.title}</h2>
        {state.message ? <p id="app-confirm-message" style={MESSAGE_STYLE}>{state.message}</p> : null}
        <div style={ACTIONS_STYLE}>
          <button type="button" style={CANCEL_BUTTON} onClick={() => onResolve(false)}>{state.cancelText}</button>
          <button ref={confirmRef} type="button" style={confirmStyle} onClick={() => onResolve(true)}>{state.confirmText}</button>
        </div>
      </div>
    </div>
  );
};

/**
 * 品牌风格确认弹层，替代 window.confirm。
 * 用法：`if (!(await appConfirm({ title: '...' }))) return;`
 */
export const appConfirm = (options: AppConfirmOptions): Promise<boolean> => new Promise((resolve) => {
  if (typeof document === 'undefined') {
    resolve(false);
    return;
  }

  const host = document.createElement('div');
  host.setAttribute('data-app-confirm', 'true');
  document.body.appendChild(host);
  let root: Root | null = createRoot(host);
  let settled = false;

  const cleanup = (value: boolean) => {
    if (settled) return;
    settled = true;
    resolve(value);
    // 让点击动效走完再卸载
    window.setTimeout(() => {
      root?.unmount();
      root = null;
      host.remove();
    }, 120);
  };

  const state: DialogState = {
    title: options.title,
    message: options.message,
    confirmText: options.confirmText ?? '确定',
    cancelText: options.cancelText ?? '取消',
    tone: options.tone ?? 'default',
  };

  root.render(<ConfirmDialog state={state} onResolve={cleanup} />);
});
