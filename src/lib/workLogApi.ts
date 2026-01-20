//workLogApi.ts
import { supabase } from "./supabase";
import {
    getGongmuTeamUserIds,
    createNotificationsForUsers,
} from "./notificationApi";

// ==================== 타입 정의 ====================

export interface WorkLog {
    id: number;
    author: string;
    vessel: string | null;
    engine: string | null;
    order_group: string | null;
    order_person: string | null;
    location: string | null;
    vehicle: string | null;
    subject: string | null;
    is_draft: boolean;
    created_by: string | null;
    created_at: string;
}

export interface WorkLogEntry {
    id: number;
    work_log_id: number;
    date_from: string | null;
    time_from: string | null;
    date_to: string | null;
    time_to: string | null;
    desc_type: string;
    details: string | null;
    note: string | null;
    move_from: string | null;
    move_to: string | null;
}

export interface WorkLogEntryPerson {
    id: number;
    entry_id: number;
    person_name: string;
}

export interface WorkLogExpense {
    id: number;
    work_log_id: number;
    expense_date: string;
    expense_type: string;
    detail: string;
    amount: number;
    created_at: string;
}

export interface WorkLogMaterial {
    id: number;
    work_log_id: number;
    material_name: string;
    qty: number;
    unit: string | null;
    created_at: string;
}

export interface WorkLogReceipt {
    id: number;
    work_log_id: number;
    file_path: string;
    orig_name: string;
    mime_type: string | null;
    file_size: number | null;
    ext: string | null;
    created_at: string;
}

// ==================== 입력 타입 정의 ====================

export interface CreateWorkLogInput {
    author?: string;
    vessel?: string;
    engine?: string;
    order_group?: string;
    order_person?: string;
    location?: string;
    vehicle?: string;
    subject?: string;
    workers?: string[];
    entries?: Array<{
        dateFrom: string;
        timeFrom?: string;
        dateTo: string;
        timeTo?: string;
        descType: string;
        details?: string;
        persons?: string[];
        note?: string;
        moveFrom?: string;
        moveTo?: string;
        lunch_worked?: boolean;
    }>;
    expenses?: Array<{
        date: string;
        type: string;
        detail: string;
        amount: number;
    }>;
    materials?: Array<{
        name: string;
        qty: number;
        unit?: string;
    }>;
    receipts?: Array<{
        file_path: string;
        orig_name: string;
        mime_type?: string;
        file_size?: number;
        ext?: string;
    }>;
    is_draft?: boolean;
    created_by?: string;
}

export interface WorkLogFullData {
    workLog: WorkLog;
    workers: string[];
    entries: Array<{
        id: number;
        dateFrom: string;
        timeFrom?: string;
        dateTo: string;
        timeTo?: string;
        descType: string;
        details: string;
        persons: string[];
        note?: string;
        moveFrom?: string;
        moveTo?: string;
        lunch_worked?: boolean;
    }>;
    expenses: Array<{
        id: number;
        date: string;
        type: string;
        detail: string;
        amount: number;
    }>;
    materials: Array<{
        id: number;
        name: string;
        qty: number;
        unit?: string;
    }>;
    receipts: Array<{
        id: number;
        file_path: string;
        orig_name: string;
        mime_type?: string;
        file_size?: number;
        ext?: string;
    }>;
}

// ==================== CRUD 함수 ====================

/**
 * 출장 보고서 생성 (제출 또는 임시저장)
 */
