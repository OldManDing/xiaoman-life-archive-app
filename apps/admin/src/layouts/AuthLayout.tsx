import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div
      className="admin-auth-layout"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 15% 18%, rgba(214, 168, 109, 0.34), transparent 28%), radial-gradient(circle at 85% 10%, rgba(18, 60, 55, 0.26), transparent 34%), linear-gradient(135deg, #f8f3ea 0%, #e7eee9 52%, #d6e2dc 100%)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 'auto -120px -160px auto',
          width: '360px',
          height: '360px',
          borderRadius: '999px',
          border: '1px solid rgba(18, 60, 55, 0.12)',
          boxShadow: 'inset 0 0 0 28px rgba(255,255,255,0.18)',
        }}
      />
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
