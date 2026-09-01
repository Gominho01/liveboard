import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the login form when logged out', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /log in to liveboard/i })).toBeInTheDocument();
  });

  it('lets a visitor switch to the register form', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /need an account/i }));
    expect(screen.getByRole('heading', { name: /create your liveboard account/i })).toBeInTheDocument();
  });
});