export async function createWorkLog(
    data: CreateWorkLogInput
): Promise<WorkLog> {
    // 1. work_logs 테이블에 기본 정보 저장
    const { data: workLog, error: workLogError } = await supabase
        .from("work_logs")
        .insert([
            {
                author: data.author || null,
                vessel: data.vessel || null,
                engine: data.engine || null,
                order_group: data.order_group || null,
                order_person: data.order_person || null,
                location: data.location || null,
                vehicle: data.vehicle || null,
                subject: data.subject || null,
                is_draft: data.is_draft ?? false,
                created_by: data.created_by || null,
            },
        ])
        .select()
        .single();

    if (workLogError || !workLog) {
        console.error("Error creating work log:", workLogError);
        throw new Error(
            `출장 보고서 생성 실패: ${
                workLogError?.message || "알 수 없는 오류"
            }`
        );
    }

    const workLogId = workLog.id;

    try {
        // 2. 작업자 목록 저장 (work_log_persons)
        if (data.workers && data.workers.length > 0) {
            const personsData = data.workers.map((name) => ({
                work_log_id: workLogId,
                person_name: name,
            }));

            const { error: personsError } = await supabase
                .from("work_log_persons")
                .insert(personsData);

            if (personsError) {
                console.error("Error creating work log persons:", personsError);
                throw new Error(
                    `작업자 목록 저장 실패: ${personsError.message}`
                );
            }
        }

        // 3. 업무 일지 저장 (work_log_entries + work_log_entry_persons)
        if (data.entries && data.entries.length > 0) {
            for (const entry of data.entries) {
                const { data: entryData, error: entryError } = await supabase
                    .from("work_log_entries")
                    .insert([
                        {
                            work_log_id: workLogId,
                            date_from: entry.dateFrom || null,
                            time_from: entry.timeFrom || null,
                            date_to: entry.dateTo || null,
                            time_to: entry.timeTo || null,
                            desc_type: entry.descType,
                            details: entry.details || null,
                            note: entry.note || null,
                            move_from: entry.moveFrom || null,
                            move_to: entry.moveTo || null,
                            lunch_worked: entry.lunch_worked ?? false,
                        },
                    ])
                    .select()
                    .single();

                if (entryError) {
                    console.error("Error creating work log entry:", entryError);
                    throw new Error(
                        `업무 일지 저장 실패: ${entryError.message}`
                    );
                }

                // 각 entry의 참여자 저장
                if (entry.persons && entry.persons.length > 0 && entryData) {
                    const entryPersonsData = entry.persons.map((name) => ({
                        entry_id: entryData.id,
                        person_name: name,
                    }));

                    const { error: entryPersonsError } = await supabase
                        .from("work_log_entry_persons")
                        .insert(entryPersonsData);

                    if (entryPersonsError) {
                        console.error(
                            "Error creating work log entry persons:",
                            entryPersonsError
                        );
                        throw new Error(
                            `참여자 목록 저장 실패: ${entryPersonsError.message}`
                        );
                    }
                }
            }
        }

        // 4. 경비 내역 저장 (work_log_expenses)
        if (data.expenses && data.expenses.length > 0) {
            const expensesData = data.expenses.map((expense) => ({
                work_log_id: workLogId,
                expense_date: expense.date,
                expense_type: expense.type,
                detail: expense.detail,
                amount: expense.amount,
            }));

            const { error: expensesError } = await supabase
                .from("work_log_expenses")
                .insert(expensesData);

            if (expensesError) {
                console.error("Error creating work log expenses:", expensesError);
                throw new Error(
                    `경비 내역 저장 실패: ${expensesError.message}`
                );
            }
        }

        // 5. 소모품 저장 (work_log_materials)
        if (data.materials && data.materials.length > 0) {
            const materialsData = data.materials.map((material) => ({
                work_log_id: workLogId,
                material_name: material.name,
                qty: material.qty,
                unit: material.unit || null,
            }));

            const { error: materialsError } = await supabase
                .from("work_log_materials")
                .insert(materialsData);

            if (materialsError) {
                console.error(
                    "Error creating work log materials:",
                    materialsError
                );
                throw new Error(
                    `소모품 저장 실패: ${materialsError.message}`
                );
            }
        }

        // 6. 첨부파일 저장 (work_log_receipts)
        if (data.receipts && data.receipts.length > 0) {
            const receiptsData = data.receipts.map((receipt) => ({
                work_log_id: workLogId,
                file_path: receipt.file_path,
                orig_name: receipt.orig_name,
                mime_type: receipt.mime_type || null,
                file_size: receipt.file_size || null,
                ext: receipt.ext || null,
            }));

            const { error: receiptsError } = await supabase
                .from("work_log_receipts")
                .insert(receiptsData);

            if (receiptsError) {
                console.error("Error creating work log receipts:", receiptsError);
                throw new Error(
                    `첨부파일 저장 실패: ${receiptsError.message}`
                );
            }
        }

        // 7. 보고서 제출 시 공무팀에 알림 생성 (임시저장이 아닐 때만, 본인 제외)
        if (!data.is_draft) {
            try {
                console.log("🔔 [알림] 보고서 제출 알림 생성 시작...");
                const gongmuUserIds = await getGongmuTeamUserIds();
                console.log("🔔 [알림] 공무팀 사용자 ID 목록:", gongmuUserIds);
                
                // 본인 제외
                const creatorId = data.created_by || null;
                const targetUserIds = creatorId 
                    ? gongmuUserIds.filter(id => id !== creatorId)
                    : gongmuUserIds;
                console.log("🔔 [알림] 알림 대상 사용자 ID 목록 (본인 제외):", targetUserIds);
                
                if (targetUserIds.length > 0) {
                    const result = await createNotificationsForUsers(
                        targetUserIds,
                        "새 보고서",
                        `${workLog.author || "작성자"}님이 새 보고서를 제출했습니다.`,
                        "report"
                    );
                    console.log("🔔 [알림] 알림 생성 완료:", result.length, "개");
                } else {
                    console.warn("⚠️ [알림] 알림 대상 사용자가 없어 알림을 생성하지 않았습니다.");
                }
            } catch (notificationError: any) {
                // 알림 생성 실패는 보고서 생성을 막지 않음
                console.error(
                    "❌ [알림] 알림 생성 실패 (보고서는 정상 생성됨):",
                    notificationError?.message || notificationError,
                    notificationError
                );
            }
        } else {
            console.log("📝 [알림] 임시저장이므로 알림을 생성하지 않습니다.");
        }

        return workLog;
    } catch (error) {
        // 에러 발생 시 생성된 work_log 삭제 (롤백)
        await supabase.from("work_logs").delete().eq("id", workLogId);
        throw error;
    }
}

