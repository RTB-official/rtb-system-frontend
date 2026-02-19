// vehiclesApi.ts
import { supabase } from "./supabase";
import { createNotificationsForUsers, getAdminUserIds } from "./notificationApi";

export type VehicleRecord = {
    id: string;
    type: string;
    plate: string;
    color: string | null;
    primary_user: string | null;
    rental_start: string | null;
    contract_end: string | null;
    insurer: string | null;
    inspection_date: string | null;
    engine_oil_date: string | null;
    engine_oil_km: string | null;
    repair_note: string | null;
    registration_doc_bucket: string | null;
    registration_doc_path: string | null;
    registration_doc_name: string | null;
    inspection_alert_2m_at?: string | null;
    inspection_alert_1m_at?: string | null;
    created_at: string;
};

export type VehicleForm = {
    type: string;
    plate: string;
    color: string;
    primaryUser: string;
    rentalStart: string;
    contractEnd: string;
    insurer: string;
    inspection: string;
    engineOil: string;
    engineOilKm: string;
    repair: string;
    registrationBucket: string;
    registrationPath: string;
    registrationName: string;
};

const toFormValue = (value: string | null) => value ?? "";

const mapRecordToForm = (record: VehicleRecord): VehicleForm => ({
    type: record.type,
    plate: record.plate,
    color: toFormValue(record.color),
    primaryUser: toFormValue(record.primary_user),
    rentalStart: toFormValue(record.rental_start),
    contractEnd: toFormValue(record.contract_end),
    insurer: toFormValue(record.insurer),
    inspection: toFormValue(record.inspection_date),
    engineOil: toFormValue(record.engine_oil_date),
    engineOilKm: toFormValue(record.engine_oil_km),
    repair: toFormValue(record.repair_note),
    registrationBucket: toFormValue(record.registration_doc_bucket),
    registrationPath: toFormValue(record.registration_doc_path),
    registrationName: toFormValue(record.registration_doc_name),
});

const toDbValue = (value: string) => (value?.trim() ? value.trim() : null);

const mapFormToRecordInput = (form: VehicleForm) => ({
    type: form.type.trim(),
    plate: form.plate.trim(),
    color: toDbValue(form.color),
    primary_user: toDbValue(form.primaryUser),
    rental_start: toDbValue(form.rentalStart),
    contract_end: toDbValue(form.contractEnd),
    insurer: toDbValue(form.insurer),
    inspection_date: toDbValue(form.inspection),
    engine_oil_date: toDbValue(form.engineOil),
    engine_oil_km: toDbValue(form.engineOilKm),
    repair_note: toDbValue(form.repair),
    registration_doc_bucket: toDbValue(form.registrationBucket),
    registration_doc_path: toDbValue(form.registrationPath),
    registration_doc_name: toDbValue(form.registrationName),
});

const isWithinDays = (targetDate: string, days: number) => {
    const now = new Date();
    const target = new Date(targetDate);

    if (Number.isNaN(target.getTime())) return false;

    // 이미 지난 날짜는 제외
    if (target.getTime() < now.getTime()) return false;

    const diffMs = target.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= days;
};

