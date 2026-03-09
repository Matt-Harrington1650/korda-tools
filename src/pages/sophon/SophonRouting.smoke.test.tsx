// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SophonLayout } from './SophonLayout';
import { SophonDashboardPage } from './SophonDashboardPage';

describe('Sophon routing smoke', () => {
  it('renders Sophon shell and dashboard route', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sophon/dashboard']}>
          <Routes>
            <Route element={<SophonLayout />} path="/sophon">
              <Route element={<SophonDashboardPage />} path="dashboard" />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Sophon')).toBeInTheDocument();
    expect(await screen.findByText('System Health')).toBeInTheDocument();
  });
});
