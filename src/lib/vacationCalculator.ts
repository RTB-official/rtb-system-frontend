/**
 * 입사일 기준 연차 계산 유틸리티
 */

/**
 * 두 날짜 사이의 일수 계산
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 두 날짜 사이의 년수 계산 (소수점 포함)
 */
function getYearsBetween(startDate: Date, endDate: Date): number {
    const days = getDaysBetween(startDate, endDate);
    return days / 365;
}

/**
 * 입사일 기준 연차 계산
 * @param joinDate 입사일 (YYYY-MM-DD 형식)
 * @param targetYear 계산할 연도
 * @param targetDate 계산 기준일 (기본값: 현재 날짜) - 해당 날짜까지 지급받은 연차 계산
 * @returns 해당 연도의 총 연차 일수
 */
export function calculateAnnualLeave(
    joinDate: string,
    targetYear: number,
    targetDate: Date = new Date()
): number {
    const join = new Date(joinDate);
    join.setHours(0, 0, 0, 0);
    
    const yearStart = new Date(targetYear, 0, 1); // 해당 연도의 1월 1일
    const yearEnd = new Date(targetYear, 11, 31); // 해당 연도의 12월 31일
    const previousYearEnd = new Date(targetYear - 1, 11, 31); // 전년도 12월 31일
    
    // 입사일이 해당 연도보다 나중이면 연차 없음
    if (join > yearEnd) {
        return 0;
    }
    
    // 입사일 기준으로 해당 연도 1월 1일까지의 재직 기간 계산
    const yearsOfServiceAtYearStart = getYearsBetween(join, yearStart);
    
    // 입사 1년 미만인 경우 (해당 연도 1월 1일 기준)
    if (yearsOfServiceAtYearStart < 1) {
        // 입사일 기준으로 매월 같은 날짜에 1개씩 지급
        // 해당 연도에 지급받을 연차 개수 계산 (현재 날짜까지)
        let count = 0;
        
        // 입사일의 일(day) 추출
        const joinDay = join.getDate();
        const joinYear = join.getFullYear();
        const joinMonth = join.getMonth();
        
        // 입사일 다음 달부터 시작 (1개월 후)
        let monthOffset = 1;
        
        // 입사일 1년 되는 날 계산
        const oneYearAfterJoin = new Date(join);
        oneYearAfterJoin.setFullYear(join.getFullYear() + 1);
        
        // 입사일 1년 되는 날이 해당 연도 내에 있고, 현재 날짜 이전인 경우
        if (oneYearAfterJoin >= yearStart && oneYearAfterJoin <= yearEnd && oneYearAfterJoin <= targetDate) {
            // 전년도 근무일수 계산 (입사일부터 전년도 12월 31일까지)
            const workDaysInPreviousYear = getDaysBetween(join, previousYearEnd);
            
            // 전년도 근무일수/365*15 올림 처리
            const proratedDays = Math.ceil((workDaysInPreviousYear / 365) * 15);
            
            // 입사일 1년 되는 날까지의 월별 지급 연차는 제외하고, 일괄 지급만 카운트
            return proratedDays;
        }
        
        // 입사일 1년 되는 날 이전까지는 매월 1개씩 지급
        while (true) {
            // 입사일로부터 N개월 후 날짜 계산
            const calculatedYear = joinYear + Math.floor((joinMonth + monthOffset) / 12);
            const calculatedMonth = (joinMonth + monthOffset) % 12;
            
            // 해당 연도 범위를 벗어나면 종료
            if (calculatedYear > targetYear) {
                break;
            }
            
            // 날짜 생성 (입사일과 같은 일자)
            const grantDate = new Date(calculatedYear, calculatedMonth, 1);
            const lastDayOfMonth = new Date(calculatedYear, calculatedMonth + 1, 0).getDate();
            const finalDay = Math.min(joinDay, lastDayOfMonth);
            grantDate.setDate(finalDay);
            
            // 입사일 1년 되는 날 이후는 월별 지급 중단
            if (grantDate >= oneYearAfterJoin) {
                break;
            }
            
            // 현재 날짜까지 지급받은 연차만 카운트
            if (grantDate > targetDate) {
                break;
            }
            
            // 해당 연도 내에 있는 경우 카운트
            if (grantDate >= yearStart && grantDate <= yearEnd) {
                count++;
            }
            
            // 다음 달로 이동
            monthOffset++;
            
            // 해당 연도를 벗어나면 종료
            if (grantDate > yearEnd && calculatedYear >= targetYear) {
                break;
            }
        }
        
        return count;
    }
    
    // 입사 1년 이상인 경우
    // 1월 1일 기준으로 기본 연차 지급
    let baseDays = 15;
    
    // 재직 기간에 따른 추가 연차 계산
    // 3년차(2년 이상), 5년차(4년 이상), 7년차(6년 이상)... 2년마다 +1개
    const fullYears = Math.floor(yearsOfServiceAtYearStart);
    if (fullYears >= 2) {
        // 2년 이상: (fullYears - 1) / 2 만큼 추가
        const additionalYears = fullYears - 1;
        const additionalDays = Math.floor(additionalYears / 2);
        baseDays += additionalDays;
    }
    
    // 입사일이 해당 연도 중간에 있는 경우 (해당 연도에 1년을 채운 경우)
    // 전년도 근무일/365일 * 15 계산값을 올림 처리해서 12월 31일까지 지급
    if (join > yearStart && join <= yearEnd) {
        // 입사일부터 전년도 12월 31일까지의 근무일 계산
        const workDaysInPreviousYear = getDaysBetween(join, previousYearEnd);
        
        // 전년도 근무일/365일 * 15 올림 처리
        const proratedDays = Math.ceil((workDaysInPreviousYear / 365) * 15);
        
        // 1월 1일 기준 기본 연차와 비교하여 더 큰 값 사용
        baseDays = Math.max(baseDays, proratedDays);
    }
    
    // 입사일 기준 추가 연차 계산 (3년째부터 2년마다 1개씩)
    // 해당 연도 1월 1일 기준으로 입사일로부터 몇 년이 지났는지 계산
    const joinDay = join.getDate();
    const joinMonth = join.getMonth();
    const joinYear = join.getFullYear();
    
    // 입사일로부터 3년째 되는 날짜
    const threeYearAnniversary = new Date(joinYear + 3, joinMonth, joinDay);
    threeYearAnniversary.setHours(0, 0, 0, 0);
    
    // 해당 연도 1월 1일 이전에 입사일 기준 3년째가 지났는지 확인
    if (threeYearAnniversary <= yearStart) {
        // 입사일로부터 경과한 연수 계산 (해당 연도 1월 1일 기준)
        const yearsSinceJoin = targetYear - joinYear;
        
        // 3년째부터 2년마다 추가 연차 계산
        if (yearsSinceJoin >= 3) {
            const additionalYears = yearsSinceJoin - 3; // 3년을 뺀 나머지 연수
            const additionalDaysFromAnniversary = Math.floor(additionalYears / 2) + 1; // 3년째 포함
            baseDays += additionalDaysFromAnniversary;
        }
    } else {
        // 해당 연도 중에 입사일 기준 3년째가 되는 경우
        // 해당 연도 1월 1일부터 입사일 기준 3년째까지의 기간 확인
        if (threeYearAnniversary >= yearStart && threeYearAnniversary <= yearEnd && threeYearAnniversary <= targetDate) {
            baseDays += 1; // 3년째 되는 날에 1개 추가
        }
    }
    
    // 입사일이 해당 연도 이전인 경우 기본 연차 반환
    return baseDays;
}

