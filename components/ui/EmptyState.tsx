import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => (
  <div className={`text-center py-12 ${className}`} role="status">
    <Icon className="mx-auto text-slate-300 mb-4" size={48} aria-hidden="true" />
    <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-500 text-sm mb-4 max-w-md mx-auto">
      {description}
    </p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all min-h-[44px] min-w-[44px]"
        aria-label={actionLabel}
      >
        {actionLabel}
      </button>
    )}
  </div>
);
