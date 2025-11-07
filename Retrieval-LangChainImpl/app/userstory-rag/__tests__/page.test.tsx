import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RadialScore } from '../page';

describe('RadialScore component', () => {
  it('renders the percentage text', () => {
    render(<RadialScore score={82} size={120} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('shows grade text for different scores', () => {
    render(<RadialScore score={45} size={120} />);
    // grade D/C/B like text present
    expect(screen.getByText(/D|C|B|A/)).toBeTruthy();
  });
});
