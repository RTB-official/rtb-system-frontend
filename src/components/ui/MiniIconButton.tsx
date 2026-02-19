import React from "react";

interface MiniIconButtonProps {
    icon: React.ReactNode;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    title?: string;
    className?: string;
}

export default function MiniIconButton({
    icon,
    onClick,
    title,
    className = "",
}: MiniIconButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center ${className}`}
        >
            {icon}
        </button>
    );
}
