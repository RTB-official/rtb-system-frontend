import React, { useState, useEffect, useRef } from "react";

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
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        const activeIndex = items.findIndex((item) => item.value === value);
        const activeTab = tabRefs.current[activeIndex];

        if (activeTab) {
            setIndicatorStyle({
                left: activeTab.offsetLeft,
                width: activeTab.offsetWidth,
            });
        }
    }, [value, items]);

    return (
        <div
            className={`relative flex gap-1 border-b border-gray-200 ${className}`}
        >
            {items.map((item, index) => (
                <button
                    key={item.value}
                    ref={(el) => {
                        tabRefs.current[index] = el;
                    }}
                    onClick={() => onChange(item.value)}
                    className={`relative z-10 px-4 py-2 text-[15px] font-medium transition-all duration-200 rounded-lg ${
                        value === item.value
                            ? "text-gray-900"
                            : "text-gray-400 hover:text-gray-500"
                    }`}
                >
                    {item.label}
                </button>
            ))}
            {/* Sliding Underline Indicator */}
            <div
                className="absolute bottom-[-1px] h-[2.5px] bg-gray-900 transition-all duration-300 ease-out"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                }}
            />
        </div>
    );
}
