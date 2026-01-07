import React from "react";
import { IconMenu } from "../icons/Icons";

interface HeaderProps {
    title: string;
    onMenuClick?: () => void;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export default function Header({
    title,
    onMenuClick,
    leftContent,
    rightContent,
}: HeaderProps) {
    return (
        <div className="sticky top-0 z-10 shrink-0 bg-white border-b border-gray-200 px-4 lg:px-10 h-18 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                        aria-label="메뉴 열기"
                    >
                        <IconMenu />
                    </button>
                )}
                {leftContent && <div>{leftContent}</div>}
                <h1 className="text-[24px] font-semibold text-gray-800">
                    {title}
                </h1>
            </div>
            {rightContent && (
                <div className="flex items-center gap-2">{rightContent}</div>
            )}
        </div>
    );
}
