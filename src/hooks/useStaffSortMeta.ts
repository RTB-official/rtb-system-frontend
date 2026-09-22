import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PersonSortMeta } from "../utils/sortPeopleByRoleAndJoinDate";

let cache: Map<string, PersonSortMeta> | null = null;
let pending: Promise<Map<string, PersonSortMeta>> | null = null;

async function loadStaffSortMeta(): Promise<Map<string, PersonSortMeta>> {
    if (cache) {
        return cache;
    }
    if (pending) {
        return pending;
    }

    pending = (async () => {
        const { data, error } = await supabase
            .from("profiles")
            .select("name, position, join_date");

        if (error) {
            throw error;
        }

        const map = new Map<string, PersonSortMeta>();
        for (const row of data ?? []) {
            const name = (row.name ?? "").toString().trim();
            if (!name) {
                continue;
            }
            map.set(name, {
                position: row.position ?? null,
                joinDate: row.join_date ?? null,
            });
        }
        cache = map;
        pending = null;
        return map;
    })().catch((err) => {
        pending = null;
        throw err;
    });

    return pending;
}

/** 프로필 직급·입사일 메타 (이름 기준). 사이드패널 인원 정렬용 */
export function useStaffSortMeta(): Map<string, PersonSortMeta> {
    const [meta, setMeta] = useState<Map<string, PersonSortMeta>>(
        () => cache ?? new Map()
    );

    useEffect(() => {
        let cancelled = false;
        loadStaffSortMeta()
            .then((map) => {
                if (!cancelled) {
                    setMeta(map);
                }
            })
            .catch((err) => {
                console.error("직원 직급/입사일 조회 실패:", err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return meta;
}
