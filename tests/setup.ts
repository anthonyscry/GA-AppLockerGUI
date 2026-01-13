/**
 * Jest Test Setup
 * Global test configuration and mocks
 */

// Mock Electron APIs
global.window = {
  ...global.window,
  electron: {
    ipc: {
      invoke: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    },
  },
} as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup DOM environment
import '@testing-library/jest-dom';
