import { getWorkLogs, type WorkLog } from "./workLogApi";
import { supabase } from "./supabase";
import { fetchWorkLogEntryPeriodMap } from "./workLogEntryPeriodMap";
import { formatInvoiceReportTableTitle } from "../utils/invoiceReportDisplayTitle";

export type InvoiceReportListStatus = "submitted" | "pending";

export type InvoiceReportListItem = {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    ownerEmail: string | null;
    ownerPosition: string | null;
    date: string;
    createdAt: string;
    status: InvoiceReportListStatus;
};

function formatReportListDate(dateString: string) {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}.`;
}

/** 인보이스·보고서 선택 UI용 목록 (InvoicePage와 동일 제목·기간 규칙) */
export async function loadInvoiceReportListItems(): Promise<
    InvoiceReportListItem[]
> {
    const workLogs = await getWorkLogs();

    const baseItems: InvoiceReportListItem[] = workLogs.map((w: WorkLog) => ({
        id: w.id,
        title: w.subject || "(제목 없음)",
        place: w.location || "",
        supervisor: w.order_person || "",
        owner: w.author || "(작성자 없음)",
        ownerEmail: null,
        ownerPosition: null,
        date: formatReportListDate(w.created_at),
        createdAt: w.created_at,
        status: w.is_draft ? "pending" : "submitted",
    }));

    const workLogIds = workLogs.map((w) => w.id).filter(Boolean);
    const ownerNames = Array.from(
        new Set(baseItems.map((item) => item.owner).filter(Boolean))
    );
    let profileMap = new Map<
        string,
        { email: string | null; position: string | null }
    >();

    const [periodMap, profilesResult] = await Promise.all([
        fetchWorkLogEntryPeriodMap(workLogIds),
        ownerNames.length > 0
            ? supabase
                  .from("profiles")
                  .select("name, email, position")
                  .in("name", ownerNames)
            : Promise.resolve({ data: [], error: null }),
    ]);

    const { data: profiles, error: profilesError } = profilesResult;
    if (!profilesError && profiles) {
        profiles.forEach(
            (profile: {
                name: string;
                email: string | null;
                position: string | null;
            }) => {
                profileMap.set(profile.name, {
                    email: profile.email || null,
                    position: profile.position || null,
                });
            }
        );
    }

    return baseItems.map((item) => {
        const wl = workLogs.find((w) => w.id === item.id);
        const vessel = wl?.vessel?.trim() ? wl.vessel.trim() : "";
        const purpose = wl?.subject?.trim() ? wl.subject.trim() : "";
        const p = periodMap.get(item.id);
        const profile = profileMap.get(item.owner);

        return {
            ...item,
            title: formatInvoiceReportTableTitle({
                periodStart: p?.start,
                periodEnd: p?.end,
                vessel,
                subject: purpose,
                createdAt: item.createdAt,
            }),
            ownerEmail: profile?.email ?? null,
            ownerPosition: profile?.position ?? null,
        };
    });
}
