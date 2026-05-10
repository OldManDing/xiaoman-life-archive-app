import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#eef2f1',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};
