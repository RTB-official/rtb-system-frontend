import React from 'react';
import RequiredIndicator from './RequiredIndicator';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: 'text' | 'date' | 'number' | 'time';
  disabled?: boolean;
  uppercase?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: string;
}

export default function TextInput({ 
  label, 
  placeholder, 
  required = false, 
  icon, 
  className = '',
  value,
  onChange,
  onKeyDown,
  type = 'text',
  disabled = false,
  uppercase = false,
  inputRef,
  error,
}: TextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (uppercase) val = val.toUpperCase();
    onChange?.(val);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex items-center">
          <label className="font-medium text-[14px] md:text-[15px] text-[#101828] leading-[1.467]">
            {label}
          </label>
          {required && <RequiredIndicator />}
        </div>
      )}
      <div className={`bg-white border ${error ? 'border-red-300' : 'border-[#e5e7eb]'} rounded-xl h-12 flex items-center overflow-hidden p-3 ${disabled ? 'bg-gray-50' : ''}`}>
        <div className="flex-1 flex items-center justify-between min-h-[24px] px-1">
          <input
            ref={inputRef}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            className="flex-1 font-normal text-[16px] text-[#101828] leading-[1.5] placeholder:text-[#99a1af] outline-none disabled:bg-transparent disabled:text-gray-400"
          />
          {icon}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