// ==================== 파일 업로드 ====================

/**
 * 파일을 Supabase Storage에 업로드
 */
export async function uploadReceiptFile(
    file: File,
    workLogId: number,
    category: string
): Promise<string> {
    console.log("=== 파일 업로드 디버깅 ===");
    console.log("File:", file.name, file.size, file.type);
    console.log("Work Log ID:", workLogId);
    console.log("Category:", category);
    
    const fileExt = file.name.split(".").pop();
    
    // 카테고리를 영문으로 변환 (한글 경로 문제 방지)
    const categoryMap: Record<string, string> = {
        "숙박영수증": "accommodation",
        "자재구매영수증": "material",
        "식비및유대영수증": "food",
        "기타": "other",
    };
    const categoryEn = categoryMap[category] || "other";
    
    // 파일명에 특수문자 제거 및 URL 안전한 문자만 사용
    const safeFileName = `${workLogId}_${categoryEn}_${Date.now()}.${fileExt}`;
    const filePath = `receipts/${safeFileName}`;
    
    console.log("File Path:", filePath);
    console.log("Bucket:", "work-log-recipts");

    // Storage 버킷 존재 여부 확인
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    console.log("Available buckets:", buckets?.map(b => b.name));
    console.log("Buckets error:", bucketsError);

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("work-log-recipts")
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error("=== Storage 업로드 에러 상세 ===");
        console.error("Error Code:", uploadError.error);
        console.error("Error Message:", uploadError.message);
        console.error("Error Status Code:", uploadError.statusCode);
        console.error("Full Error:", JSON.stringify(uploadError, null, 2));
        throw new Error(`파일 업로드 실패: ${uploadError.message || uploadError.error || "알 수 없는 오류"}`);
    }

    console.log("파일 업로드 성공:", uploadData);
    return filePath;
}

