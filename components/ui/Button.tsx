import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  className?: string;
}

const buttonVariants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
  success: "bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  ariaLabel,
  className = '',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    aria-busy={loading}
    aria-label={ariaLabel}
    className={`
      min-h-[44px] min-w-[44px]
      px-4 py-2.5
      rounded-lg
      font-bold text-sm
      transition-all
      focus:outline-none
      disabled:opacity-50 disabled:cursor-not-allowed
      ${buttonVariants[variant]}
      ${className}
    `}
  >
    {loading ? (
      <>
        <Loader2 className="animate-spin mr-2 inline" size={16} aria-hidden="true" />
        <span className="sr-only">Loading</span>
        <span aria-hidden="true">{children}</span>
      </>
    ) : (
      children
    )}
  </button>
);