async function notifyAdminsForVehicleInspectionDue(vehicles: VehicleRecord[]) {
    try {
        const adminIds = await getAdminUserIds();
        if (!adminIds || adminIds.length === 0) return;

        // ✅ 2달(60일) 이내 + 아직 2달 알림 안 보낸 차량만
        const due2m = vehicles.filter(
            (v) =>
                !!v.inspection_date &&
                isWithinDays(v.inspection_date, 60) &&
                !v.inspection_alert_2m_at
        );

        // ✅ 1달(30일) 이내 + 아직 1달 알림 안 보낸 차량만
        const due1m = vehicles.filter(
            (v) =>
                !!v.inspection_date &&
                isWithinDays(v.inspection_date, 30) &&
                !v.inspection_alert_1m_at
        );

        // ✅ 2달 알림: "한 개만" 생성
        if (due2m.length > 0) {
            const plates = due2m.map((v) => v.plate).filter(Boolean);
            const meta = JSON.stringify({
                kind: "vehicle_inspection_due_2m",
                route: "/vehicles",
                plates,
            });

            await createNotificationsForUsers(
                adminIds,
                "차량 검사 만료 2달 이내",
                `검사 만료일이 2달 이내인 차량이 있습니다: ${plates.join(", ")}`,
                "other",
                meta
            );

            // ✅ 해당 차량들 2달 알림 보냄 처리(차량별 1회 보장)
            await supabase
                .from("vehicles")
                .update({ inspection_alert_2m_at: new Date().toISOString() })
                .in("id", due2m.map((v) => v.id));
        }

        // ✅ 1달 알림: "한 개만" 생성
        if (due1m.length > 0) {
            const plates = due1m.map((v) => v.plate).filter(Boolean);
            const meta = JSON.stringify({
                kind: "vehicle_inspection_due_1m",
                route: "/vehicles",
                plates,
            });

            await createNotificationsForUsers(
                adminIds,
                "차량 검사 만료 1달 이내",
                `검사 만료일이 1달 이내인 차량이 있습니다: ${plates.join(", ")}`,
                "other",
                meta
            );

            // ✅ 해당 차량들 1달 알림 보냄 처리(차량별 1회 보장)
            await supabase
                .from("vehicles")
                .update({ inspection_alert_1m_at: new Date().toISOString() })
                .in("id", due1m.map((v) => v.id));
        }
    } catch (e) {
        console.error("차량 검사 만료 임박 알림 생성 실패:", e);
    }
}



export async function listVehicles(): Promise<VehicleRecord[]> {
    const { data, error } = await supabase
        .from("vehicles")
        .select(
             "id,type,plate,color,primary_user,rental_start,contract_end,insurer,inspection_date,engine_oil_date,engine_oil_km,repair_note,registration_doc_bucket,registration_doc_path,registration_doc_name,inspection_alert_2m_at,inspection_alert_1m_at,created_at"
        )
        .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }
    
        // ✅ 검사 만료일 2달 이내 차량이 있으면 admin에게 알림 생성
        await notifyAdminsForVehicleInspectionDue(data ?? []);
    
        return data ?? [];
    }
    

export async function createVehicle(form: VehicleForm): Promise<VehicleRecord> {
    const { data, error } = await supabase
        .from("vehicles")
        .insert(mapFormToRecordInput(form))
        .select(
            "id,type,plate,color,primary_user,rental_start,contract_end,insurer,inspection_date,engine_oil_date,engine_oil_km,repair_note,registration_doc_bucket,registration_doc_path,registration_doc_name,created_at"
        )
        .single();

    if (error) {
        throw error;
    }
    return data as VehicleRecord;
}

export async function updateVehicle(
    id: string,
    form: VehicleForm
): Promise<VehicleRecord> {
    const { data, error } = await supabase
        .from("vehicles")
        .update(mapFormToRecordInput(form))
        .eq("id", id)
        .select(
            "id,type,plate,color,primary_user,rental_start,contract_end,insurer,inspection_date,engine_oil_date,engine_oil_km,repair_note,registration_doc_bucket,registration_doc_path,registration_doc_name,created_at"
        )
        .single();

    if (error) {
        throw error;
    }
    return data as VehicleRecord;
}

export async function deleteVehicle(id: string): Promise<void> {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
        throw error;
    }
}

const REGISTRATION_BUCKET = "vehicle-registrations";

const getRandomId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `veh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export async function uploadVehicleRegistration(
    file: File
): Promise<{ bucket: string; path: string; name: string }> {
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${getRandomId()}.${fileExt}`;
    const { error } = await supabase.storage
        .from(REGISTRATION_BUCKET)
        .upload(fileName, file, { upsert: true });
    if (error) {
        throw error;
    }
    return {
        bucket: REGISTRATION_BUCKET,
        path: fileName,
        name: file.name,
    };
}

export async function deleteVehicleRegistration(
    bucket: string,
    path: string
): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
        throw error;
    }
}

export async function getVehicleRegistrationUrl(
    bucket: string,
    path: string
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (error || !data?.signedUrl) {
        const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
        if (!publicData?.publicUrl) {
            throw error || new Error("다운로드 URL 생성 실패");
        }
        return publicData.publicUrl;
    }
    return data.signedUrl;
}

export { mapRecordToForm };
