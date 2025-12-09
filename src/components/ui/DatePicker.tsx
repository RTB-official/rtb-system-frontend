import { useState, useRef, useEffect, useCallback } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface PopupPosition {
  top: number;
  left: number;
}

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8ZM9 14H7V12H9V14ZM13 14H11V12H13V14ZM17 14H15V12H17V14ZM9 18H7V16H9V18ZM13 18H11V16H13V18ZM17 18H15V16H17V18Z" fill="currentColor" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z" fill="currentColor" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z" fill="currentColor" />
  </svg>
);

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function DatePicker({ value, onChange, placeholder = '날짜 선택', className = '' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // 팝업 위치 계산
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const popupHeight = 400; // 예상 팝업 높이
    const popupWidth = 320;
    
    let top = rect.bottom + 8;
    let left = rect.left;
    
    // 화면 하단을 벗어나면 위로 표시
    if (top + popupHeight > window.innerHeight) {
      top = rect.top - popupHeight - 8;
    }
    
    // 화면 우측을 벗어나면 조정
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 16;
    }
    
    // 최소값 보정
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    
    setPopupPosition({ top, left });
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 열릴 때 위치 계산
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  // 스크롤/리사이즈 시 위치 재계산
  useEffect(() => {
    if (!isOpen) return;
    
    const handleUpdate = () => calculatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, calculatePosition]);

  // 값 변경 시 viewDate 동기화
  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  const selectedDate = value ? new Date(value) : null;

  // 현재 월의 날짜들 계산
  const getDaysInMonth = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // 이전 월 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // 현재 월 날짜
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handleDateClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange(dateStr);
    setViewDate(today);
    setIsOpen(false);
  };

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    const date = new Date(value);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      viewDate.getFullYear() === today.getFullYear() &&
      viewDate.getMonth() === today.getMonth() &&
      day === today.getDate()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      viewDate.getFullYear() === selectedDate.getFullYear() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      day === selectedDate.getDate()
    );
  };

  const days = getDaysInMonth();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 입력 필드 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[14px] bg-white hover:border-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {formatDisplayValue()}
        </span>
        <span className="text-slate-400">
          <IconCalendar />
        </span>
      </button>

      {/* 달력 팝업 */}
      {isOpen && (
        <div 
          ref={popupRef}
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[320px]"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
            >
              <IconChevronLeft />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[18px] text-slate-800">
                {viewDate.getFullYear()}년
              </span>
              <span className="font-bold text-[18px] text-slate-800">
                {MONTHS[viewDate.getMonth()]}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
            >
              <IconChevronRight />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, idx) => (
              <div
                key={day}
                className={`text-center text-[13px] font-semibold py-2 ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-slate-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const dayOfWeek = idx % 7;
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className={`
                    h-10 rounded-xl text-[14px] font-medium transition-all
                    ${selected 
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-200' 
                      : today
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : dayOfWeek === 0 
                          ? 'text-rose-500 hover:bg-rose-50' 
                          : dayOfWeek === 6 
                            ? 'text-blue-500 hover:bg-blue-50' 
                            : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleToday}
              className="px-4 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

