/** ISO 날짜(YYYY-MM-DD) → YYMMDD */
export function toYYMMDD(iso?: string | null): string {
    if (!iso) return "";
    const s = iso.slice(0, 10).replace(/-/g, "");
    return s.length === 8 ? s.slice(2) : s;
}

/** 다양한 날짜 입력 → ISO YYYY-MM-DD (DatePicker/폼용) */
export function normalizeDateToISO(v: string): string | null {
    const trimmed = (v || "").trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const dot = trimmed.match(/^(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?$/);
    if (dot) {
        const [, y, m, d] = dot;
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (/^\d{6}$/.test(trimmed)) {
        return `20${trimmed.slice(0, 2)}-${trimmed.slice(2, 4)}-${trimmed.slice(4, 6)}`;
    }
    if (/^\d{8}$/.test(trimmed)) {
        return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    }
    return null;
}

/** 여권 만료일 포맷 (YYMMDD → "25년 12월 만료") 및 1년 이내 여부 */
export function formatPassportExpiry(
    passportExpiry: string,
    passportExpiryISO?: string,
): { formatted: string; isWithinYear: boolean } {
    let formatted = "";
    let isWithinYear = false;
    if (passportExpiry?.length === 6) {
        const yy = passportExpiry.slice(0, 2);
        const mm = parseInt(passportExpiry.slice(2, 4), 10);
        formatted = `${yy}년 ${mm}월 만료`;
        if (passportExpiryISO) {
            const expiryDate = new Date(passportExpiryISO);
            expiryDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const oneYearLater = new Date(today);
            oneYearLater.setFullYear(today.getFullYear() + 1);
            isWithinYear = expiryDate >= today && expiryDate <= oneYearLater;
        }
    }
    return { formatted, isWithinYear };
}
