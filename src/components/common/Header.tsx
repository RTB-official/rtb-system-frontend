//header.tsx
import React from "react";
import { IconMenu } from "../icons/Icons";

interface HeaderProps {
    title: string;
    onMenuClick?: () => void;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    bottomContent?: React.ReactNode;
}

export default function Header({
    title,
    onMenuClick,
    leftContent,
    rightContent,
    bottomContent,
}: HeaderProps) {
    return (
        <div className="sticky top-0 z-10 shrink-0 bg-white border-b border-gray-200 flex flex-col">
            <div className="px-3 md:px-4 lg:px-10 h-14 md:h-18 flex items-center justify-between gap-2 min-h-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {onMenuClick && (
                        <button
                            onClick={onMenuClick}
                            className="lg:hidden p-1.5 md:p-2 rounded-lg hover:bg-gray-100 text-gray-700 shrink-0"
                            aria-label="메뉴 열기"
                        >
                            <IconMenu />
                        </button>
                    )}
                    {leftContent && <div className="shrink-0">{leftContent}</div>}
                    <h1 className="text-base md:text-[24px] font-semibold text-gray-800 truncate">
                        {title}
                    </h1>
                </div>
                {rightContent && (
                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">{rightContent}</div>
                )}
            </div>
            {bottomContent && <div>{bottomContent}</div>}
        </div>
    );
}