/**
 * 특정 연도의 연차 잔액 계산
 * @param joinDate 입사일
 * @param targetYear 계산할 연도
 * @param usedDays 사용한 연차 일수
 * @returns 남은 연차 일수
 */
export function calculateRemainingLeave(
    joinDate: string,
    targetYear: number,
    usedDays: number
): number {
    const totalDays = calculateAnnualLeave(joinDate, targetYear);
    return Math.max(0, totalDays - usedDays);
}

/**
 * 연차 지급/소멸 내역 계산
 * @param joinDate 입사일
 * @param targetYear 계산할 연도
 * @param currentDate 현재 날짜 (기본값: 오늘)
 * @returns 지급/소멸 내역 배열
 */
export interface VacationGrantHistory {
    date: string; // YYYY-MM-DD
    granted?: number; // 지급 일수
    expired?: number; // 소멸 일수 (있는 경우)
}

export function getVacationGrantHistory(
    joinDate: string,
    targetYear: number,
    currentDate: Date = new Date()
): VacationGrantHistory[] {
    const join = new Date(joinDate);
    join.setHours(0, 0, 0, 0);
    
    const yearStart = new Date(targetYear, 0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const yearEnd = new Date(targetYear, 11, 31);
    yearEnd.setHours(23, 59, 59, 999); // 12월 31일 끝까지 포함
    const previousYearEnd = new Date(targetYear - 1, 11, 31);
    previousYearEnd.setHours(23, 59, 59, 999);
    
    const history: VacationGrantHistory[] = [];
    
    // 입사일 기준으로 해당 연도 1월 1일까지의 재직 기간 계산
    const yearsOfServiceAtYearStart = getYearsBetween(join, yearStart);
    
    // 입사 1년 미만인 경우
    if (yearsOfServiceAtYearStart < 1) {
        // 입사일의 일(day) 추출
        const joinDay = join.getDate();
        const joinYear = join.getFullYear();
        const joinMonth = join.getMonth();
        
        // 입사일 다음 달부터 시작 (1개월 후)
        let monthOffset = 1;
        
        // 입사일 1년 되는 날 계산
        const oneYearAfterJoin = new Date(join);
        oneYearAfterJoin.setFullYear(join.getFullYear() + 1);
        let anniversaryProratedGrantDays = 0;
        let hasAnniversaryProratedGrant = false;
        
        // 입사일 1년 되는 날이 해당 연도 내에 있고, 현재 날짜 이전인 경우
        if (oneYearAfterJoin >= yearStart && oneYearAfterJoin <= yearEnd && oneYearAfterJoin <= currentDate) {
            // 전년도 근무일수 계산 (입사일부터 전년도 12월 31일까지)
            const workDaysInPreviousYear = getDaysBetween(join, previousYearEnd);
            
            // 전년도 근무일수/365*15 올림 처리
            const proratedDays = Math.ceil((workDaysInPreviousYear / 365) * 15);
            
            // 입사일 1년 되는 날에 일괄 지급
            const year = oneYearAfterJoin.getFullYear();
            const month = String(oneYearAfterJoin.getMonth() + 1).padStart(2, '0');
            const day = String(oneYearAfterJoin.getDate()).padStart(2, '0');
            history.push({
                date: `${year}-${month}-${day}`,
                granted: proratedDays,
            });
            anniversaryProratedGrantDays = proratedDays;
            hasAnniversaryProratedGrant = true;
        } else {
            // 입사일 1년 되는 날 이전까지는 매월 1개씩 지급
            while (true) {
                // 입사일로부터 N개월 후 날짜 계산
                const calculatedYear = joinYear + Math.floor((joinMonth + monthOffset) / 12);
                const calculatedMonth = (joinMonth + monthOffset) % 12;
                
                // 해당 연도 범위를 벗어나면 종료
                if (calculatedYear > targetYear) {
                    break;
                }
                
                // 날짜 생성 (입사일과 같은 일자)
                const grantDate = new Date(calculatedYear, calculatedMonth, 1);
                const lastDayOfMonth = new Date(calculatedYear, calculatedMonth + 1, 0).getDate();
                const finalDay = Math.min(joinDay, lastDayOfMonth);
                grantDate.setDate(finalDay);
                
                // 입사일 1년 되는 날 이후는 월별 지급 중단
                if (grantDate >= oneYearAfterJoin) {
                    break;
                }
                
                // 현재 날짜까지만 지급 내역 표시
                if (grantDate > currentDate) {
                    monthOffset++;
                    if (grantDate > yearEnd && calculatedYear >= targetYear) {
                        break;
                    }
                    continue;
                }
                
                // 해당 연도 내에 있는 경우만 추가
                if (grantDate >= yearStart && grantDate <= yearEnd) {
                    // 타임존 문제 방지를 위해 로컬 날짜로 직접 구성
                    const year = grantDate.getFullYear();
                    const month = String(grantDate.getMonth() + 1).padStart(2, '0');
                    const day = String(grantDate.getDate()).padStart(2, '0');
                    history.push({
                        date: `${year}-${month}-${day}`,
                        granted: 1,
                    });
                }
                
                // 다음 달로 이동
                monthOffset++;
                
                // 해당 연도를 벗어나면 종료
                if (grantDate > yearEnd && calculatedYear >= targetYear) {
                    break;
                }
            }
        }
        
        // Expiry handling for pre-1-year grants
        if (hasAnniversaryProratedGrant) {
            // Prorated grant on 1-year anniversary expires on 12/31 of that year
            const yearEndDate = new Date(targetYear, 11, 31);
            yearEndDate.setHours(0, 0, 0, 0);
            if (yearEndDate <= currentDate && anniversaryProratedGrantDays > 0) {
                const expiryYear = targetYear;
                const expiryMonth = "12";
                const expiryDay = "31";
                history.push({
                    date: `${expiryYear}-${expiryMonth}-${expiryDay}`,
                    expired: -anniversaryProratedGrantDays,
                });
            }
        } else {
            const oneYearAfterJoinForExpiry = new Date(join);
            oneYearAfterJoinForExpiry.setFullYear(join.getFullYear() + 1);
            oneYearAfterJoinForExpiry.setDate(join.getDate() - 1); // Day before 1-year anniversary
            
            // Only add expiry entry when expiry date is within the year and in the past
            if (oneYearAfterJoinForExpiry >= yearStart && oneYearAfterJoinForExpiry <= yearEnd && oneYearAfterJoinForExpiry <= currentDate) {
                // Find grants that expire before the expiry date
                const expiredLeaves = history.filter(h => {
                    const grantDate = new Date(h.date);
                    return grantDate < oneYearAfterJoinForExpiry;
                });
                
                if (expiredLeaves.length > 0) {
                    // Add expiry entry on the expiry date
                    const year = oneYearAfterJoinForExpiry.getFullYear();
                    const month = String(oneYearAfterJoinForExpiry.getMonth() + 1).padStart(2, "0");
                    const day = String(oneYearAfterJoinForExpiry.getDate()).padStart(2, "0");
                    history.push({
                        date: `${year}-${month}-${day}`,
                        expired: -expiredLeaves.length,
                    });
                }
            }
        }
    } else {
        // 입사 1년 이상인 경우: 1월 1일에 기본 연차 지급
        let baseDays = 15;
        
        const fullYears = Math.floor(yearsOfServiceAtYearStart);
        if (fullYears >= 2) {
            const additionalYears = fullYears - 1;
            const additionalDays = Math.floor(additionalYears / 2);
            baseDays += additionalDays;
        }
        
        // 입사일이 해당 연도 중간에 있는 경우 (해당 연도에 1년을 채운 경우)
        if (join > yearStart && join <= yearEnd) {
            const workDaysInPreviousYear = getDaysBetween(join, previousYearEnd);
            const proratedDays = Math.ceil((workDaysInPreviousYear / 365) * 15);
            baseDays = Math.max(baseDays, proratedDays);
        }
        
        // 타임존 문제 방지를 위해 로컬 날짜로 직접 구성
        const year = yearStart.getFullYear();
        const month = String(yearStart.getMonth() + 1).padStart(2, '0');
        const day = String(yearStart.getDate()).padStart(2, '0');
        history.push({
            date: `${year}-${month}-${day}`,
            granted: baseDays,
        });
        
        // 입사일 기준 추가 연차 지급 (3년째부터 2년마다 1개씩)
        // 입사일로부터 3년, 5년, 7년... 되는 날에 추가 지급
        const joinDay = join.getDate();
        const joinMonth = join.getMonth();
        const joinYear = join.getFullYear();
        
        // 입사일 기준 추가 연차 카운트 (해당 연도에 지급받은 총 개수)
        let anniversaryGrantedDays = 0;
        
        // 3년째부터 시작 (입사일 + 3년)
        let yearsAfterJoin = 3;
        while (true) {
            const anniversaryDate = new Date(joinYear + yearsAfterJoin, joinMonth, joinDay);
            anniversaryDate.setHours(0, 0, 0, 0);
            
            // 해당 연도 내에 있고, 현재 날짜 이전인 경우만 추가
            if (anniversaryDate >= yearStart && anniversaryDate <= yearEnd && anniversaryDate <= currentDate) {
                const annYear = anniversaryDate.getFullYear();
                const annMonth = String(anniversaryDate.getMonth() + 1).padStart(2, '0');
                const annDay = String(anniversaryDate.getDate()).padStart(2, '0');
                history.push({
                    date: `${annYear}-${annMonth}-${annDay}`,
                    granted: 1, // 입사일 기준 추가 연차 1개
                });
                anniversaryGrantedDays += 1; // 해당 연도에 지급받은 입사일 기준 추가 연차 카운트
            }
            
            // 해당 연도를 벗어나면 종료
            if (anniversaryDate > yearEnd) {
                break;
            }
            
            // 다음 2년 후로 이동 (3년 → 5년 → 7년...)
            yearsAfterJoin += 2;
            
            // 무한 루프 방지 (현재 연도 + 10년 이상이면 종료)
            if (anniversaryDate.getFullYear() > targetYear + 10) {
                break;
            }
        }
        
        // 회계연도 기준 연차는 12월 31일에 소멸
        // 기본 연차(baseDays)와 입사일 기준 추가 연차(anniversaryGrantedDays) 모두 소멸
        // 해당 연도의 12월 31일이 현재 날짜 이전이거나 같은 경우 소멸 내역 추가
        const yearEndDate = new Date(targetYear, 11, 31);
        yearEndDate.setHours(0, 0, 0, 0);
        if (yearEndDate <= currentDate) {
            const totalDaysToExpire = baseDays + anniversaryGrantedDays; // 기본 연차 + 입사일 기준 추가 연차
            const expiryYear = targetYear;
            const expiryMonth = '12';
            const expiryDay = '31';
            history.push({
                date: `${expiryYear}-${expiryMonth}-${expiryDay}`,
                expired: -totalDaysToExpire, // 해당 연도에 지급받은 모든 연차 소멸
            });
        }
    }
    
    // 해당 연도 내에 있는 내역만 필터링
    const filteredHistory = history.filter(h => {
        const dateStr = h.date;
        const dateYear = parseInt(dateStr.split('-')[0]);
        // 해당 연도 내에 있는 경우만 (12월 31일 포함)
        return dateYear === targetYear;
    });
    
    // 날짜순으로 정렬
    return filteredHistory.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 모든 직원의 연차를 계산하고 vacation_balances 테이블에 업데이트
 * @param userIds 직원 ID 목록 (선택사항, 없으면 모든 직원)
 * @param targetYear 계산할 연도
 */
export async function updateVacationBalances(
    userIds?: string[],
    targetYear: number = new Date().getFullYear()
): Promise<void> {
    const { supabase } = await import("./supabase");
    
    // profiles 테이블에서 입사일 가져오기
    let query = supabase
        .from("profiles")
        .select("id, join_date");
    
    if (userIds && userIds.length > 0) {
        query = query.in("id", userIds);
    }
    
    const { data: profiles, error } = await query;
    
    if (error) {
        console.error("프로필 조회 실패:", error);
        throw new Error(`프로필 조회 실패: ${error.message}`);
    }
    
    if (!profiles || profiles.length === 0) {
        console.warn("프로필이 없습니다.");
        return;
    }
    
    // 각 직원의 연차 계산 및 업데이트
    const currentDate = new Date();
    const updates = profiles
        .filter(profile => profile.join_date) // 입사일이 있는 경우만
        .map(profile => {
            const totalDays = calculateAnnualLeave(
                profile.join_date,
                targetYear,
                currentDate
            );
            
            return {
                user_id: profile.id,
                year: targetYear,
                total_days: totalDays,
                remaining_days: totalDays, // 초기값은 total_days와 동일
            };
        });
    
    // vacation_balances 테이블에 upsert
    for (const update of updates) {
        const { error: upsertError } = await supabase
            .from("vacation_balances")
            .upsert(
                {
                    ...update,
                    used_days: 0, // 사용 일수는 별도로 계산 필요
                },
                {
                    onConflict: "user_id,year",
                }
            );
        
        if (upsertError) {
            console.error(`직원 ${update.user_id} 연차 업데이트 실패:`, upsertError);
        }
    }
    
    // 사용 일수 업데이트 (vacations 테이블에서 계산)
    for (const update of updates) {
        const { data: vacations } = await supabase
            .from("vacations")
            .select("leave_type")
            .eq("user_id", update.user_id)
            .eq("status", "approved")
            .gte("date", `${targetYear}-01-01`)
            .lte("date", `${targetYear}-12-31`);
        
        if (vacations) {
            const usedDays = vacations.reduce((sum, v) => {
                return sum + (v.leave_type === "FULL" ? 1 : 0.5);
            }, 0);
            
            const { error: updateError } = await supabase
                .from("vacation_balances")
                .update({
                    used_days: usedDays,
                    remaining_days: update.total_days - usedDays,
                })
                .eq("user_id", update.user_id)
                .eq("year", targetYear);
            
            if (updateError) {
                console.error(`직원 ${update.user_id} 사용 일수 업데이트 실패:`, updateError);
            }
        }
    }
}

