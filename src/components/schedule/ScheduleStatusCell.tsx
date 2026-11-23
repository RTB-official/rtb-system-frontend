import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ActionMenu from "../common/ActionMenu";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import {
    formatScheduleStatusCellValue,
    getScheduleStatusOptions,
    parseScheduleStatusCellValue,
    resolveScheduleStatusOption,
    type ScheduleStatusField,
} from "./scheduleStatusOptions";

type ScheduleStatusCellProps = {
    field: ScheduleStatusField;
    value: string;
    onChange?: (value: string) => void;
    /** false면 뱃지/상세만 표시 (목록) */
    editable?: boolean;
    locked?: boolean;
};

type OpenMenu = "badge" | "detail" | null;

const DETAIL_BOX_CLASS =
    "rounded-md border border-gray-200 bg-gray-50 px-1.5 text-left outline-none";

/** 상세내용 축소 박스 + 호버 시 같은 박스가 아래로 펼쳐지는 미리보기 */
function DetailPreviewBox({
    detailPreview,
    canEdit,
    menuOpen,
    onOpenDetail,
}: {
    detailPreview: string;
    canEdit: boolean;
    menuOpen: boolean;
    onOpenDetail?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
    const boxRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
    const hideTimerRef = useRef<number | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [grown, setGrown] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const clearHideTimer = () => {
        if (hideTimerRef.current != null) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const showExpanded = () => {
        if (!detailPreview || menuOpen) return;
        clearHideTimer();
        const el = boxRef.current;
        if (!el) return;
        setRect(el.getBoundingClientRect());
        setExpanded(true);
    };

    const scheduleHide = () => {
        clearHideTimer();
        hideTimerRef.current = window.setTimeout(() => {
            setGrown(false);
            setExpanded(false);
            hideTimerRef.current = null;
        }, 120);
    };

    useEffect(() => {
        if (menuOpen) {
            setGrown(false);
            setExpanded(false);
        }
    }, [menuOpen]);

    useEffect(() => {
        if (!expanded || !rect) {
            setGrown(false);
            return;
        }
        setGrown(false);
        const frame = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => setGrown(true));
        });
        return () => window.cancelAnimationFrame(frame);
    }, [expanded, rect?.top, rect?.left, rect?.width, rect?.height]);

    useEffect(() => {
        if (!expanded) return;
        const update = () => {
            const el = boxRef.current;
            if (el) setRect(el.getBoundingClientRect());
        };
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [expanded]);

    useEffect(
        () => () => {
            clearHideTimer();
        },
        []
    );

    const oneLine = detailPreview
        ? detailPreview.replace(/\s+/gu, " ")
        : "상세 내용";
    const showPortal = Boolean(expanded && rect && detailPreview && !menuOpen);

    const openFromPortal = (event: React.SyntheticEvent) => {
        if (!canEdit) return;
        event.preventDefault();
        event.stopPropagation();
        clearHideTimer();
        setGrown(false);
        setExpanded(false);
        // 원본 상세 박스 클릭과 동일하게 팝오버 오픈
        queueMicrotask(() => {
            boxRef.current?.click();
        });
    };

    return (
        <>
            {canEdit ? (
                <button
                    ref={boxRef as React.RefObject<HTMLButtonElement>}
                    type="button"
                    onClick={onOpenDetail}
                    onMouseEnter={showExpanded}
                    onMouseLeave={scheduleHide}
                    className={`h-[22px] w-full shrink-0 overflow-hidden ${DETAIL_BOX_CLASS} transition-colors hover:border-gray-300 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-sky-300 ${
                        showPortal ? "invisible" : ""
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="상세 내용 편집"
                >
                    <p
                        className={`truncate text-[10px] leading-[20px] ${
                            detailPreview ? "text-gray-700" : "text-gray-400"
                        }`}
                    >
                        {oneLine}
                    </p>
                </button>
            ) : (
                <div
                    ref={boxRef as React.RefObject<HTMLDivElement>}
                    onMouseEnter={showExpanded}
                    onMouseLeave={scheduleHide}
                    className={`h-[22px] w-full shrink-0 overflow-hidden ${DETAIL_BOX_CLASS} ${
                        showPortal ? "invisible" : ""
                    }`}
                >
                    <p className="truncate text-[10px] leading-[20px] text-gray-700">
                        {oneLine}
                    </p>
                </div>
            )}

            {showPortal && rect
                ? createPortal(
                      <div
                          role={canEdit ? "button" : "tooltip"}
                          tabIndex={canEdit ? 0 : undefined}
                          style={{
                              position: "fixed",
                              top: rect.top,
                              left: rect.left,
                              width: rect.width,
                              maxHeight: grown ? 160 : rect.height,
                              zIndex: 80,
                              transition:
                                  "max-height 180ms ease, box-shadow 180ms ease",
                          }}
                          className={`${DETAIL_BOX_CLASS} overflow-hidden ${
                              grown ? "py-0.5 shadow-sm" : "shadow-none"
                          } ${canEdit ? "cursor-pointer hover:border-gray-300 hover:bg-gray-100" : ""}`}
                          onMouseEnter={showExpanded}
                          onMouseLeave={scheduleHide}
                          onClick={openFromPortal}
                          onKeyDown={(event) => {
                              if (
                                  canEdit &&
                                  (event.key === "Enter" || event.key === " ")
                              ) {
                                  event.preventDefault();
                                  openFromPortal(event);
                              }
                          }}
                      >
                          <p
                              className={`text-[10px] leading-[20px] text-gray-700 ${
                                  grown
                                      ? "whitespace-pre-wrap break-words"
                                      : "truncate"
                              }`}
                          >
                              {grown ? detailPreview : oneLine}
                          </p>
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}

export default function ScheduleStatusCell({
    field,
    value,
    onChange,
    editable = true,
    locked = false,
}: ScheduleStatusCellProps) {
    const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const parsed = parseScheduleStatusCellValue(field, value);
    const [draftStatus, setDraftStatus] = useState(parsed.status);
    const [draftDetail, setDraftDetail] = useState(parsed.detail);
    const options = getScheduleStatusOptions(field);
    const current = resolveScheduleStatusOption(field, value);
    const canEdit = editable && !locked && !!onChange;
    const detailPreview = parsed.detail.trim();

    useEffect(() => {
        if (openMenu) return;
        const next = parseScheduleStatusCellValue(field, value);
        setDraftStatus(next.status);
        setDraftDetail(next.detail);
    }, [field, value, openMenu]);

    const closeMenus = () => {
        setOpenMenu(null);
        setAnchorEl(null);
    };

    const openBadgeMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (openMenu === "badge") {
            closeMenus();
            return;
        }
        const next = parseScheduleStatusCellValue(field, value);
        setDraftStatus(next.status);
        setDraftDetail(next.detail);
        setAnchorEl(event.currentTarget);
        setOpenMenu("badge");
    };

    const openDetailMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (openMenu === "detail") {
            commitDetailAndClose();
            return;
        }
        const next = parseScheduleStatusCellValue(field, value);
        setDraftStatus(next.status);
        setDraftDetail(next.detail);
        setAnchorEl(event.currentTarget);
        setOpenMenu("detail");
    };

    const selectBadge = (status: string) => {
        const next = formatScheduleStatusCellValue(status, parsed.detail);
        if (next !== value) onChange?.(next);
        closeMenus();
    };

    const commitDetailAndClose = () => {
        const next = formatScheduleStatusCellValue(parsed.status, draftDetail);
        if (next !== value) onChange?.(next);
        closeMenus();
    };

    const triggerLabel = current?.label ?? "선택";
    const showDetailBox = canEdit || !!detailPreview;

    return (
        <div className="flex w-full flex-col items-center justify-start gap-1 px-1 pt-1.5 pb-1">
            {canEdit ? (
                <button
                    type="button"
                    className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sky-300"
                    onClick={openBadgeMenu}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === "badge"}
                    aria-label={`${triggerLabel} 선택`}
                >
                    {current ? (
                        <ScheduleStatusBadge option={current} />
                    ) : (
                        <span className="inline-flex w-[5.75rem] items-center justify-center rounded-full border border-dashed border-gray-300 bg-white px-1.5 py-1 text-[10px] font-medium text-gray-400 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-500">
                            선택
                        </span>
                    )}
                </button>
            ) : current ? (
                <div className="shrink-0">
                    <ScheduleStatusBadge option={current} />
                </div>
            ) : null}

            {showDetailBox ? (
                <DetailPreviewBox
                    detailPreview={detailPreview}
                    canEdit={canEdit}
                    menuOpen={openMenu === "detail"}
                    onOpenDetail={canEdit ? openDetailMenu : undefined}
                />
            ) : null}

            {canEdit && openMenu === "badge" ? (
                <ActionMenu
                    isOpen
                    anchorEl={anchorEl}
                    onClose={closeMenus}
                    placement="bottom-right"
                    width="w-72"
                    estimatedHeight={120}
                    showDelete={false}
                    showLogout={false}
                >
                    <div
                        className="grid grid-cols-2 gap-1 p-0.5"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {options.map((option) => {
                            const selected = option.value === draftStatus;
                            return (
                                <button
                                    key={`${field}-${option.tone}-${option.value || "empty"}`}
                                    type="button"
                                    className={`flex min-h-[34px] items-center justify-center rounded-lg px-1 py-1 transition-colors ${
                                        selected
                                            ? "bg-gray-100"
                                            : "hover:bg-gray-50 active:bg-gray-100"
                                    }`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        selectBadge(option.value);
                                    }}
                                >
                                    <ScheduleStatusBadge
                                        option={option}
                                        className="w-full"
                                    />
                                </button>
                            );
                        })}
                    </div>
                </ActionMenu>
            ) : null}

            {canEdit && openMenu === "detail" ? (
                <ActionMenu
                    isOpen
                    anchorEl={anchorEl}
                    onClose={commitDetailAndClose}
                    placement="bottom-right"
                    width="w-64"
                    estimatedHeight={140}
                    showDelete={false}
                    showLogout={false}
                >
                    <div
                        className="flex flex-col gap-1 p-0.5"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <label className="px-0.5 text-left text-[11px] font-medium text-gray-600">
                            상세 내용
                        </label>
                        <textarea
                            value={draftDetail}
                            onChange={(event) => setDraftDetail(event.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="상세 내용을 입력하세요"
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] leading-snug text-gray-800 outline-none placeholder:text-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                    </div>
                </ActionMenu>
            ) : null}
        </div>
    );
}
