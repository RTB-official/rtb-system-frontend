import { useCallback, useEffect, useMemo, useState } from "react";
import BaseModal from "../../components/ui/BaseModal";
import Button from "../../components/common/Button";
import SkeletonCard from "../../components/common/skeletons/SkeletonCard";
import {
    fetchScheduleVersionSheetsPage,
    type ScheduleVersionSheet,
} from "../../lib/scheduleApi";
import { useAuth } from "../../store/auth";
import { IconChevronLeft, IconChevronRight } from "../../components/icons/Icons";

export interface SchedulePickItem {
    id: string;
    shipName: string;
    engineType: string;
    workLocation: string;
    period: string;
    workItem: string;
    teamMember: string;
    car: string;
    customerCompany: string;
    customerContact: string;
}

interface SchedulePickModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: SchedulePickItem) => void;
}

const PAGE_SIZE = 5;

function display(value: string) {
    const text = value.replace(/\s+/g, " ").trim();
    return text || "—";
}

/** Team member 칸(공백 구분 이름)에 본인이 포함되는지 */
function teamIncludesPerson(teamMember: string, personName: string) {
    const name = personName.trim();
    if (!name) return false;
    return teamMember
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .includes(name);
}

export default function SchedulePickModal({ isOpen, onClose, onSelect }: SchedulePickModalProps) {
    const { profile } = useAuth();
    const myName = profile?.name?.trim() ?? "";
    const isAdmin = profile?.role === "admin";
    /** oldest → newest (rightmost = newest) */
    const [sheets, setSheets] = useState<ScheduleVersionSheet[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    /** older ← left, newer → right */
    const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        setSheets([]);
        setActiveIndex(0);
        setHasMoreOlder(false);
        setSlideDir(null);

        void fetchScheduleVersionSheetsPage(0, PAGE_SIZE)
            .then(({ sheets: newestFirst, hasMore }) => {
                if (cancelled) return;
                const oldestFirst = [...newestFirst].reverse();
                setSheets(oldestFirst);
                setActiveIndex(Math.max(0, oldestFirst.length - 1));
                setHasMoreOlder(hasMore);
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) {
                    setSheets([]);
                    setError(
                        err instanceof Error ? err.message : "일정표를 불러오지 못했습니다."
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const loadOlder = useCallback(async () => {
        if (loadingMore || !hasMoreOlder) return false;
        setLoadingMore(true);
        try {
            const { sheets: newerFirstOlderBatch, hasMore } =
                await fetchScheduleVersionSheetsPage(sheets.length, PAGE_SIZE);
            const olderAsc = [...newerFirstOlderBatch].reverse();
            if (olderAsc.length === 0) {
                setHasMoreOlder(false);
                return false;
            }
            setSheets((prev) => [...olderAsc, ...prev]);
            setHasMoreOlder(hasMore);
            return olderAsc.length;
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "일정을 더 불러오지 못했습니다.");
            return false;
        } finally {
            setLoadingMore(false);
        }
    }, [hasMoreOlder, loadingMore, sheets.length]);

    const goOlder = async () => {
        if (loading || loadingMore) return;
        setSlideDir("left");
        if (activeIndex > 0) {
            setActiveIndex((index) => index - 1);
            return;
        }
        const added = await loadOlder();
        if (typeof added === "number" && added > 0) {
            // 이전 맨 왼쪽이 added 위치로 밀림 → 한 칸 과거 = added - 1
            setActiveIndex(added - 1);
        }
    };

    const goNewer = () => {
        if (loading || loadingMore) return;
        if (activeIndex >= sheets.length - 1) return;
        setSlideDir("right");
        setActiveIndex((index) => Math.min(sheets.length - 1, index + 1));
    };

    const sheet = sheets[activeIndex] ?? null;
    const slideClass =
        slideDir === "left"
            ? "schedule-pick-slide-from-left"
            : slideDir === "right"
              ? "schedule-pick-slide-from-right"
              : "";
    const panelKey = sheet?.id ?? `idx-${activeIndex}`;

    const cards = useMemo(() => {
        return (sheet?.rows ?? []).filter((row) => {
            const hasContent =
                row.shipName.trim() ||
                row.period.trim() ||
                row.workItem.trim() ||
                row.teamMember.trim();
            if (!hasContent) return false;
            if (isAdmin) return true;
            return teamIncludesPerson(row.teamMember, myName);
        });
    }, [sheet, myName, isAdmin]);

    const canGoOlder = activeIndex > 0 || hasMoreOlder;
    const canGoNewer = activeIndex < sheets.length - 1;
    const previousSheet = activeIndex > 0 ? sheets[activeIndex - 1] : null;
    const nextSheet = activeIndex < sheets.length - 1 ? sheets[activeIndex + 1] : null;

    const title = (
        <div className="relative flex min-w-0 flex-1 items-center">
            <div className="z-10 flex min-w-0 items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="!h-9 !w-9 shrink-0 !rounded-full !px-0"
                    aria-label="이전 일정"
                    title="이전 일정 (과거)"
                    disabled={!canGoOlder || loading || loadingMore}
                    loading={loadingMore && activeIndex === 0}
                    icon={<IconChevronLeft className="h-5 w-5" />}
                    onClick={() => void goOlder()}
                />
                {previousSheet ? (
                    <span className="max-w-[7.5rem] truncate text-[13px] font-medium text-gray-400 md:max-w-[10rem] md:text-[15px]">
                        {previousSheet.versionKey}
                    </span>
                ) : null}
            </div>
            <span
                key={`title-${panelKey}`}
                className={`pointer-events-none absolute inset-x-0 truncate text-center text-[18px] font-semibold text-gray-900 md:text-[22px] ${slideClass}`}
            >
                {sheet?.versionKey ?? ""}
            </span>
            <div className="z-10 ml-auto flex min-w-0 items-center gap-1">
                {nextSheet ? (
                    <span className="max-w-[7.5rem] truncate text-[13px] font-medium text-gray-400 md:max-w-[10rem] md:text-[15px]">
                        {nextSheet.versionKey}
                    </span>
                ) : null}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="!h-9 !w-9 shrink-0 !rounded-full !px-0"
                    aria-label="다음 일정"
                    title="다음 일정 (최신)"
                    disabled={!canGoNewer || loading || loadingMore}
                    icon={<IconChevronRight className="h-5 w-5" />}
                    onClick={goNewer}
                />
            </div>
        </div>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            showCloseButton={false}
            maxWidth="max-w-[720px]"
            className="h-[calc(4*7rem+3*0.75rem+5.5rem)] max-h-[80vh] md:h-[90vh] md:max-h-[90vh]"
        >
            {loading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <SkeletonCard key={index} height="h-28" className="border border-gray-200" />
                    ))}
                </div>
            ) : error && sheets.length === 0 ? (
                <div className="flex h-full min-h-0 items-center justify-center">
                    <p className="text-center text-sm text-red-500">{error}</p>
                </div>
            ) : sheets.length === 0 ? (
                <div className="flex h-full min-h-0 items-center justify-center">
                    <p className="text-center text-sm text-gray-500">불러올 일정이 없습니다.</p>
                </div>
            ) : (
                <div key={panelKey} className={`h-full min-h-0 ${slideClass}`}>
                    {cards.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-center text-sm text-gray-500">
                                {isAdmin || !myName
                                    ? "불러올 일정이 없습니다."
                                    : "이 일정에서 내가 참여한 항목이 없습니다."}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {error ? (
                                <p className="text-center text-sm text-red-500">{error}</p>
                            ) : null}
                            {cards.map((row) => (
                                <button
                                    key={`${sheet?.id}-${row.id}`}
                                    type="button"
                                    onClick={() =>
                                        onSelect({
                                            id: row.id,
                                            shipName: row.shipName,
                                            engineType: row.engineType,
                                            workLocation: row.workLocation,
                                            period: row.period,
                                            workItem: row.workItem,
                                            teamMember: row.teamMember,
                                            car: row.car,
                                            customerCompany: row.customerCompany,
                                            customerContact: row.customerContact,
                                        })
                                    }
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-gray-900 hover:bg-white"
                                >
                                    <div className="flex flex-col gap-2 text-sm">
                                        <div className="flex items-baseline justify-between gap-4">
                                            <p className="min-w-0 break-words font-semibold text-gray-900">
                                                {display(row.shipName)}
                                            </p>
                                            <p className="shrink-0 text-gray-600">
                                                {display(row.period)}
                                            </p>
                                        </div>
                                        <p className="break-words text-gray-700">
                                            {display(row.teamMember)}
                                        </p>
                                        <p className="break-words whitespace-pre-wrap text-gray-900">
                                            {row.workItem.trim() || "—"}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </BaseModal>
    );
}
