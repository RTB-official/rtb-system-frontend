import jsPDF from "jspdf";
import { sanitizeReportPdfFilenameBase } from "../utils/reportPdfFilename";

/** html2canvas 결과를 A4 여러 페이지로 나눠 저장 (ReportPdfPage 인쇄 레이아웃과 유사한 폭 맞춤) */
export function saveCanvasAsMultiPagePdf(
    canvas: HTMLCanvasElement,
    filenameBase: string
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

    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
        const currentSliceHeight = Math.min(
            sliceHeightPx,
            canvas.height - sourceY
        );
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSliceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) {
            throw new Error("PDF 페이지 캔버스를 생성하지 못했습니다.");
        }
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
