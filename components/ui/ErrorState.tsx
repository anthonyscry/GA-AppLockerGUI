import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title, 
  message, 
  onRetry,
  className = '' 
}) => (
  <div 
    role="alert" 
    className={`bg-red-50 border-l-4 border-red-500 p-4 rounded ${className}`}
  >
    <div className="flex items-start">
      <AlertCircle className="text-red-500 mr-3 mt-0.5 shrink-0" size={20} aria-hidden="true" />
      <div className="flex-1">
        <h3 className="font-bold text-red-800">{title}</h3>
        <p className="text-red-700 text-sm mt-1">{message}</p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="mt-3 text-sm font-bold text-red-800 hover:text-red-900 underline flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
            aria-label="Retry operation"
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  </div>
);