// ==================== 조회 함수 ====================

/**
 * 출장 보고서 목록 조회
 */
export async function getWorkLogs(): Promise<WorkLog[]> {
    const { data, error } = await supabase
        .from("work_logs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching work logs:", error);
        throw new Error(`출장 보고서 조회 실패: ${error.message}`);
    }

    return data || [];
}

/**
 * 현재 사용자의 기존 임시저장 항목 조회
 */
export async function getDraftWorkLog(
    createdBy: string
): Promise<WorkLog | null> {
    const { data, error } = await supabase
        .from("work_logs")
        .select("*")
        .eq("created_by", createdBy)
        .eq("is_draft", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // 데이터 없음
            return null;
        }
        console.error("Error fetching draft work log:", error);
        throw new Error(`임시저장 항목 조회 실패: ${error.message}`);
    }

    return data;
}

export async function getWorkLogById(
    workLogId: number
): Promise<WorkLogFullData | null> {
    // 1. work_logs 기본 정보 조회
    const { data: workLog, error: workLogError } = await supabase
        .from("work_logs")
        .select("*")
        .eq("id", workLogId)
        .single();

    if (workLogError || !workLog) {
        console.error("Error fetching work log:", workLogError);
        return null;
    }

    // 2. 작업자 목록 조회
    const { data: personsData } = await supabase
        .from("work_log_persons")
        .select("person_name")
        .eq("work_log_id", workLogId);

    const workers = personsData?.map((p) => p.person_name) || [];

    // 3. 업무 일지 조회 (entries + entry_persons)
    const { data: entriesData } = await supabase
        .from("work_log_entries")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("date_from", { ascending: true })
        .order("time_from", { ascending: true });

    const entries = [];
    if (entriesData) {
        for (const entry of entriesData) {
            // 각 entry의 참여자 조회
            const { data: entryPersonsData } = await supabase
                .from("work_log_entry_persons")
                .select("person_name")
                .eq("entry_id", entry.id);

            const persons = entryPersonsData?.map((p) => p.person_name) || [];

            entries.push({
                id: entry.id,
                dateFrom: entry.date_from || "",
                timeFrom: entry.time_from || undefined,
                dateTo: entry.date_to || "",
                timeTo: entry.time_to || undefined,
                descType: entry.desc_type,
                details: entry.details || "",
                persons,
                note: entry.note || undefined,
                moveFrom: entry.move_from || undefined,
                moveTo: entry.move_to || undefined,
                lunch_worked: entry.lunch_worked ?? false,
            });
        }
    }

    // 4. 경비 내역 조회
    const { data: expensesData } = await supabase
        .from("work_log_expenses")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("expense_date", { ascending: true });

    const expenses =
        expensesData?.map((exp) => ({
            id: exp.id,
            date: exp.expense_date,
            type: exp.expense_type,
            detail: exp.detail,
            amount: exp.amount,
        })) || [];

    // 5. 소모품 조회
    const { data: materialsData } = await supabase
        .from("work_log_materials")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("created_at", { ascending: true });

    const materials =
        materialsData?.map((mat) => ({
            id: mat.id,
            name: mat.material_name,
            qty: mat.qty,
            unit: mat.unit || undefined,
        })) || [];

    // 6. 첨부파일 조회
    const { data: receiptsData } = await supabase
        .from("work_log_receipt")
        .select("*")
        .eq("work_log_id", workLogId);

    const receipts =
        receiptsData?.map((rec) => ({
            id: rec.id,
            file_path: rec.storage_path || rec.file_path,
            orig_name: rec.original_name || rec.orig_name,
            mime_type: rec.mime_type || undefined,
            file_size: rec.file_size || undefined,
            ext: rec.ext || undefined,
        })) || [];

    return {
        workLog,
        workers,
        entries,
        expenses,
        materials,
        receipts,
    };
}

