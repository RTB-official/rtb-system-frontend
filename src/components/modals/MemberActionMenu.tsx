import { useEffect, useRef } from "react";
import { IconEdit, IconTrash } from "../icons/Icons";

type Props = {
  isOpen: boolean;
  anchorEl: HTMLElement | null; // ... 버튼 DOM
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

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
            <IconEdit className="w-[22px] h-[22px]" />
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
            <IconTrash className="w-[22px] h-[22px]" />
          </span>
          <span className="text-[18px] font-semibold text-[#101828]">삭제</span>
        </button>
      </div>
    </div>
  );
}
