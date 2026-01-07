import React from "react";
import { IconChevronLeft, IconChevronRight } from "../icons/Icons";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className = "",
}: PaginationProps) {
    return (
        <div className={`flex items-center justify-center gap-1 mt-4 ${className}`}>
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <IconChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                const active = page === currentPage;
                return (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`w-[30px] h-[30px] flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            active
                                ? "bg-gray-100 text-gray-900"
                                : "text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                        {page}
                    </button>
                );
            })}
            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <IconChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

