import React from 'react';
import { Mail, X } from 'lucide-react';

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  theme?: 'light' | 'dark';
  errorMessage?: string;
}

export const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChange,
  placeholder = '알림을 수신할 이메일 주소 (예: user@example.com)',
  disabled = false,
  required = true,
  theme = 'light',
  errorMessage
}) => {
  const isDark = theme === 'dark';

  const handleClear = () => {
    onChange('');
  };

  const isInvalidFormat = value.trim().length > 0 && !isValidEmail(value);

  return (
    <div className="w-full space-y-1.5 text-left">
      <div className="relative flex items-center">
        {/* Left Mail Icon */}
        <Mail className={`w-4 h-4 absolute left-3.5 pointer-events-none transition-colors ${
          isDark ? 'text-slate-400' : 'text-slate-400'
        }`} />

        {/* Input Field */}
        <input
          type="email"
          required={required}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full pl-10 pr-10 py-3 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:ring-2 disabled:opacity-50 ${
            isDark
              ? 'bg-slate-800/90 text-white placeholder-slate-500 border border-slate-700 focus:ring-brand-500 focus:border-transparent'
              : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:ring-brand-500 focus:border-transparent'
          } ${isInvalidFormat ? 'border-rose-400 focus:ring-rose-400' : ''}`}
        />

        {/* Right 'X' Clear Button */}
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute right-3 p-1 rounded-full transition-colors ${
              isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-700' 
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="내용 전체 지우기"
            aria-label="이메일 입력 지우기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Validation Message */}
      {isInvalidFormat && (
        <p className="text-xs text-rose-500 font-medium px-1 animate-slideUp">
          올바른 이메일 형식(예: name@example.com)을 입력해 주세요.
        </p>
      )}

      {errorMessage && !isInvalidFormat && (
        <p className="text-xs text-rose-500 font-medium px-1 animate-slideUp">
          {errorMessage}
        </p>
      )}
    </div>
  );
};
