import { Outlet } from 'react-router-dom';

export const PublicLayout = () => {
  return (
    <div
      className="public-layout"
      style={{
        minHeight: '100dvh',
        maxWidth: '430px',
        margin: '0 auto',
        background: 'linear-gradient(180deg, #050918 0%, #0b1130 52%, #050918 100%)',
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
