// tbmApi.ts
import { supabase } from "./supabase";
import { createNotificationsForUsers } from "./notificationApi";


export interface TbmRecord {
    id: string;
    tbm_date: string | null;
    line_name: string | null;
    work_name: string | null;
    work_content: string | null;
    location: string | null;
    risk_assessment: boolean | null;
    process: string | null;
    hazard: string | null;
    measure: string | null;
    process_items: string[] | null;
    hazard_items: string[] | null;
    measure_items: string[] | null;
    during_result: string | null;
    after_meeting: string | null;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
}

export interface TbmParticipant {
    id: string;
    tbm_id: string;
    user_id: string;
    name: string | null;
    signed_at: string | null;
}

export interface CreateTbmInput {
    tbm_date: string | null;
    line_name: string;
    work_name: string;
    work_content: string;
    location: string;
    risk_assessment: boolean | null;
    process: string;
    hazard: string;
    measure: string;
    process_items: string[];
    hazard_items: string[];
    measure_items: string[];
    during_result: string;
    after_meeting: string;
    participants: Array<{ user_id: string | null; name: string }>;
}

export interface UpdateTbmInput extends CreateTbmInput {
    id: string;
}

export async function createTbm(input: CreateTbmInput) {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("로그인이 필요합니다.");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

    const normalizedParticipants = (input.participants || [])
        .map((p) => ({
            name: (p.name || "").trim(),
            user_id: p.user_id,
        }))
        .filter((p) => p.name.length > 0);

    const resolvedParticipants: Array<{ user_id: string; name: string }> = [];
    const unresolved: string[] = [];

    for (const p of normalizedParticipants) {
        let userId = p.user_id || null;
        if (!userId) {
            const { data: byName } = await supabase
                .from("profiles")
                .select("id")
                .eq("name", p.name)
                .limit(1);
            if (byName && byName.length > 0) {
                userId = byName[0].id;
            } else {
                const { data: byUsername } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("username", p.name)
                    .limit(1);
                if (byUsername && byUsername.length > 0) {
                    userId = byUsername[0].id;
                }
            }
        }

        if (userId) {
            resolvedParticipants.push({ user_id: userId, name: p.name });
        } else {
            unresolved.push(p.name);
        }
    }

    if (unresolved.length > 0) {
        throw new Error(`\uCC38\uC11D\uC790 \uD655\uC778 \uD544\uC694: ${unresolved.join(", ")}`);
    }

    const uniqueParticipants = Array.from(
        new Map(resolvedParticipants.map((p) => [p.user_id, p])).values()
    );

    const { data: tbm, error } = await supabase
        .from("tbm")
        .insert([
            {
                tbm_date: input.tbm_date || null,
                line_name: input.line_name || null,
                work_name: input.work_name || null,
                work_content: input.work_content || null,
                location: input.location || null,
                risk_assessment: input.risk_assessment,
                process: input.process || null,
                hazard: input.hazard || null,
                measure: input.measure || null,
                process_items: input.process_items || null,
                hazard_items: input.hazard_items || null,
                measure_items: input.measure_items || null,
                during_result: input.during_result || null,
                after_meeting: input.after_meeting || null,
                created_by: user.id,
                created_by_name: profile?.name || null,
            },
        ])
        .select()
        .single();

    if (error || !tbm) {
        throw new Error(`TBM 저장 실패: ${error?.message || "알 수 없는 오류"}`);
    }

    if (uniqueParticipants.length > 0) {
        const rows = uniqueParticipants.map((p) => ({
            tbm_id: tbm.id,
            user_id: p.user_id,
            name: p.name,
        }));

        const { error: partError } = await supabase
            .from("tbm_participants")
            .upsert(rows, { onConflict: "tbm_id,user_id", ignoreDuplicates: true });

        if (partError) {
            console.error("TBM 참가자 저장 실패:", partError);
        }

        const participantIds = rows
            .map((r) => r.user_id)
            .filter((id) => id && id !== user.id);

        try {


            // ✅ 참여자: 서명 요청 (작성자 제외)
            const participantRecipients = Array.from(new Set(participantIds)).filter(
                (id) => id && id !== user.id
            );


            const metaToTbm = JSON.stringify({ tbm_id: tbm.id });

            if (participantRecipients.length > 0) {
                await createNotificationsForUsers(
                    participantRecipients,
                    "TBM 서명 요청",
                    "새로운 TBM이 등록되었습니다. 서명 확인을 해주세요.",
                    "other",
                    metaToTbm
                );
            }
        } catch (e) {
            console.error("TBM 알림 생성 실패:", e);
        }


    }

    return tbm as TbmRecord;
}

