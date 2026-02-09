import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from '@/popup/components/Header';

describe('Header', () => {
  it('renders the app name', () => {
    render(<Header />);
    expect(screen.getByText('LinkedIntel')).toBeInTheDocument();
  });

  it('shows the beta badge', () => {
    render(<Header />);
    expect(screen.getByText('beta')).toBeInTheDocument();
  });
});
