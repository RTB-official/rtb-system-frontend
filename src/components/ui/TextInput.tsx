import React from 'react';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'date' | 'number' | 'time';
  disabled?: boolean;
  uppercase?: boolean;
}

export default function TextInput({ 
  label, 
  placeholder, 
  required = false, 
  icon, 
  className = '',
  value,
  onChange,
  type = 'text',
  disabled = false,
  uppercase = false,
}: TextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (uppercase) val = val.toUpperCase();
    onChange?.(val);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex gap-1 items-center">
          <label className="font-medium text-[14px] md:text-[15px] text-[#101828] leading-[1.467]">
            {label}
          </label>
          {required && <span className="text-[#e7000b] text-[15px]">*</span>}
        </div>
      )}
      <div className={`bg-white border border-[#e5e7eb] rounded-xl h-12 flex items-center overflow-hidden p-3 ${disabled ? 'bg-gray-50' : ''}`}>
        <div className="flex-1 flex items-center justify-between min-h-[24px] px-1">
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="flex-1 font-normal text-[16px] text-[#101828] leading-[1.5] placeholder:text-[#99a1af] outline-none disabled:bg-transparent disabled:text-gray-400"
          />
          {icon}
        </div>
      </div>
    </div>
  );
}
