import { useEffect, useRef } from "react";

type Props = {
  isOpen: boolean;
  anchorEl: HTMLElement | null; // ... 버튼 DOM
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function IconEdit() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"
        fill="currentColor"
      />
      <path
        d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 7h12l-1 14H7L6 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MemberActionMenu({
  isOpen,
  anchorEl,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!isOpen) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorEl?.contains(t)) return;
      onClose();
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, anchorEl, onClose]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();

  // 캡처처럼 ... 오른쪽 아래에 살짝 내려서 붙여줌
  const top = rect.bottom + 8;
  const left = rect.right - 220; // 메뉴 폭 기준으로 오른쪽 정렬

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        ref={menuRef}
        className="fixed w-[220px] bg-white rounded-2xl shadow-xl border border-[#e5e7eb] overflow-hidden"
        style={{ top, left }}
      >
        <button
          className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#f2f4f7] transition"
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          <span className="text-[#98A2B3]">
            <IconEdit />
          </span>
          <span className="text-[18px] font-semibold text-[#101828]">수정</span>
        </button>

        <button
          className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#f2f4f7] transition"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <span className="text-[#98A2B3]">
            <IconTrash />
          </span>
          <span className="text-[18px] font-semibold text-[#101828]">삭제</span>
        </button>
      </div>
    </div>
  );
}
