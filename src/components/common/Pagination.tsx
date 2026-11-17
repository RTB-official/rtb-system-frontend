import React from "react";
import { IconChevronLeft, IconChevronRight } from "../icons/Icons";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

/** 현재 페이지 주변 + 양끝만 노출. 나머지는 말줄임. */
function getVisiblePages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(currentPage);

    for (let offset = 1; offset <= 1; offset++) {
        if (currentPage - offset >= 1) pages.add(currentPage - offset);
        if (currentPage + offset <= totalPages) pages.add(currentPage + offset);
    }

    // 시작/끝 근처면 이웃을 더 채워 버튼 개수를 맞춤
    if (currentPage <= 3) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }
    if (currentPage >= totalPages - 2) {
        pages.add(totalPages - 1);
        pages.add(totalPages - 2);
        pages.add(totalPages - 3);
    }

    const sorted = Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

    const result: (number | "ellipsis")[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const page = sorted[i];
        if (i > 0 && page - sorted[i - 1] > 1) {
            result.push("ellipsis");
        }
        result.push(page);
    }
    return result;
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className = "",
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const visiblePages = getVisiblePages(currentPage, totalPages);

    return (
        <div className={`flex items-center justify-center gap-1 mt-4 ${className}`}>
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="이전 페이지"
            >
                <IconChevronLeft className="w-4 h-4" />
            </button>
            {visiblePages.map((item, index) => {
                if (item === "ellipsis") {
                    return (
                        <span
                            key={`ellipsis-${index}`}
                            className="w-[30px] h-[30px] flex items-center justify-center text-sm text-gray-400"
                            aria-hidden
                        >
                            …
                        </span>
                    );
                }

                const active = item === currentPage;
                return (
                    <button
                        type="button"
                        key={item}
                        onClick={() => onPageChange(item)}
                        className={`w-[30px] h-[30px] flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            active
                                ? "bg-gray-100 text-gray-900"
                                : "text-gray-500 hover:bg-gray-50"
                        }`}
                        aria-current={active ? "page" : undefined}
                        aria-label={`${item}페이지`}
                    >
                        {item}
                    </button>
                );
            })}
            <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="다음 페이지"
            >
                <IconChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}
