interface Props {
    title: string;
    onMenuClick: () => void;
    onRegisterClick: () => void;
  }
  
  export default function VacationHeader({ title, onMenuClick, onRegisterClick }: Props) {
    return (
      <div className="w-full bg-white border-b border-gray-200">
       <div className="h-[64px] flex items-center justify-between px-6 md:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <span className="text-xl leading-none">☰</span>
            </button>
  
            <h1 className="text-[20px] font-extrabold text-gray-900">{title}</h1>
          </div>
  
          <button
            type="button"
            onClick={onRegisterClick}
            className="inline-flex items-center gap-2 bg-[#2F3A4A] text-white font-bold px-4 py-2 rounded-xl hover:opacity-95 active:translate-y-[1px]"
          >
            <span className="text-lg leading-none">＋</span>
            휴가등록
          </button>
        </div>
      </div>
    );
  }
  