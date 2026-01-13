/**
 * Test Utilities
 * Helper functions for testing React components
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProvider } from '../../src/presentation/contexts/AppContext';

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <AppProvider>{children}</AppProvider>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
