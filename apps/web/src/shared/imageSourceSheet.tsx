import { createRoot, type Root } from 'react-dom/client';

export type ImageSource = 'camera' | 'gallery';

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  background: 'rgba(58, 42, 30, 0.34)',
  WebkitBackdropFilter: 'blur(4px)',
  backdropFilter: 'blur(4px)',
};

const SHEET: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  margin: '0 12px 16px',
  padding: '18px 16px 12px',
  borderRadius: '26px',
  background: '#FFFBF6',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  boxShadow: '0 18px 44px rgba(115, 58, 16, 0.2)',
  display: 'grid',
  gap: '10px',
};

const TITLE: React.CSSProperties = {
  margin: '0 0 4px',
  textAlign: 'center',
  fontFamily: 'var(--nl-font-display, "Noto Serif SC", serif)',
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--nl-ink, #3A2A1E)',
};

const OPTION: React.CSSProperties = {
  minHeight: '52px',
  borderRadius: '999px',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  background: 'rgba(255, 250, 244, 0.92)',
  color: '#8A4E14',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
};

const CANCEL: React.CSSProperties = {
  minHeight: '48px',
  borderRadius: '999px',
  border: 'none',
  background: 'transparent',
  color: '#8B7160',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
};

/**
 * 自研「拍照 / 从相册选择」底部面板。
 * 系统相册与相机本身无法自绘，但入口选择必须由我们控制。
 */
export const chooseImageSource = (title = '选择照片'): Promise<ImageSource | null> => new Promise((resolve) => {
  if (typeof document === 'undefined') {
    resolve(null);
    return;
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root | null = createRoot(host);
  let settled = false;

  const close = (value: ImageSource | null) => {
    if (settled) return;
    settled = true;
    resolve(value);
    window.setTimeout(() => {
      root?.unmount();
      root = null;
      host.remove();
    }, 120);
  };

  root.render(
    <div
      style={OVERLAY}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close(null);
      }}
    >
      <div style={SHEET} role="dialog" aria-modal="true" aria-label={title}>
        <p style={TITLE}>{title}</p>
        <button type="button" style={OPTION} onClick={() => close('camera')}>拍照</button>
        <button type="button" style={OPTION} onClick={() => close('gallery')}>从相册选择</button>
        <button type="button" style={CANCEL} onClick={() => close(null)}>取消</button>
      </div>
    </div>,
  );
});
