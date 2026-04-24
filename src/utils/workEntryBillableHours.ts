/** 패널 `getWorkingCorrectionLabel` / `getWorkingChargeLabel` 과 동일한 N+A 합산(작업) */

export const roundHours = (value: number) => Math.round(value * 10) / 10;

/** 컨텍스트 메뉴 `4h/8h 청구`(올림 청구)로 저장된 수동 청구시간인지 */
export function isManualRoundedBillableFourOrEight(
    hours: number | undefined | null
): hours is 4 | 8 {
    if (hours === undefined || hours === null) {
        return false;
    }
    const r = roundHours(hours);
    return r === 4 || r === 8;
}

function getOverlapMinutes(
    rangeStart: Date,
    rangeEnd: Date,
    targetStart: Date,
    targetEnd: Date
) {
    const overlapStart = new Date(
        Math.max(rangeStart.getTime(), targetStart.getTime())
    );
    const overlapEnd = new Date(
        Math.min(rangeEnd.getTime(), targetEnd.getTime())
    );

    if (overlapEnd <= overlapStart) {
        return 0;
    }

    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
}

/**
 * 구분이 `작업`일 때 자동 청구시간(N+A) 합계(시). 수동 청구는 호출부에서 처리.
 */
export function getWorkEntryAutoBillableTotalHours(entry: {
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
    descType: string;
    lunchWorked?: boolean | null;
}): number | null {
    if (entry.descType !== "작업") {
        return null;
    }
    if (!entry.dateFrom || !entry.dateTo || !entry.timeFrom || !entry.timeTo) {
        return null;
    }

    const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
    const end =
        entry.timeTo === "24:00"
            ? new Date(
                  new Date(`${entry.dateTo}T00:00:00`).getTime() +
                      24 * 60 * 60 * 1000
              )
            : new Date(`${entry.dateTo}T${entry.timeTo}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return null;
    }

    const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    const normalStart = new Date(`${entry.dateFrom}T08:00:00`);
    const normalEnd = new Date(`${entry.dateFrom}T17:00:00`);
    const lunchStart = new Date(`${entry.dateFrom}T12:00:00`);
    const lunchEnd = new Date(`${entry.dateFrom}T13:00:00`);

    const rawNormalMinutes = getOverlapMinutes(start, end, normalStart, normalEnd);
    let normalMinutes = rawNormalMinutes;

    const shouldDeductLunch = !entry.lunchWorked;

    if (shouldDeductLunch) {
        normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
    }

    normalMinutes = Math.max(0, normalMinutes);
    const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

    return roundHours((normalMinutes + afterMinutes) / 60);
}

export type WorkEntryBillableFourBuckets = {
    weekdayN: number;
    weekdayA: number;
    weekendN: number;
    weekendA: number;
};

function enumerateYmdInclusive(startYmd: string, endYmd: string): string[] {
    const out: string[] = [];
    const a = new Date(`${startYmd}T00:00:00`);
    const b = new Date(`${endYmd}T00:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
        return out;
    }
    const c = new Date(a);
    while (c <= b) {
        const y = c.getFullYear();
        const m = String(c.getMonth() + 1).padStart(2, "0");
        const d = String(c.getDate()).padStart(2, "0");
        out.push(`${y}-${m}-${d}`);
        c.setDate(c.getDate() + 1);
    }
    return out;
}

/**
 * 작업 엔트리: 일자/공휴·주말 구간별로 08:00~17:00(점심 제외) = N, 그 외 = A 를
 * 평일 N, 평일 A, 주말 N, 주말 A(주말·휴일)로 합산(시, 0.1h 반올림).
 * 다일 구간은 날짜를 나눠 `getWorkingChargeLabel` / `classifyWorkingHours` 와 동일한 방식(일마다 8~17·12~13)을 적용한다.
 */
