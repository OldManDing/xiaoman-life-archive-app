import { Outlet } from 'react-router-dom';

export const PublicLayout = () => {
  return (
    <div
      className="public-layout"
      style={{
        minHeight: '100dvh',
        maxWidth: '430px',
        margin: '0 auto',
        background: 'var(--nl-page-bg)',
        color: 'var(--nl-ink)',
        overflowX: 'hidden',
        padding: '0 0 40px',
        boxSizing: 'border-box',
      }}
    >
      <Outlet />
    </div>
  );
};
