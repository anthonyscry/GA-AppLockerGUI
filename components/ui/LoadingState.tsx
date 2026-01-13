import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  fullScreen = false 
}) => (
  <div 
    className={`flex items-center justify-center ${fullScreen ? 'h-screen' : 'h-64'}`}
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="animate-spin text-blue-600" size={32} aria-hidden="true" />
      <span className="sr-only">{message}</span>
      <span className="text-slate-600 font-medium" aria-hidden="true">{message}</span>
    </div>
  </div>
);
