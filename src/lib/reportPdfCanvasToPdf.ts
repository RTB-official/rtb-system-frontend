import jsPDF from "jspdf";
import { sanitizeReportPdfFilenameBase } from "../utils/reportPdfFilename";

/** 페이지 경계가 이 구간 안쪽으로 들어오면 안 되는 블록 (캡처 원본 CSS px 기준) */
export type PdfBreakAvoidBlock = { top: number; bottom: number };

/**
 * `page-break-inside: avoid` 가 걸린 요소들을 훑어서 "쪼개면 안 되는 구간" 목록을 만든다.
 * 인쇄 CSS 규칙을 그대로 재사용하므로 window.print() 결과와 페이지 분할 지점이 거의 같아진다.
 */
export function collectBreakAvoidBlocks(root: HTMLElement): PdfBreakAvoidBlock[] {
    const rootTop = root.getBoundingClientRect().top;
    const blocks: PdfBreakAvoidBlock[] = [];

    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const style = window.getComputedStyle(el);
        const avoid =
            style.breakInside === "avoid" ||
            style.pageBreakInside === "avoid";
        if (!avoid) return;

        const rect = el.getBoundingClientRect();
        if (rect.height <= 1) return;

        blocks.push({
            top: rect.top - rootTop,
            bottom: rect.bottom - rootTop,
        });
    });

    return blocks;
}

/**
 * desiredEnd 가 어떤 블록 한가운데를 지나가면, 그 블록이 시작되기 전으로 페이지 경계를 당긴다.
 * 한 페이지에 애초에 담기지 않는 블록은 당겨봐야 소용없으므로 무시한다.
 */
function findSafeBreak(
    start: number,
    desiredEnd: number,
    blocks: PdfBreakAvoidBlock[],
    pageHeight: number
): number {
    let end = desiredEnd;

    for (let guard = 0; guard < 50; guard += 1) {
        let earliest = Number.POSITIVE_INFINITY;

        for (const block of blocks) {
            if (block.bottom - block.top >= pageHeight) continue;
            if (block.top <= start) continue;
            if (block.top < end && block.bottom > end && block.top < earliest) {
                earliest = block.top;
            }
        }

        if (!Number.isFinite(earliest)) break;
        end = earliest;
    }

    // 페이지가 지나치게 짧아지면(= 거대한 블록이 페이지 앞머리에 걸림) 원래 지점에서 자른다.
    if (end - start < pageHeight * 0.1) return desiredEnd;
    return end;
}

export type SaveCanvasAsMultiPagePdfOptions = {
    /** collectBreakAvoidBlocks 결과 */
    breakAvoidBlocks?: PdfBreakAvoidBlock[];
    /** breakAvoidBlocks 를 캡처한 원본 요소의 CSS px 높이 (canvas 픽셀로 환산하는 데 사용) */
    sourceHeight?: number;
};

/** html2canvas 결과를 A4 여러 페이지로 나눠 저장 (ReportPdfPage 인쇄 레이아웃과 유사한 폭 맞춤) */
export function saveCanvasAsMultiPagePdf(
    canvas: HTMLCanvasElement,
    filenameBase: string,
    options: SaveCanvasAsMultiPagePdfOptions = {}
): void {
    const safe = sanitizeReportPdfFilenameBase(filenameBase);
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const horizontalMargin = (10 / 25.4) * 72;
    const verticalMargin = (12 / 25.4) * 72;
    const imgWidth = pageWidth - horizontalMargin * 2;
    const printablePageHeight = pageHeight - verticalMargin * 2;
    const sliceHeightPx = Math.max(
        1,
        Math.floor((printablePageHeight * canvas.width) / imgWidth)
    );

    const scale =
        options.sourceHeight && options.sourceHeight > 0
            ? canvas.height / options.sourceHeight
            : 1;
    const blocks = (options.breakAvoidBlocks ?? []).map((block) => ({
        top: block.top * scale,
        bottom: block.bottom * scale,
    }));

    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
        let sliceEnd = Math.min(sourceY + sliceHeightPx, canvas.height);
        if (blocks.length > 0 && sliceEnd < canvas.height) {
            sliceEnd = findSafeBreak(sourceY, sliceEnd, blocks, sliceHeightPx);
        }

        const currentSliceHeight = Math.max(1, Math.round(sliceEnd - sourceY));
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSliceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) {
            throw new Error("PDF 페이지 캔버스를 생성하지 못했습니다.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            currentSliceHeight,
            0,
            0,
            canvas.width,
            currentSliceHeight
        );

        if (pageIndex > 0) {
            pdf.addPage();
        }
        const sliceImageHeight =
            (currentSliceHeight * imgWidth) / canvas.width;
        pdf.addImage(
            pageCanvas.toDataURL("image/png", 1.0),
            "PNG",
            horizontalMargin,
            verticalMargin,
            imgWidth,
            sliceImageHeight
        );
        sourceY += currentSliceHeight;
        pageIndex += 1;
    }

    pdf.save(`${safe}.pdf`);
}
