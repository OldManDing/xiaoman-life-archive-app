import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from '../shared/auth';

const renderWithRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

describe('App', () => {
  it('redirects to login when not authenticated', () => {
    renderWithRouter('/');
    expect(screen.getByText('管理员登录')).toBeInTheDocument();
  });

  it('renders admin shell when authenticated', () => {
    renderWithRouter('/login');
    expect(screen.getByText('进入管理后台')).toBeInTheDocument();
  });
});
