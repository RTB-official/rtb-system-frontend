import React from "react";

interface TabItem {
    value: string;
    label: string;
}

interface TabsProps {
    items: TabItem[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export default function Tabs({
    items,
    value,
    onChange,
    className = "",
}: TabsProps) {
    return (
        <div className={`flex gap-1 border-b border-gray-200 ${className}`}>
            {items.map((item) => (
                <button
                    key={item.value}
                    onClick={() => onChange(item.value)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        value === item.value
                            ? "text-gray-900 border-b-2 border-gray-900"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