/**
 * 출장 보고서 업데이트 (임시저장용)
 */
export async function updateWorkLog(
    workLogId: number,
    data: CreateWorkLogInput
): Promise<WorkLog> {
    // 1. work_logs 테이블 업데이트
    const { data: workLog, error: workLogError } = await supabase
        .from("work_logs")
        .update({
            author: data.author || null,
            vessel: data.vessel || null,
            engine: data.engine || null,
            order_group: data.order_group || null,
            order_person: data.order_person || null,
            location: data.location || null,
            vehicle: data.vehicle || null,
            subject: data.subject || null,
            is_draft: data.is_draft ?? false,
        })
        .eq("id", workLogId)
        .select()
        .single();

    if (workLogError) {
        console.error("Error updating work log:", workLogError);
        throw new Error(`출장 보고서 업데이트 실패: ${workLogError.message}`);
    }

    try {
        // 2. 기존 관련 데이터 삭제
        await Promise.all([
            supabase.from("work_log_persons").delete().eq("work_log_id", workLogId),
            supabase.from("work_log_entries").delete().eq("work_log_id", workLogId),
            supabase.from("work_log_expenses").delete().eq("work_log_id", workLogId),
            supabase.from("work_log_materials").delete().eq("work_log_id", workLogId),
        ]);

        // 3. 작업자 목록 저장 (work_log_persons)
        if (data.workers && data.workers.length > 0) {
            const personsData = data.workers.map((name) => ({
                work_log_id: workLogId,
                person_name: name,
            }));

            const { error: personsError } = await supabase
                .from("work_log_persons")
                .insert(personsData);

            if (personsError) {
                console.error("Error creating work log persons:", personsError);
                throw new Error(
                    `작업자 목록 저장 실패: ${personsError.message}`
                );
            }
        }

        // 4. 업무 일지 저장 (work_log_entries + work_log_entry_persons)
        if (data.entries && data.entries.length > 0) {
            for (const entry of data.entries) {
                const { data: entryData, error: entryError } = await supabase
                    .from("work_log_entries")
                    .insert([
                        {
                            work_log_id: workLogId,
                            date_from: entry.dateFrom || null,
                            time_from: entry.timeFrom || null,
                            date_to: entry.dateTo || null,
                            time_to: entry.timeTo || null,
                            desc_type: entry.descType,
                            details: entry.details || null,
                            note: entry.note || null,
                            move_from: entry.moveFrom || null,
                            move_to: entry.moveTo || null,
                            lunch_worked: entry.lunch_worked ?? false,
                        },
                    ])
                    .select()
                    .single();

                if (entryError) {
                    console.error("Error creating work log entry:", entryError);
                    throw new Error(
                        `업무 일지 저장 실패: ${entryError.message}`
                    );
                }

                // 각 entry의 참여자 저장
                if (entry.persons && entry.persons.length > 0 && entryData) {
                    const entryPersonsData = entry.persons.map((name) => ({
                        entry_id: entryData.id,
                        person_name: name,
                    }));

                    const { error: entryPersonsError } = await supabase
                        .from("work_log_entry_persons")
                        .insert(entryPersonsData);

                    if (entryPersonsError) {
                        console.error(
                            "Error creating work log entry persons:",
                            entryPersonsError
                        );
                        throw new Error(
                            `참여자 목록 저장 실패: ${entryPersonsError.message}`
                        );
                    }
                }
            }
        }

        // 5. 경비 내역 저장 (work_log_expenses)
        if (data.expenses && data.expenses.length > 0) {
            const expensesData = data.expenses.map((expense) => ({
                work_log_id: workLogId,
                expense_date: expense.date,
                expense_type: expense.type,
                detail: expense.detail,
                amount: expense.amount,
            }));

            const { error: expensesError } = await supabase
                .from("work_log_expenses")
                .insert(expensesData);

            if (expensesError) {
                console.error("Error creating work log expenses:", expensesError);
                throw new Error(
                    `경비 내역 저장 실패: ${expensesError.message}`
                );
            }
        }

        // 6. 소모품 저장 (work_log_materials)
        if (data.materials && data.materials.length > 0) {
            const materialsData = data.materials.map((material) => ({
                work_log_id: workLogId,
                material_name: material.name,
                qty: material.qty,
                unit: material.unit || null,
            }));

            const { error: materialsError } = await supabase
                .from("work_log_materials")
                .insert(materialsData);

            if (materialsError) {
                console.error(
                    "Error creating work log materials:",
                    materialsError
                );
                throw new Error(
                    `소모품 저장 실패: ${materialsError.message}`
                );
            }
        }

        // 7. 보고서 제출 시 공무팀에 알림 생성 (임시저장이 아닐 때만, 그리고 이전에 draft였던 경우만)
        if (!data.is_draft) {
            try {
                console.log("🔔 [알림] 보고서 업데이트 알림 생성 시작...");
                // 이전 상태 확인 (draft였는지)
                const { data: previousWorkLog, error: prevError } = await supabase
                    .from("work_logs")
                    .select("is_draft")
                    .eq("id", workLogId)
                    .single();

                if (prevError) {
                    console.error("⚠️ [알림] 이전 보고서 상태 조회 실패:", prevError);
                }

                console.log("🔔 [알림] 이전 보고서 상태:", previousWorkLog);

                // 이전에 draft였거나, 또는 새로 제출되는 경우 알림 생성 (본인 제외)
                if (!previousWorkLog || previousWorkLog.is_draft) {
                    // 작성자 ID 가져오기
                    const { data: currentWorkLog } = await supabase
                        .from("work_logs")
                        .select("created_by")
                        .eq("id", workLogId)
                        .single();
                    
                    const creatorId = currentWorkLog?.created_by || data.created_by || null;
                    
                    const gongmuUserIds = await getGongmuTeamUserIds();
                    console.log("🔔 [알림] 공무팀 사용자 ID 목록:", gongmuUserIds);
                    
                    // 본인 제외
                    const targetUserIds = creatorId 
                        ? gongmuUserIds.filter(id => id !== creatorId)
                        : gongmuUserIds;
                    console.log("🔔 [알림] 알림 대상 사용자 ID 목록 (본인 제외):", targetUserIds);
                    
                    if (targetUserIds.length > 0) {
                        const result = await createNotificationsForUsers(
                            targetUserIds,
                            "새 보고서",
                            `${workLog.author || "작성자"}님이 새 보고서를 제출했습니다.`,
                            "report"
                        );
                        console.log("🔔 [알림] 알림 생성 완료:", result.length, "개");
                    } else {
                        console.warn("⚠️ [알림] 알림 대상 사용자가 없어 알림을 생성하지 않았습니다.");
                    }
                } else {
                    console.log("📝 [알림] 이미 제출된 보고서이므로 알림을 생성하지 않습니다.");
                }
            } catch (notificationError: any) {
                // 알림 생성 실패는 보고서 업데이트를 막지 않음
                console.error(
                    "❌ [알림] 알림 생성 실패 (보고서는 정상 업데이트됨):",
                    notificationError?.message || notificationError,
                    notificationError
                );
            }
        } else {
            console.log("📝 [알림] 임시저장이므로 알림을 생성하지 않습니다.");
        }

        return workLog;
    } catch (error) {
        throw error;
    }
}

