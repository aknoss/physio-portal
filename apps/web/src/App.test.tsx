import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('boots and renders the public login page for unauthenticated users', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument(),
    );
  });
});