export async function updateTbm(input: UpdateTbmInput) {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("로그인이 필요합니다.");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

    const normalizedParticipants = (input.participants || [])
        .map((p) => ({
            name: (p.name || "").trim(),
            user_id: p.user_id,
        }))
        .filter((p) => p.name.length > 0);

    const resolvedParticipants: Array<{ user_id: string; name: string }> = [];
    const unresolved: string[] = [];

    for (const p of normalizedParticipants) {
        let userId = p.user_id || null;
        if (!userId) {
            const { data: byName } = await supabase
                .from("profiles")
                .select("id")
                .eq("name", p.name)
                .limit(1);
            if (byName && byName.length > 0) {
                userId = byName[0].id;
            } else {
                const { data: byUsername } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("username", p.name)
                    .limit(1);
                if (byUsername && byUsername.length > 0) {
                    userId = byUsername[0].id;
                }
            }
        }

        if (userId) {
            resolvedParticipants.push({ user_id: userId, name: p.name });
        } else {
            unresolved.push(p.name);
        }
    }

    if (unresolved.length > 0) {
        throw new Error(`참석자 확인 필요: ${unresolved.join(", ")}`);
    }

    const uniqueParticipants = Array.from(
        new Map(resolvedParticipants.map((p) => [p.user_id, p])).values()
    );

    const { data: tbm, error } = await supabase
        .from("tbm")
        .update({
            tbm_date: input.tbm_date || null,
            line_name: input.line_name || null,
            work_name: input.work_name || null,
            work_content: input.work_content || null,
            location: input.location || null,
            risk_assessment: input.risk_assessment,
            process: input.process || null,
            hazard: input.hazard || null,
            measure: input.measure || null,
            process_items: input.process_items || null,
            hazard_items: input.hazard_items || null,
            measure_items: input.measure_items || null,
            during_result: input.during_result || null,
            after_meeting: input.after_meeting || null,
            created_by_name: profile?.name || null,
        })
        .eq("id", input.id)
        .select()
        .single();

    if (error || !tbm) {
        throw new Error(`TBM 수정 실패: ${error?.message || "알 수 없는 오류"}`);
    }

    // Preserve existing participants (and signatures), add new ones.
    const { data: existing } = await supabase
        .from("tbm_participants")
        .select("user_id, name, signed_at")
        .eq("tbm_id", input.id);

    const existingMap = new Map(
        (existing || []).map((p: any) => [p.user_id, p])
    );

    const merged = new Map<string, { user_id: string; name: string; signed_at: string | null }>();

    (existing || []).forEach((p: any) => {
        if (p.user_id) {
            merged.set(p.user_id, {
                user_id: p.user_id,
                name: p.name || "",
                signed_at: p.signed_at || null,
            });
        }
    });

    uniqueParticipants.forEach((p) => {
        const prev = existingMap.get(p.user_id);
        merged.set(p.user_id, {
            user_id: p.user_id,
            name: p.name,
            signed_at: prev?.signed_at || null,
        });
    });

    const rows = Array.from(merged.values()).map((p) => ({
        tbm_id: input.id,
        user_id: p.user_id,
        name: p.name,
        signed_at: p.signed_at,
    }));

    if (rows.length > 0) {
        const { error: partError } = await supabase
            .from("tbm_participants")
            .upsert(rows, { onConflict: "tbm_id,user_id", ignoreDuplicates: false });

        if (partError) {
            throw new Error(`참석자 저장 실패: ${partError.message}`);
        }
    }

    return tbm as TbmRecord;
}

export async function getTbmList() {
    const { data, error } = await supabase
        .from("tbm")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`TBM 목록 조회 실패: ${error.message}`);
    }

    const { data: participants } = await supabase
        .from("tbm_participants")
        .select("tbm_id, signed_at");

    return {
        tbmList: (data || []) as TbmRecord[],
        participants: participants || [],
    };
}

export async function getTbmDetail(id: string) {
    const { data: tbm, error } = await supabase
        .from("tbm")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !tbm) {
        throw new Error(`TBM 조회 실패: ${error?.message || "알 수 없는 오류"}`);
    }

    const { data: participants, error: partError } = await supabase
        .from("tbm_participants")
        .select("*")
        .eq("tbm_id", id)
        .order("created_at", { ascending: true });

    if (partError) {
        throw new Error(`TBM 참가자 조회 실패: ${partError.message}`);
    }

    return {
        tbm: tbm as TbmRecord,
        participants: (participants || []) as TbmParticipant[],
    };
}

export async function signTbm(tbmId: string, userId: string) {
    const { data: updatedRows, error } = await supabase
        .from("tbm_participants")
        .update({ signed_at: new Date().toISOString() })
        .eq("tbm_id", tbmId)
        .eq("user_id", userId)
        .is("signed_at", null)
        .select("id");

    if (error) {
        throw new Error(`서명 처리 실패: ${error.message}`);
    }

    // ✅ 이미 서명된 상태에서 또 호출된 경우(더블 클릭 등) → 여기서 종료
    if (!updatedRows || updatedRows.length === 0) {
        return;
    }

    // ✅ 전원 서명 완료 시 작성자에게 알림
    try {
        const { data: unsigned, error: unsignedError } = await supabase
            .from("tbm_participants")
            .select("id")
            .eq("tbm_id", tbmId)
            .is("signed_at", null)
            .limit(1);

        if (unsignedError) {
            console.error("서명 상태 확인 실패:", unsignedError);
            return;
        }

        const allSigned = !unsigned || unsigned.length === 0;
        if (!allSigned) return;

        const { data: tbm, error: tbmError } = await supabase
            .from("tbm")
            .select("id, created_by")
            .eq("id", tbmId)
            .single();

        if (tbmError || !tbm?.created_by) {
            console.error("TBM 작성자 조회 실패:", tbmError);
            return;
        }

        const meta = JSON.stringify({ tbm_id: tbmId, kind: "tbm_all_signed" });

        await createNotificationsForUsers(
            [tbm.created_by],
            "TBM 서명 완료",
            "참여자 전원이 TBM 서명을 완료했습니다.",
            "other",
            meta
        );
    } catch (e) {
        console.error("TBM 서명 완료 알림 생성 실패:", e);
    }
}




export async function deleteTbm(id: string) {
    const { error } = await supabase.from("tbm").delete().eq("id", id);

    if (error) {
        throw new Error(`TBM ?? ??: ${error.message}`);
    }
}