/**
 * 영수증 조회
 */
export async function getWorkLogReceipts(
    workLogId: number
): Promise<
    Array<{
        id: number;
        category: string;
        storage_path: string;
        original_name: string | null;
        mime_type: string | null;
        file_size: number | null;
        file_url?: string;
    }>
> {
    const { data, error } = await supabase
        .from("work_log_receipt")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching receipts:", error);
        throw new Error(`영수증 조회 실패: ${error.message}`);
    }

    // Storage에서 공개 URL 생성
    const receiptsWithUrl = await Promise.all(
        (data || []).map(async (receipt) => {
            let fileUrl: string | undefined;
            try {
                // 버킷이 private이므로 signed URL 생성
                const bucketName = receipt.storage_bucket || "work-log-recipts";
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(receipt.storage_path, 60 * 60 * 24 * 365); // 1년 유효
                
                if (signedUrlError) {
                    console.error("Error creating signed URL:", signedUrlError);
                    // signed URL 실패 시 public URL 시도
                    const { data: urlData } = await supabase.storage
                        .from(bucketName)
                        .getPublicUrl(receipt.storage_path);
                    fileUrl = urlData?.publicUrl;
                } else {
                    fileUrl = signedUrlData?.signedUrl;
                }
            } catch (err) {
                console.error("Error getting URL:", err);
            }

            return {
                id: receipt.id,
                category: receipt.category,
                storage_path: receipt.storage_path,
                original_name: receipt.original_name,
                mime_type: receipt.mime_type,
                file_size: receipt.file_size,
                file_url: fileUrl,
            };
        })
    );

    return receiptsWithUrl;
}

