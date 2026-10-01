import { useEffect, useState } from "react";
import BaseModal from "../../components/ui/BaseModal";
import SkeletonCard from "../../components/common/skeletons/SkeletonCard";
import { fetchLatestScheduleSheet, type ScheduleVersionSheet } from "../../lib/scheduleApi";

export interface SchedulePickItem {
    id: string;
    shipName: string;
    period: string;
    workItem: string;
    teamMember: string;
    customerCompany: string;
    customerContact: string;
}

interface SchedulePickModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: SchedulePickItem) => void;
}

function display(value: string) {
    const text = value.replace(/\s+/g, " ").trim();
    return text || "—";
}

export default function SchedulePickModal({ isOpen, onClose, onSelect }: SchedulePickModalProps) {
    const [sheet, setSheet] = useState<ScheduleVersionSheet | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        fetchLatestScheduleSheet()
            .then((next) => {
                if (!cancelled) setSheet(next);
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) {
                    setSheet(null);
                    setError(err instanceof Error ? err.message : "일정표를 불러오지 못했습니다.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const cards = (sheet?.rows ?? []).filter(
        (row) => row.shipName.trim() || row.period.trim() || row.workItem.trim() || row.teamMember.trim()
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={sheet ? `일정 ${sheet.versionKey}` : "일정"}
            maxWidth="max-w-[720px]"
        >
            {loading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <SkeletonCard key={index} height="h-28" className="border border-gray-200" />
                    ))}
                </div>
            ) : error ? (
                <p className="py-8 text-center text-sm text-red-500">{error}</p>
            ) : cards.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">불러올 일정이 없습니다.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {cards.map((row) => (
                        <button
                            key={row.id}
                            type="button"
                            onClick={() =>
                                onSelect({
                                    id: row.id,
                                    shipName: row.shipName,
                                    period: row.period,
                                    workItem: row.workItem,
                                    teamMember: row.teamMember,
                                    customerCompany: row.customerCompany,
                                    customerContact: row.customerContact,
                                })
                            }
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-gray-900 hover:bg-white"
                        >
                            <div className="flex flex-col gap-2 text-sm">
                                <div className="flex items-baseline justify-between gap-4">
                                    <p className="min-w-0 font-semibold text-gray-900 break-words">{display(row.shipName)}</p>
                                    <p className="shrink-0 text-gray-600">{display(row.period)}</p>
                                </div>
                                <p className="text-gray-700 break-words">{display(row.teamMember)}</p>
                                <p className="text-gray-900 break-words whitespace-pre-wrap">{row.workItem.trim() || "—"}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </BaseModal>
    );
}
