// src/components/common/Avatar.tsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

type Props = {
    email?: string | null;
    size?: number; // px
    position?: string | null; // 직급
};

// 전역 메모리 캐시 (같은 email에 대한 중복 조회 방지)
const positionCache = new Map<string, string | null>();
const pendingQueries = new Map<string, Promise<string | null>>();

// localStorage에서 직급 정보를 동기적으로 읽어오는 헬퍼 함수 (초기값용)
function getInitialPosition(email: string | null | undefined, position: string | null | undefined): string | null {
    // position prop이 있고 빈 문자열이 아니면 우선 사용
    if (position && position.trim() !== "") return position;

    // SSR 환경이면 null 반환
    if (typeof window === "undefined") return null;

    // email이 없으면 null 반환
    if (!email) return null;

    // 메모리 캐시 확인
    if (positionCache.has(email)) {
        return positionCache.get(email) || null;
    }

    // 현재 사용자의 email 확인
    const cachedEmail = localStorage.getItem("sidebarEmail");

    // email이 있고, 현재 사용자의 email과 일치하면 캐시된 직급 사용
    if (cachedEmail && email === cachedEmail) {
        const cachedPosition = localStorage.getItem("sidebarPosition");
        // 캐시된 직급이 있고 빈 문자열이 아니면 사용
        if (cachedPosition && cachedPosition.trim() !== "") {
            positionCache.set(email, cachedPosition); // 메모리 캐시에도 저장
            return cachedPosition;
        }
    }

    // employeeProfiles_cache에서 찾기 (구성원 지출 관리 페이지용)
    try {
        const employeeProfilesCache = localStorage.getItem("employeeProfiles_cache");
        if (employeeProfilesCache) {
            const parsed = JSON.parse(employeeProfilesCache);
            // email로 매칭되는 프로필 찾기
            for (const [, profile] of Object.entries(parsed) as [string, any][]) {
                if (profile?.email === email && profile?.position && profile.position.trim() !== "") {
                    positionCache.set(email, profile.position); // 메모리 캐시에도 저장
                    return profile.position;
                }
            }
        }
    } catch {
        // 캐시 파싱 실패 시 무시
    }

    // members_cache_v1에서 찾기 (구성원 관리 페이지용)
    try {
        const membersCache = localStorage.getItem("members_cache_v1");
        if (membersCache) {
            const parsed = JSON.parse(membersCache);
            // email로 매칭되는 멤버 찾기
            const member = parsed.find((m: any) => m?.email === email);
            if (member?.role && member.role.trim() !== "") {
                positionCache.set(email, member.role); // 메모리 캐시에도 저장
                return member.role;
            }
        }
    } catch {
        // 캐시 파싱 실패 시 무시
    }

    return null;
}

// 데이터베이스에서 직급 조회
async function fetchPositionFromDB(email: string): Promise<string | null> {
    // 이미 진행 중인 쿼리가 있으면 그것을 반환
    if (pendingQueries.has(email)) {
        return pendingQueries.get(email)!;
    }

    // 쿼리 실행
    const queryPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("position")
                .eq("email", email)
                .single();

            if (error || !data) {
                positionCache.set(email, null);
                return null;
            }

            const pos = data.position?.trim() || null;
            positionCache.set(email, pos);
            return pos;
        } catch (error) {
            console.error("직급 조회 실패:", error);
            positionCache.set(email, null);
            return null;
        } finally {
            pendingQueries.delete(email);
        }
    })();

    pendingQueries.set(email, queryPromise);
    return queryPromise;
}

export default function Avatar({ email, size = 32, position }: Props) {
    // 초기 렌더링 시점에 동기적으로 캐시에서 직급 정보를 읽어옴 (깜빡임 방지)
    const initialPosition = getInitialPosition(email, position);
    const [cachedPosition, setCachedPosition] = useState<string | null>(initialPosition);

    const lastEmailRef = useRef<string | null | undefined>(null);

    // position prop이나 email이 변경되면 업데이트
    useEffect(() => {
        // position prop이 있으면 우선 사용
        if (position && position.trim() !== "") {
            setCachedPosition(position);
            if (email) {
                positionCache.set(email, position);
            }
            lastEmailRef.current = email;
            return;
        }

        // email이 없으면 null
        if (!email) {
            setCachedPosition(null);
            lastEmailRef.current = null;
            return;
        }

        // email이 변경되지 않았고 이미 조회했으면 스킵
        if (lastEmailRef.current === email && positionCache.has(email)) {
            setCachedPosition(positionCache.get(email) || null);
            return;
        }

        // 메모리 캐시 확인
        if (positionCache.has(email)) {
            setCachedPosition(positionCache.get(email) || null);
            lastEmailRef.current = email;
            return;
        }

        // 초기값이 있으면 (localStorage에서 찾은 경우) 그대로 사용
        const initialPos = getInitialPosition(email, position);
        if (initialPos) {
            setCachedPosition(initialPos);
            lastEmailRef.current = email;
            return;
        }

        // 캐시에 없으면 DB에서 조회
        lastEmailRef.current = email;
        fetchPositionFromDB(email).then((pos) => {
            // email이 변경되지 않았는지 확인 (비동기 처리 중 email이 변경될 수 있음)
            if (lastEmailRef.current === email) {
                setCachedPosition(pos);
            }
        });
    }, [email, position]);

    const text = (() => {
        if (!email) return "U";
        const id = email.split("@")[0]; // mw.park
        return id.slice(0, 2).toLowerCase(); // mw
    })();

    // position prop이 있으면 우선 사용, 없으면 cachedPosition 사용
    const finalPosition = (position && position.trim() !== "") ? position : cachedPosition;

    const bgColor = (() => {
        // position이 없으면 투명하게 (fallback 색상 방지)
        if (!finalPosition) {
            return "transparent";
        }

        switch (finalPosition) {
            case "인턴":
                return "#94A3B8"; // slate
            case "사원":
                return "#64748B"; // slate-500
            case "주임":
                return "#22C55E"; // green
            case "대리":
                return "#6366F1"; // indigo
            case "과장":
                return "#A855F7"; // purple
            case "차장":
                return "#efc404"; // yellow (노란색)
            case "부장":
                return "#EF4444"; // red
            case "감사":
                return "#0EA5E9"; // cyan (감사용)
            case "대표":
                return "#111827"; // almost black
            default:
                return "transparent"; // fallback 대신 투명
        }
    })();


    // email이 있고 position이 null이면 아예 렌더링하지 않기 (주황색 fallback 방지)
    // position prop이 있거나, cachedPosition이 있거나, email이 없을 때만 렌더링
    const hasPosition = (position && position.trim() !== "") || cachedPosition !== null;
    const shouldRender = !email || hasPosition;

    if (!shouldRender) {
        // position이 확정될 때까지 투명한 플레이스홀더 렌더링 (레이아웃 유지)
        return (
            <div
                className="rounded-full flex items-center justify-center"
                style={{
                    width: size,
                    height: size,
                    backgroundColor: "transparent",
                }}
            />
        );
    }

    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-semibold uppercase"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.5,
                backgroundColor: bgColor,
            }}
        >
            {text}
        </div>
    );
}
