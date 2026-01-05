import React from "react";

type MonthNavigatorProps = {
  onPrev: () => void;
  onToday?: () => void;
  onNext: () => void;
  className?: string;
};

export default function MonthNavigator({
  onPrev,
  onToday,
  onNext,
  className = "",
}: MonthNavigatorProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={onPrev}
        className="px-3 py-1 rounded-md border text-sm bg-white"
        aria-label="previous-month"
      >
        ‹
      </button>
      {onToday && (
        <button
          onClick={onToday}
          className="px-3 py-1 rounded-md border text-sm bg-white"
          aria-label="today"
        >
          오늘
        </button>
      )}
      <button
        onClick={onNext}
        className="px-3 py-1 rounded-md border text-sm bg-white"
        aria-label="next-month"
      >
        ›
      </button>
    </div>
  );
}