/**
 * 영수증 삭제
 */
export async function deleteWorkLogReceipt(
    receiptId: number,
    storagePath: string,
    storageBucket: string = "work-log-recipts"
): Promise<void> {
    try {
        // 1. Storage에서 파일 삭제
        const { error: storageError } = await supabase.storage
            .from(storageBucket)
            .remove([storagePath]);

        if (storageError) {
            console.error("Error deleting file from storage:", storageError);
            // Storage 삭제 실패해도 DB는 삭제 시도
        }

        // 2. DB에서 레코드 삭제
        const { error: dbError } = await supabase
            .from("work_log_receipt")
            .delete()
            .eq("id", receiptId);

        if (dbError) {
            console.error("Error deleting receipt from DB:", dbError);
            throw new Error(`영수증 삭제 실패: ${dbError.message}`);
        }
    } catch (error: any) {
        console.error("Error deleting receipt:", error);
        throw error;
    }
}

/**
 * 출장 보고서 삭제
 */
export async function deleteWorkLog(workLogId: number): Promise<void> {
    try {
        // 1. 관련 테이블들 삭제 (외래키 제약조건 때문에 순서 중요)
        // work_log_entry_persons (work_log_entries에 의존)
        const { data: entriesData } = await supabase
            .from("work_log_entries")
            .select("id")
            .eq("work_log_id", workLogId);

        if (entriesData && entriesData.length > 0) {
            const entryIds = entriesData.map((e) => e.id);
            await supabase
                .from("work_log_entry_persons")
                .delete()
                .in("entry_id", entryIds);
        }

        // work_log_entries
        await supabase
            .from("work_log_entries")
            .delete()
            .eq("work_log_id", workLogId);

        // work_log_persons
        await supabase
            .from("work_log_persons")
            .delete()
            .eq("work_log_id", workLogId);

        // work_log_expenses
        await supabase
            .from("work_log_expenses")
            .delete()
            .eq("work_log_id", workLogId);

        // work_log_materials
        await supabase
            .from("work_log_materials")
            .delete()
            .eq("work_log_id", workLogId);

        // work_log_receipts
        await supabase
            .from("work_log_receipts")
            .delete()
            .eq("work_log_id", workLogId);

        // 2. work_logs 삭제
        const { error: deleteError } = await supabase
            .from("work_logs")
            .delete()
            .eq("id", workLogId);

        if (deleteError) {
            console.error("Error deleting work log:", deleteError);
            throw new Error(`출장 보고서 삭제 실패: ${deleteError.message}`);
        }
    } catch (error: any) {
        console.error("Error deleting work log:", error);
        throw error;
    }
}
