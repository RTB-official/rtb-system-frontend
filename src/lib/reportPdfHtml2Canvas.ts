/**
 * html2canvas 1.x는 Tailwind v4 등의 `oklch()` 색상을 파싱하지 못해 예외가 난다.
 * 클론 iframe 문서에서 문제가 되는 스타일시트를 제거한 뒤,
 * 원본 요소의 계산된 스타일을 클론에 인라인으로 옮긴다.
 */

function resolveOklchLikeValue(property: string, value: string): string {
    if (!value.includes("oklch(") && !value.includes("lch(")) return value;
    const probe = document.createElement("span");
    probe.style.setProperty(property, value);
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).getPropertyValue(property);
    document.body.removeChild(probe);
    return resolved?.trim() ? resolved.trim() : value;
}

function copyComputedStylesToClone(source: Element, target: Element) {
    const cs = window.getComputedStyle(source);
    const targetStyle = (target as HTMLElement | SVGElement).style;
    if (!targetStyle) return;

    for (let i = 0; i < cs.length; i++) {
        const prop = cs.item(i);
        if (!prop) continue;
        try {
            let val = cs.getPropertyValue(prop);
            if (val.includes("oklch(") || val.includes("lch(")) {
                val = resolveOklchLikeValue(prop, val);
            }
            const pri = cs.getPropertyPriority(prop);
            targetStyle.setProperty(prop, val, pri);
        } catch {
            /* 일부 읽기 전용/무효 조합 무시 */
        }
    }
}

/** 클론 문서에서 Tailwind/Vite 등 oklch 기반 시트 제거 */
export function stripOklchStylesheetsFromClone(clonedDoc: Document) {
    clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
        el.parentNode?.removeChild(el);
    });
    clonedDoc.querySelectorAll("style").forEach((el) => {
        const text = (el.textContent ?? "").toLowerCase();
        if (
            text.includes("oklch(") ||
            text.includes("lch(") ||
            text.includes("color-mix(")
        ) {
            el.parentNode?.removeChild(el);
        }
    });
}

/**
 * html2canvas는 onclone 이후에도 parseBackgroundColor에서
 * getComputedStyle(clonedDoc.documentElement|body).backgroundColor 를 항상 parseColor로 넘긴다.
 * Tailwind v4 등으로 여기가 oklch면 예외가 나므로, 클론 루트에 안전한 배경을 강제한다.
 */
export function sanitizeCloneDocumentRootForHtml2Canvas(clonedDoc: Document) {
    const html = clonedDoc.documentElement;
    const body = clonedDoc.body;
    if (html) {
        html.style.setProperty("background-color", "#ffffff", "important");
        html.style.setProperty("color", "#1b1d22", "important");
    }
    if (body) {
        body.style.setProperty("background-color", "#ffffff", "important");
        body.style.setProperty("color", "#1b1d22", "important");
    }
}

/** 원본 서브트리와 클론 서브트리를 같은 순서로 순회하며 계산 스타일 인라인 복사 */
export function inlineComputedStylesFromOriginalSubtree(
    originalRoot: HTMLElement,
    clonedRoot: HTMLElement
) {
    const origList: Element[] = [originalRoot];
    originalRoot.querySelectorAll("*").forEach((n) => origList.push(n));

    const cloneList: Element[] = [clonedRoot];
    clonedRoot.querySelectorAll("*").forEach((n) => cloneList.push(n));

    const n = Math.min(origList.length, cloneList.length);
    for (let i = 0; i < n; i++) {
        copyComputedStylesToClone(origList[i], cloneList[i]);
    }
}

export function prepareReportPdfHtml2CanvasClone(
    clonedDoc: Document,
    clonedSheet: HTMLElement,
    originalSheet: HTMLElement
) {
    stripOklchStylesheetsFromClone(clonedDoc);
    sanitizeCloneDocumentRootForHtml2Canvas(clonedDoc);
    inlineComputedStylesFromOriginalSubtree(originalSheet, clonedSheet);
}
