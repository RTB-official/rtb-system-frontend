import React from 'react';

const IconArrowDown = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 10L12 15L17 10H7Z" fill="#101828" />
  </svg>
);

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export default function Select({ 
  label, 
  placeholder = '선택', 
  required = false, 
  className = '',
  options = [],
  value = '',
  onChange,
  disabled = false,
}: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
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
      <div className={`bg-white border border-[#e5e7eb] rounded-xl flex items-center justify-between px-4 py-3 relative ${disabled ? 'bg-gray-50' : ''}`}>
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={`font-semibold text-[16px] leading-[1.5] ${value ? 'text-[#101828]' : 'text-[#99a1af]'}`}>
          {value ? (options.find(o => o.value === value)?.label || value) : placeholder}
        </span>
        <IconArrowDown />
      </div>
    </div>
  );
}