export function getWorkEntryAutoBillableFourBuckets(
    entry: {
        dateFrom: string;
        dateTo: string;
        timeFrom: string;
        timeTo: string;
        descType: string;
        lunchWorked?: boolean | null;
    },
    isWeekendOrHoliday: (ymd: string) => boolean
): WorkEntryBillableFourBuckets | null {
    if (entry.descType !== "작업") {
        return null;
    }
    if (!entry.dateFrom || !entry.dateTo || !entry.timeFrom || !entry.timeTo) {
        return null;
    }

    const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
    const end =
        entry.timeTo === "24:00"
            ? new Date(
                  new Date(`${entry.dateTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
              )
            : new Date(`${entry.dateTo}T${entry.timeTo}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return null;
    }

    const ent0 = {
        startMs: start.getTime(),
        endMs: end.getTime(),
    };

    let wnM = 0;
    let waM = 0;
    let wknM = 0;
    let wkaM = 0;

    for (const ymd of enumerateYmdInclusive(entry.dateFrom, entry.dateTo)) {
        const d0 = new Date(`${ymd}T00:00:00`).getTime();
        const d1 = d0 + 24 * 60 * 60 * 1000;
        const seg0 = Math.max(ent0.startMs, d0);
        const seg1 = Math.min(ent0.endMs, d1);
        if (seg1 <= seg0) {
            continue;
        }

        const segS = new Date(seg0);
        const segE = new Date(seg1);
        const totalMin = Math.floor((seg1 - seg0) / 60000);
        if (totalMin <= 0) {
            continue;
        }

        const normalStart = new Date(`${ymd}T08:00:00`);
        const normalEnd = new Date(`${ymd}T17:00:00`);
        const lunchStart = new Date(`${ymd}T12:00:00`);
        const lunchEnd = new Date(`${ymd}T13:00:00`);

        const rawNormalMinutes = getOverlapMinutes(
            segS,
            segE,
            normalStart,
            normalEnd
        );
        let normalM = rawNormalMinutes;
        const shouldDeductLunch = !entry.lunchWorked;
        if (shouldDeductLunch) {
            normalM -= getOverlapMinutes(segS, segE, lunchStart, lunchEnd);
        }
        normalM = Math.max(0, normalM);
        const afterM = Math.max(0, totalMin - rawNormalMinutes);

        const wknd = isWeekendOrHoliday(ymd);
        if (wknd) {
            wknM += normalM;
            wkaM += afterM;
        } else {
            wnM += normalM;
            waM += afterM;
        }
    }

    return {
        weekdayN: roundHours(wnM / 60),
        weekdayA: roundHours(waM / 60),
        weekendN: roundHours(wknM / 60),
        weekendA: roundHours(wkaM / 60),
    };
}

/** `manual` 총 시가 있을 때 자동 4박스 비율에 맞춰 분배(합이 `manual` 에 가깝게). */
export function distributeWorkManualToFourBuckets(
    manual: number,
    auto: WorkEntryBillableFourBuckets
): WorkEntryBillableFourBuckets {
    const t = roundHours(manual);
    if (t <= 0 || !Number.isFinite(manual)) {
        return { weekdayN: 0, weekdayA: 0, weekendN: 0, weekendA: 0 };
    }
    const w: [number, number, number, number] = [
        auto.weekdayN,
        auto.weekdayA,
        auto.weekendN,
        auto.weekendA,
    ];
    const sumW = w[0]! + w[1]! + w[2]! + w[3]!;
    if (sumW <= 0) {
        return { weekdayN: 0, weekdayA: t, weekendN: 0, weekendA: 0 };
    }
    const raw: number[] = w.map((x) => t * (x / sumW));
    const o = raw.map((x) => roundHours(x));
    let s = o.reduce((a, b) => a + b, 0);
    let gap = roundHours(t - s);
    const idxOrder = [0, 1, 2, 3].sort((a, b) => raw[b]! - raw[a]!);
    for (let k = 0; k < 2000 && Math.abs(gap) > 0.001; k += 1) {
        const i = idxOrder[k % 4]!;
        o[i] = roundHours(o[i]! + (gap > 0 ? 0.1 : -0.1));
        if (o[i]! < 0) o[i] = 0;
        s = o.reduce((a, b) => a + b, 0);
        gap = roundHours(t - s);
    }
    return { weekdayN: o[0]!, weekdayA: o[1]!, weekendN: o[2]!, weekendA: o[3]! };
}

/** 엔트리 구간 시작 시각(ms). `getWorkEntryAutoBillableTotalHours` 와 동일한 시각 해석 */
export function getWorkEntryIntervalStartMs(entry: {
    dateFrom: string;
    timeFrom: string;
}): number | null {
    if (!entry.dateFrom || !entry.timeFrom) {
        return null;
    }
    const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
    return Number.isNaN(start.getTime()) ? null : start.getTime();
}

/** 엔트리 구간 종료 시각(ms). `24:00` 은 해당 일자 다음날 0시 */
export function getWorkEntryIntervalEndMs(entry: {
    dateTo: string;
    timeTo: string;
}): number | null {
    if (!entry.dateTo || !entry.timeTo) {
        return null;
    }
    const end =
        entry.timeTo === "24:00"
            ? new Date(
                  new Date(`${entry.dateTo}T00:00:00`).getTime() +
                      24 * 60 * 60 * 1000
              )
            : new Date(`${entry.dateTo}T${entry.timeTo}`);
    return Number.isNaN(end.getTime()) ? null : end.getTime();
}

function areWorkPersonListsEqual(
    a: string[] | undefined,
    b: string[] | undefined
): boolean {
    const pa = [...(a ?? [])].map((s) => s.trim()).filter(Boolean).sort();
    const pb = [...(b ?? [])].map((s) => s.trim()).filter(Boolean).sort();
    if (pa.length !== pb.length) {
        return false;
    }
    return pa.every((v, i) => v === pb[i]);
}

/**
 * 앞 엔트리 종료 시각 === 뒤 엔트리 시작 시각, 둘 다 작업, 인원 동일할 때만 연속으로 묶음.
 */
function canMergeConsecutiveWorkPair(
    earlier: {
        descType: string;
        dateTo: string;
        timeTo: string;
        persons?: string[];
    },
    later: {
        descType: string;
        dateFrom: string;
        timeFrom: string;
        persons?: string[];
    }
): boolean {
    if (earlier.descType !== "작업" || later.descType !== "작업") {
        return false;
    }
    if (!areWorkPersonListsEqual(earlier.persons, later.persons)) {
        return false;
    }
    const endEarlier = getWorkEntryIntervalEndMs(earlier);
    const startLater = getWorkEntryIntervalStartMs(later);
    if (endEarlier === null || startLater === null) {
        return false;
    }
    return endEarlier === startLater;
}

export type WorkEntryClusterable = {
    id: number;
    descType: string;
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
    persons?: string[];
    lunchWorked?: boolean | null;
};

/**
 * 시작 시각 순으로 정렬했을 때 To=From 으로 이어지는 작업 엔트리 묶음(같은 인원).
 * `targetIndex` 가 속한 묶음의 인덱스 배열을 반환.
 */
export function buildConsecutiveWorkClusterIndices(
    allEntries: WorkEntryClusterable[],
    targetIndex: number
): number[] {
    const n = allEntries.length;
    if (targetIndex < 0 || targetIndex >= n) {
        return [targetIndex];
    }

    const sortedIndices = [...Array(n).keys()].sort((a, b) => {
        const sa = getWorkEntryIntervalStartMs(allEntries[a]);
        const sb = getWorkEntryIntervalStartMs(allEntries[b]);
        if (sa !== null && sb !== null && sa !== sb) {
            return sa - sb;
        }
        return (allEntries[a].id ?? 0) - (allEntries[b].id ?? 0);
    });

    const runs: number[][] = [];
    let run: number[] = [];

    for (const idx of sortedIndices) {
        if (run.length === 0) {
            run.push(idx);
            continue;
        }
        const prevIdx = run[run.length - 1];
        if (
            canMergeConsecutiveWorkPair(allEntries[prevIdx], allEntries[idx])
        ) {
            run.push(idx);
        } else {
            runs.push(run);
            run = [idx];
        }
    }
    if (run.length > 0) {
        runs.push(run);
    }

    for (const r of runs) {
        if (r.includes(targetIndex)) {
            return r;
        }
    }
    return [targetIndex];
}

/**
 * 연속 작업 클러스터에 대해 엔트리별 청구시간을 합산.
 */
export function sumClusterWorkBillableHours(
    clusterIndices: number[],
    getBillableHoursForEntryIndex: (index: number) => number | null
): number | null {
    let sum = 0;
    for (const i of clusterIndices) {
        const h = getBillableHoursForEntryIndex(i);
        if (h === null) {
            return null;
        }
        sum += h;
    }
    return roundHours(sum);
}
