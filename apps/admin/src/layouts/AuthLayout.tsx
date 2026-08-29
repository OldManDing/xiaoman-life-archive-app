import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div
      className="admin-auth-layout"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="admin-auth-container"
        style={{
          width: '100%',
          maxWidth: '980px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};
