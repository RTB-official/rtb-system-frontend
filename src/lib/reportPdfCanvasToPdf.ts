import jsPDF from "jspdf";
import { sanitizeReportPdfFilenameBase } from "../utils/reportPdfFilename";

/** html2canvas 결과를 A4 여러 페이지로 나눠 저장 (ReportPdfPage 인쇄 레이아웃과 유사한 폭 맞춤) */
export function saveCanvasAsMultiPagePdf(
    canvas: HTMLCanvasElement,
    filenameBase: string
): void {
    const safe = sanitizeReportPdfFilenameBase(filenameBase);
    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    pdf.save(`${safe}.pdf`);
}
