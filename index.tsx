import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './src/presentation/contexts/ErrorBoundary';
import { AppProvider } from './src/presentation/contexts/AppContext';
import { setupContainer } from './src/infrastructure/di/setup';
import './src/index.css';

// Setup dependency injection container
setupContainer();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
