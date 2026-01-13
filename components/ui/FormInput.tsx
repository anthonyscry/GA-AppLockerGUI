import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormInputProps {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  id,
  type = 'text',
  required = false,
  error,
  helpText,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const helpId = helpText && !error ? `${id}-help` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="Required field">*</span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`
          w-full px-4 py-2.5 min-h-[44px]
          border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-all
          ${error ? 'border-red-500' : 'border-slate-300'}
          ${disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}
        `}
      />
      {error && (
        <span id={errorId} role="alert" className="block text-sm text-red-600 mt-1 flex items-center space-x-1">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </span>
      )}
      {helpText && !error && (
        <span id={helpId} className="block text-xs text-slate-500 mt-1">
          {helpText}
        </span>
      )}
    </div>
  );
};
