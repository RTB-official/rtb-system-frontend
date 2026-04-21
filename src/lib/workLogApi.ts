//workLogApi.ts
import { supabase } from "./supabase";
import {
    getGongmuTeamUserIds,
    createNotificationsForUsers,
} from "./notificationApi";

const workLogCache = new Map<number, WorkLogFullData>();
const workLogInFlight = new Map<number, Promise<WorkLogFullData | null>>();

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
        id?: number;
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
        /** 자정 분할로 묶인 세그먼트 공통 id (DB `split_group_id`) */
        splitGroupId?: string | null;
    }>;
    expenses?: Array<{
        id?: number;
        date: string;
        type: string;
        detail: string;
        amount: number;
        currency?: string;
    }>;
    materials?: Array<{
        id?: number;
        name: string;
        qty: number | string;
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
        /** 인보이스 생성 화면에서 복사로 만든 항목(저장 payload에는 미사용) */
        clientDuplicated?: boolean;
        /** 자정 분할 세그먼트 연동용 (같은 값이면 상세·인원·유형 동기화) */
        splitGroupId?: string | null;
    }>;
    expenses: Array<{
        id: number;
        date: string;
        type: string;
        detail: string;
        amount: number;
        currency?: string;
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

// ==================== 유틸리티 함수 ====================

function newWorkLogSplitGroupId(): string {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `split_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * 날짜가 넘어가는 entry를 분할 (24시(00시) 기준으로 나눔)
 * 예: 2월 28일 18시 ~ 3월 1일 06시
 * → [2월 28일 18시 ~ 2월 28일 24:00, 3월 1일 00:00 ~ 3월 1일 06시]
 */
function splitEntryByDate(entry: {
    id?: number;
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
    splitGroupId?: string | null;
}): {
    segments: Array<{
        id?: number;
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
        splitGroupId?: string | null;
    }>;
    originalId?: number; // 분할된 경우 원본 id (삭제용)
} {
    // 날짜가 같으면 분할하지 않음
    if (entry.dateFrom === entry.dateTo) {
        return { segments: [entry] };
    }

    const segments: Array<{
        id?: number;
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
        splitGroupId?: string | null;
    }> = [];
    const originalId = entry.id;
    const splitGroupId = newWorkLogSplitGroupId();

    // 첫 번째 세그먼트: dateFrom ~ dateFrom의 24:00
    segments.push({
        ...entry,
        id: undefined, // ✅ 분할된 entry는 id 제거 (새로 INSERT)
        dateTo: entry.dateFrom,
        timeTo: "24:00",
        splitGroupId,
    });

    // 중간 날짜들 (있는 경우): 각 날짜의 00:00 ~ 24:00
    const startDate = new Date(`${entry.dateFrom}T00:00:00`);
    const endDate = new Date(`${entry.dateTo}T00:00:00`);
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1); // 다음날부터

    while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        segments.push({
            ...entry,
            id: undefined, // ✅ 분할된 entry는 id 제거 (새로 INSERT)
            dateFrom: dateStr,
            timeFrom: "00:00",
            dateTo: dateStr,
            timeTo: "24:00",
            splitGroupId,
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 마지막 세그먼트: dateTo의 00:00 ~ dateTo의 timeTo
    segments.push({
        ...entry,
        id: undefined, // ✅ 분할된 entry는 id 제거 (새로 INSERT)
        dateFrom: entry.dateTo,
        timeFrom: "00:00",
        splitGroupId,
    });

    return { segments, originalId };
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
                // ✅ 날짜가 넘어가는 경우 분할
                const { segments } = splitEntryByDate(entry);

                for (const segment of segments) {
                    const { data: entryData, error: entryError } = await supabase
                        .from("work_log_entries")
                        .insert([
                            {
                                work_log_id: workLogId,
                                date_from: segment.dateFrom || null,
                                time_from: segment.timeFrom || null,
                                date_to: segment.dateTo || null,
                                time_to: segment.timeTo || null,
                                desc_type: segment.descType,
                                details: segment.details || null,
                                note: segment.note || null,
                                move_from: segment.moveFrom || null,
                                move_to: segment.moveTo || null,
                                lunch_worked: segment.lunch_worked ?? false,
                                split_group_id: segment.splitGroupId ?? null,
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
                    if (segment.persons && segment.persons.length > 0 && entryData) {
                        const entryPersonsData = segment.persons.map((name) => ({
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
        }

        // 4. 경비 내역 저장 (work_log_expenses)
        if (data.expenses && data.expenses.length > 0) {
            const expensesData = data.expenses.map((expense) => ({
                work_log_id: workLogId,
                expense_date: expense.date,
                expense_type: expense.type,
                detail: expense.detail,
                amount: expense.amount,
                currency: expense.currency || "원",
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
                qty: Number(material.qty) || 0,
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
                .from("work_log_receipt")
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
                const gongmuUserIds = await getGongmuTeamUserIds();
                
                // 본인 제외
                const creatorId = data.created_by || null;
                const targetUserIds = creatorId 
                    ? gongmuUserIds.filter(id => id !== creatorId)
                    : gongmuUserIds;
                
                if (targetUserIds.length > 0) {
                    await createNotificationsForUsers(
                        targetUserIds,
                        "새 보고서",
                        `${workLog.author || "작성자"}님이 새 보고서를 제출했습니다.`,
                        "report"
                    );
                }
            } catch (notificationError: any) {
                // 알림 생성 실패는 보고서 생성을 막지 않음
                console.error("알림 생성 실패:", notificationError?.message || notificationError);
            }
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
const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1024 * 1024;
const IMAGE_COMPRESSION_TARGET_BYTES = 600 * 1024;
const IMAGE_COMPRESSION_MAX_DIMENSION = 1600;
const IMAGE_COMPRESSION_INITIAL_QUALITY = 0.7;
const IMAGE_COMPRESSION_MIN_QUALITY = 0.6;
const IMAGE_COMPRESSION_SCALE_STEP = 0.85;
const IMAGE_COMPRESSION_MAX_ATTEMPTS = 6;

function replaceFileExtension(fileName: string, nextExt: string) {
    const dotIndex = fileName.lastIndexOf(".");
    const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
    return `${baseName}${nextExt}`;
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
        image.src = objectUrl;
    });
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number
): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

async function compressReceiptImage(file: File): Promise<File> {
    if (
        typeof window === "undefined" ||
        !file.type.startsWith("image/") ||
        file.type === "image/gif" ||
        file.type === "image/svg+xml" ||
        file.size <= IMAGE_COMPRESSION_THRESHOLD_BYTES
    ) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImageElement(objectUrl);
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;

        if (!naturalWidth || !naturalHeight) {
            return file;
        }

        const longestSide = Math.max(naturalWidth, naturalHeight);
        let scale =
            longestSide > IMAGE_COMPRESSION_MAX_DIMENSION
                ? IMAGE_COMPRESSION_MAX_DIMENSION / longestSide
                : 1;
        let quality = IMAGE_COMPRESSION_INITIAL_QUALITY;
        let bestFile = file;

        for (let attempt = 0; attempt < IMAGE_COMPRESSION_MAX_ATTEMPTS; attempt += 1) {
            const width = Math.max(1, Math.round(naturalWidth * scale));
            const height = Math.max(1, Math.round(naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) break;

            // JPEG 변환 시 투명 배경이 검게 보이지 않도록 흰색 배경을 깔아둔다.
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);

            const blob = await canvasToBlob(canvas, "image/jpeg", quality);
            if (!blob) break;

            const compressedFile = new File(
                [blob],
                replaceFileExtension(file.name, ".jpg"),
                {
                    type: "image/jpeg",
                    lastModified: file.lastModified,
                }
            );

            if (compressedFile.size < bestFile.size) {
                bestFile = compressedFile;
            }

            if (compressedFile.size <= IMAGE_COMPRESSION_TARGET_BYTES) {
                return compressedFile;
            }

            if (quality > IMAGE_COMPRESSION_MIN_QUALITY) {
                quality = Math.max(
                    IMAGE_COMPRESSION_MIN_QUALITY,
                    quality - 0.1
                );
            } else {
                scale *= IMAGE_COMPRESSION_SCALE_STEP;
            }
        }

        return bestFile.size < file.size ? bestFile : file;
    } catch (error) {
        console.warn("영수증 이미지 압축 실패, 원본으로 업로드합니다.", error);
        return file;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export async function uploadReceiptFile(
    file: File,
    workLogId: number,
    category: string
): Promise<{ filePath: string; uploadedFile: File }> {
    const uploadFile = await compressReceiptImage(file);
    const fileExt = uploadFile.name.split(".").pop();
    
    // 카테고리를 영문으로 변환 (한글 경로 문제 방지)
    const categoryMap: Record<string, string> = {
        "숙박영수증": "accommodation",
        "자재구매영수증": "material",
        "식비및유대영수증": "food",
        "기타": "other",
    };
    const categoryEn = categoryMap[category] || "other";
    
    // 고유한 파일명 생성: 타임스탬프 + 랜덤 문자열로 중복 방지
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15); // 13자리 랜덤 문자열
    const safeFileName = `${workLogId}_${categoryEn}_${timestamp}_${randomStr}.${fileExt}`;
    const filePath = `receipts/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
        .from("work-log-recipts")
        .upload(filePath, uploadFile, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        throw new Error(`파일 업로드 실패: ${uploadError.message || "알 수 없는 오류"}`);
    }

    return { filePath, uploadedFile: uploadFile };
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
                splitGroupId: (entry as { split_group_id?: string | null }).split_group_id ?? undefined,
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
            currency: (exp as any).currency || "원",
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

export async function prefetchWorkLogById(
    workLogId: number
): Promise<WorkLogFullData | null> {
    if (workLogCache.has(workLogId)) {
        return workLogCache.get(workLogId)!;
    }
    if (workLogInFlight.has(workLogId)) {
        return workLogInFlight.get(workLogId)!;
    }
    const request = getWorkLogById(workLogId)
        .then((data) => {
            if (data) {
                workLogCache.set(workLogId, data);
            }
            workLogInFlight.delete(workLogId);
            return data;
        })
        .catch((error) => {
            workLogInFlight.delete(workLogId);
            throw error;
        });
    workLogInFlight.set(workLogId, request);
    return request;
}

export async function getWorkLogByIdCached(
    workLogId: number
): Promise<WorkLogFullData | null> {
    if (workLogCache.has(workLogId)) {
        return workLogCache.get(workLogId)!;
    }
    return prefetchWorkLogById(workLogId);
}

/**
 * 출장 보고서 업데이트 (임시저장용)
 */
export async function updateWorkLog(
    workLogId: number,
    data: CreateWorkLogInput
  ): Promise<WorkLog> {
    // ✅ 업데이트 전에 "이전 draft 상태"를 먼저 읽어둠
    const { data: prevRow, error: prevError } = await supabase
      .from("work_logs")
      .select("is_draft, created_by")
      .eq("id", workLogId)
      .single();
  
    if (prevError) console.error("이전 work log 상태 조회 실패:", prevError);
  
    const wasDraft = prevRow?.is_draft ?? false;
    const prevCreatedBy = prevRow?.created_by ?? null;
  
    // 1) work_logs 테이블 업데이트
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
  
    if (workLogError || !workLog) {
      console.error("Error updating work log:", workLogError);
      throw new Error(`출장 보고서 업데이트 실패: ${workLogError?.message}`);
    }
  
    // ========= helpers =========
    const normalizeName = (v: any) => String(v ?? "").trim();
    // 3) entry_persons sync: entry_id 기준으로 persons를 덮어쓰기(diff)
const syncEntryPersons = async (entryId: number, persons: string[]) => {
    const normalize = (v: any) => String(v ?? "").trim();
    const desired = new Set((persons ?? []).map(normalize).filter(Boolean));
  
    // 현재 참여자 조회
    const { data: curRows, error } = await supabase
      .from("work_log_entry_persons")
      .select("person_name")
      .eq("entry_id", entryId);
  
    if (error) throw new Error(`참여자 목록 조회 실패: ${error.message}`);
  
    const current = new Set(
      (curRows ?? []).map((r: any) => normalize(r.person_name)).filter(Boolean)
    );
  
    const toAdd = [...desired].filter((x) => !current.has(x));
    const toDel = [...current].filter((x) => !desired.has(x));
  
    // 삭제
    if (toDel.length > 0) {
      const { error: delErr } = await supabase
        .from("work_log_entry_persons")
        .delete()
        .eq("entry_id", entryId)
        .in("person_name", toDel);
  
      if (delErr) throw new Error(`참여자 삭제 실패: ${delErr.message}`);
    }
  
    // 추가
    if (toAdd.length > 0) {
      const { error: insErr } = await supabase
        .from("work_log_entry_persons")
        .insert(toAdd.map((name) => ({ entry_id: entryId, person_name: name })));
  
      if (insErr) throw new Error(`참여자 추가 실패: ${insErr.message}`);
    }
  };
  
  
// 2) workers(work_log_persons) sync: name 기준 diff
const syncWorkers = async () => {
    const desired = new Set((data.workers ?? []).map(normalizeName).filter(Boolean));
  
    const { data: curRows, error } = await supabase
      .from("work_log_persons")
      .select("person_name")
      .eq("work_log_id", workLogId);
  
    if (error) throw new Error(`작업자 목록 조회 실패: ${error.message}`);
  
    const current = new Set(
      (curRows ?? []).map((r: any) => normalizeName(r.person_name)).filter(Boolean)
    );
  
      const toAdd = [...desired].filter((x) => !current.has(x));
      const toDel = [...current].filter((x) => !desired.has(x));
  
      if (toDel.length > 0) {
        const { error: delErr } = await supabase
          .from("work_log_persons")
          .delete()
          .eq("work_log_id", workLogId)
          .in("person_name", toDel);
        if (delErr) throw new Error(`작업자 삭제 실패: ${delErr.message}`);
      }
  
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from("work_log_persons")
          .insert(toAdd.map((name) => ({ work_log_id: workLogId, person_name: name })));
        if (insErr) throw new Error(`작업자 추가 실패: ${insErr.message}`);
      }
    };
  
// 4) entries sync: id 있으면 UPDATE, 없으면 INSERT, 빠진 id는 DELETE
const syncEntries = async () => {
    const incoming = data.entries ?? [];
  
    const { data: curRows, error } = await supabase
      .from("work_log_entries")
      .select("id")
      .eq("work_log_id", workLogId);
  
    if (error) throw new Error(`업무 일지 조회 실패: ${error.message}`);
  
// 현재 DB에 있는 entry들의 id 모음
const currentIdSet = new Set<number>();
for (const r of curRows ?? []) {
  const a = Number((r as any).id);
  if (Number.isFinite(a) && a > 0) currentIdSet.add(a);
}
  
    // incoming에서 넘어온 id들(프론트가 보내는 id가 무엇인지 불명이라 1차로만 사용)
    const incomingIds = new Set(
      incoming
        .map((e: any) => Number(e.id))
        .filter((x) => Number.isFinite(x) && x > 0)
    );
  
    // ✅ 삭제: "incomingIds에 없는 currentId"는 삭제 대상이라고 단정하면 위험함(키가 달라질 수 있어서)
    // 그래서 삭제는 "기존에 있던 row들의 id를 정확히 매칭할 때만" 수행하도록 보수적으로 처리:
    // - incoming에 id가 있는 경우만 삭제 판단에 사용
    if (incomingIds.size > 0) {
      const toDelete = [...currentIdSet].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        // entry_persons 먼저 삭제
        const { error: delPersonsErr } = await supabase
          .from("work_log_entry_persons")
          .delete()
          .in("entry_id", toDelete);
  
        if (delPersonsErr) throw new Error(`참여자 삭제 실패: ${delPersonsErr.message}`);
  
        const { error: delErr } = await supabase
        .from("work_log_entries")
        .delete()
        .eq("work_log_id", workLogId)
        .in("id", toDelete);
      
      if (delErr) throw new Error(`업무 일지 삭제 실패: ${delErr.message}`);
      
      }
    }
  
    // ✅ 날짜가 넘어가는 entry의 원본 id를 수집 (삭제용)
    const idsToDeleteFromSplit = new Set<number>();
    const expandedEntries: Array<typeof incoming[0]> = [];
    
    for (const e of incoming) {
      const { segments, originalId } = splitEntryByDate(e);
      
      // 분할된 경우 원본 id를 삭제 대상에 추가
      if (originalId && segments.length > 1) {
        idsToDeleteFromSplit.add(originalId);
      }
      
      // 분할된 segments를 expandedEntries에 추가
      expandedEntries.push(...segments);
    }
    
    // ✅ 분할로 인해 삭제해야 할 entry들 삭제
    if (idsToDeleteFromSplit.size > 0) {
      const idsToDelete = Array.from(idsToDeleteFromSplit);
      // entry_persons 먼저 삭제
      const { error: delPersonsErr } = await supabase
        .from("work_log_entry_persons")
        .delete()
        .in("entry_id", idsToDelete);
      
      if (delPersonsErr) throw new Error(`참여자 삭제 실패: ${delPersonsErr.message}`);
      
      const { error: delErr } = await supabase
        .from("work_log_entries")
        .delete()
        .eq("work_log_id", workLogId)
        .in("id", idsToDelete);
      
      if (delErr) throw new Error(`업무 일지 삭제 실패: ${delErr.message}`);
      
      // 삭제된 id들을 currentIdSet에서도 제거
      for (const id of idsToDelete) {
        currentIdSet.delete(id);
      }
    }

    // upsert via update/insert
    for (const e of expandedEntries) {
        const payload = {
          work_log_id: workLogId,
          date_from: e.dateFrom || null,
          time_from: e.timeFrom || null,
          date_to: e.dateTo || null,
          time_to: e.timeTo || null,
          desc_type: e.descType,
          details: e.details || null,
          note: e.note || null,
          move_from: e.moveFrom || null,
          move_to: e.moveTo || null,
          lunch_worked: e.lunch_worked ?? false,
          split_group_id: (e as { splitGroupId?: string | null }).splitGroupId ?? null,
        };
    
        const incomingId = Number((e as any).id);
    
    // UPDATE 시도 → 반드시 업데이트된 row를 select로 회수
    let rowKey: { id: number } | null = null;
    
    if (Number.isFinite(incomingId) && incomingId > 0) {
        const { data: updRow, error: updErr } = await supabase
          .from("work_log_entries")
          .update(payload)
          .eq("work_log_id", workLogId)
          .eq("id", incomingId)
          .select("id")
          .maybeSingle();
    
        if (updErr) throw new Error(`업무 일지 업데이트 실패: ${updErr.message}`);
    
        if (updRow) {
            const id = Number((updRow as any).id);
            if (!Number.isFinite(id) || id <= 0) {
              throw new Error(`업무 일지 업데이트 실패: 반환된 id가 없음 (row=${JSON.stringify(updRow)})`);
            }
            rowKey = { id };
          }
      }
    
    
        // UPDATE가 안 됐으면 INSERT
        if (!rowKey) {
          const { data: insRow, error: insErr } = await supabase
            .from("work_log_entries")
            .insert([payload])
            .select("id")
            .single();
    
          if (insErr) throw new Error(`업무 일지 생성 실패: ${insErr.message}`);
    
          rowKey = { id: (insRow as any).id };
    
    // 안전 확인
    const a = Number(rowKey.id);
    if (!(Number.isFinite(a) && a > 0)) {
      throw new Error(`업무 일지 생성 실패: 반환된 id가 없음 (row=${JSON.stringify(insRow)})`);
    }
        }
        await syncEntryPersons(rowKey.id, e.persons ?? []);
      }
  };
  
  
    // 5) expenses sync (id 기반)
    const syncExpenses = async () => {
      const incoming = data.expenses ?? [];
  
      const { data: curRows, error } = await supabase
        .from("work_log_expenses")
        .select("id")
        .eq("work_log_id", workLogId);
  
      if (error) throw new Error(`경비 내역 조회 실패: ${error.message}`);
  
      const currentIds = new Set((curRows ?? []).map((r: any) => Number(r.id)).filter((x) => Number.isFinite(x)));
      const incomingIds = new Set(incoming.map((x: any) => Number(x.id)).filter((x) => Number.isFinite(x)));
  
      const toDelete = [...currentIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("work_log_expenses")
          .delete()
          .eq("work_log_id", workLogId)
          .in("id", toDelete);
        if (delErr) throw new Error(`경비 내역 삭제 실패: ${delErr.message}`);
      }
  
      for (const exp of incoming) {
        const payload = {
          work_log_id: workLogId,
          expense_date: exp.date,
          expense_type: exp.type,
          detail: exp.detail,
          amount: exp.amount,
          currency: exp.currency || "원",
        };
        const id = Number(exp.id);
  
        if (Number.isFinite(id) && id > 0) {
          const { error: updErr } = await supabase
            .from("work_log_expenses")
            .update(payload)
            .eq("id", id)
            .eq("work_log_id", workLogId);
          if (updErr) throw new Error(`경비 내역 업데이트 실패: ${updErr.message}`);
        } else {
          const { error: insErr } = await supabase.from("work_log_expenses").insert([payload]);
          if (insErr) throw new Error(`경비 내역 생성 실패: ${insErr.message}`);
        }
      }
    };
  
    // 6) materials sync (id 기반)
    const syncMaterials = async () => {
      const incoming = data.materials ?? [];
  
      const { data: curRows, error } = await supabase
        .from("work_log_materials")
        .select("id")
        .eq("work_log_id", workLogId);
  
      if (error) throw new Error(`소모품 조회 실패: ${error.message}`);
  
      const currentIds = new Set((curRows ?? []).map((r: any) => Number(r.id)).filter((x) => Number.isFinite(x)));
      const incomingIds = new Set(incoming.map((x: any) => Number(x.id)).filter((x) => Number.isFinite(x)));
  
      const toDelete = [...currentIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("work_log_materials")
          .delete()
          .eq("work_log_id", workLogId)
          .in("id", toDelete);
        if (delErr) throw new Error(`소모품 삭제 실패: ${delErr.message}`);
      }
  
      for (const mat of incoming) {
        const payload = {
          work_log_id: workLogId,
          material_name: mat.name,
          qty: Number(mat.qty) || 0,
          unit: mat.unit || null,
        };
        const id = Number(mat.id);
  
        if (Number.isFinite(id) && id > 0) {
          const { error: updErr } = await supabase
            .from("work_log_materials")
            .update(payload)
            .eq("id", id)
            .eq("work_log_id", workLogId);
          if (updErr) throw new Error(`소모품 업데이트 실패: ${updErr.message}`);
        } else {
          const { error: insErr } = await supabase.from("work_log_materials").insert([payload]);
          if (insErr) throw new Error(`소모품 생성 실패: ${insErr.message}`);
        }
      }
    };
  
    // ========= run sync =========
    await syncWorkers();
    await syncEntries();
    await syncExpenses();
    await syncMaterials();
  
    // ✅ 제출 순간 알림(기존 로직 유지)
    if (!data.is_draft && wasDraft) {
      try {
        const gongmuUserIds = await getGongmuTeamUserIds();
        const creatorId = prevCreatedBy || data.created_by || null;
        const targetUserIds = creatorId ? gongmuUserIds.filter((id) => id !== creatorId) : gongmuUserIds;

        if (targetUserIds.length > 0) {
          await createNotificationsForUsers(
            targetUserIds,
            "새 보고서",
            `${workLog.author || "작성자"}님이 새 보고서를 제출했습니다.`,
            "report",
            JSON.stringify({ work_log_id: workLogId, route: `/worklog/${workLogId}` })
          );
        }
      } catch (notificationError: any) {
        console.error("알림 생성 실패:", notificationError?.message || notificationError);
      }
    }

    // ✅ 수정 후 조회 시 투입 인원 등이 최신으로 보이도록 캐시 무효화
    workLogCache.delete(workLogId);

    return workLog;
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
        created_at?: string;
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
        (data || []).map(async (receipt, index) => {
            let fileUrl: string | undefined;
            
            // 디버깅: 각 영수증의 정보 로그
            if (process.env.NODE_ENV === 'development') {
                console.log(`getWorkLogReceipts - Receipt ${index + 1}:`, {
                    id: receipt.id,
                    storage_path: receipt.storage_path,
                    original_name: receipt.original_name,
                    category: receipt.category,
                });
            }
            
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
                
                // 디버깅: 생성된 URL 로그
                if (process.env.NODE_ENV === 'development') {
                    console.log(`getWorkLogReceipts - Receipt ${index + 1} URL:`, {
                        id: receipt.id,
                        storage_path: receipt.storage_path,
                        file_url: fileUrl,
                    });
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
                created_at: receipt.created_at,
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

        // work_log_receipts - Storage 파일도 함께 삭제
        const { data: receiptsData } = await supabase
            .from("work_log_receipt")
            .select("id, storage_path, storage_bucket")
            .eq("work_log_id", workLogId);

        if (receiptsData && receiptsData.length > 0) {
            // Storage에서 파일 삭제
            const storagePaths = receiptsData
                .map((r) => r.storage_path)
                .filter((path): path is string => Boolean(path));
            
            if (storagePaths.length > 0) {
                // 버킷 이름 확인 (기본값: work-log-recipts)
                const bucketName = receiptsData[0]?.storage_bucket || "work-log-recipts";
                
                const { error: storageError } = await supabase.storage
                    .from(bucketName)
                    .remove(storagePaths);

                if (storageError) {
                    console.error("Error deleting receipt files from storage:", storageError);
                    // Storage 삭제 실패해도 DB는 삭제 시도
                }
            }
        }

        // DB에서 영수증 레코드 삭제
        await supabase
            .from("work_log_receipt")
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

export {
    getWorkLogSplitChainMemberIds,
    propagateWorkLogSplitChainPatch,
} from "./workLogSplitChain";
