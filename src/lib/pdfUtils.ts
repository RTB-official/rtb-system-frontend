import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import React from "react";
import { createRoot } from "react-dom/client";
import TbmDetailSheet from "../components/tbm/TbmDetailSheet";
import {
    type EmployeeMileageDetail,
    type EmployeeCardExpenseDetail,
} from "./personalExpenseApi";
import { getPersonalExpenseReceiptUrl } from "./personalExpenseApi";

// 요일 변환 함수
const getDayOfWeek = (date: Date): string => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return days[date.getDay()];
};

// 날짜 파싱 (YYYY-MM-DD 형식)
const parseDate = (dateStr: string): { year: number; month: number; day: number; dayOfWeek: string } => {
    if (!dateStr) {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            dayOfWeek: getDayOfWeek(now),
        };
    }
    // YYYY-MM-DD 형식으로 파싱
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            dayOfWeek: getDayOfWeek(now),
        };
    }
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        dayOfWeek: getDayOfWeek(date),
    };
};

// 영수증 URL 가져오기
const getReceiptUrl = (receiptPath: string | null): string | null => {
    if (!receiptPath) return null;
    try {
        return getPersonalExpenseReceiptUrl(receiptPath);
    } catch (error) {
        console.error("영수증 URL 생성 실패:", error);
        return null;
    }
};

// ArrayBuffer를 Base64로 변환 (청크 단위로 처리하여 스택 오버플로우 방지)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192; // 청크 크기
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

// 프리텐다드 폰트 추가 (CDN TTF 파일 사용 - Regular + Bold)
export async function addPretendardFont(doc: jsPDF): Promise<{ success: boolean; hasBold: boolean }> {
    try {
        let regularAdded = false;
        let boldAdded = false;
        
        // Regular 폰트 추가
        try {
            const regularUrl = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.ttf";
            console.log("프리텐다드 Regular 폰트 로드 시작...", regularUrl);
            const regularResponse = await fetch(regularUrl);
            
            if (regularResponse.ok) {
                const regularArrayBuffer = await regularResponse.arrayBuffer();
                const regularBase64 = arrayBufferToBase64(regularArrayBuffer);
                
                (doc as any).addFileToVFS("Pretendard-Regular.ttf", regularBase64);
                
                try {
                    (doc as any).addFont("Pretendard-Regular.ttf", "Pretendard", "normal");
                    regularAdded = true;
                    console.log("프리텐다드 Regular 폰트 추가 성공");
                } catch (fontError: any) {
                    console.warn("프리텐다드 Regular 폰트 등록 실패:", fontError?.message || fontError);
                }
            }
        } catch (error) {
            console.warn("프리텐다드 Regular 폰트 로드 실패:", error);
        }
        
        // Bold 폰트 추가
        try {
            const boldUrl = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.ttf";
            console.log("프리텐다드 Bold 폰트 로드 시작...", boldUrl);
            const boldResponse = await fetch(boldUrl);
            
            if (boldResponse.ok) {
                const boldArrayBuffer = await boldResponse.arrayBuffer();
                const boldBase64 = arrayBufferToBase64(boldArrayBuffer);
                
                (doc as any).addFileToVFS("Pretendard-Bold.ttf", boldBase64);
                
                try {
                    (doc as any).addFont("Pretendard-Bold.ttf", "Pretendard", "bold");
                    boldAdded = true;
                    console.log("프리텐다드 Bold 폰트 추가 성공");
                } catch (fontError: any) {
                    const errorMsg = fontError?.message || String(fontError);
                    if (!errorMsg.includes("unicode cmap") && !errorMsg.includes("No unicode cmap")) {
                        console.warn("프리텐다드 Bold 폰트 등록 실패:", errorMsg);
                    }
                }
            }
        } catch (error) {
            console.warn("프리텐다드 Bold 폰트 로드 실패:", error);
        }
        
        if (regularAdded || boldAdded) {
            try {
                const fontList = doc.getFontList();
                if (!("Pretendard" in fontList)) {
                    console.warn("Pretendard 폰트가 등록 목록에 없음");
                    return { success: false, hasBold: false };
                }
                
                try {
                    doc.setFont("Pretendard", regularAdded ? "normal" : "bold");
                    return { success: true, hasBold: boldAdded };
                } catch (setFontError: any) {
                    console.warn("폰트 설정 실패, 기본 폰트 사용:", setFontError?.message || setFontError);
                    return { success: false, hasBold: false };
                }
            } catch (error) {
                console.warn("폰트 목록 확인 실패:", error);
                return { success: false, hasBold: false };
            }
        }
        
        return { success: false, hasBold: false };
    } catch (error) {
        console.error("프리텐다드 폰트 추가 실패:", error);
        return { success: false, hasBold: false };
    }
}

export interface GeneratePDFParams {
    employeeName: string;
    year: string; // "2025년"
    month: string; // "12월"
    mileageDetails: EmployeeMileageDetail[];
    cardDetails: EmployeeCardExpenseDetail[];
    onError?: (message: string) => void;
}

export async function generateExpenseReportPDF({
    onError,
    employeeName,
    year,
    month,
    mileageDetails,
    cardDetails,
}: GeneratePDFParams): Promise<void> {
    try {
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });
        
        // 프리텐다드 폰트 추가 시도
        let fontAdded = false;
        try {
            const fontResult = await addPretendardFont(doc);
            fontAdded = fontResult.success;
        } catch (error) {
            console.warn("폰트 추가 중 오류 발생, 기본 폰트 사용:", error);
        }
        
        const fontName = fontAdded ? "Pretendard" : "helvetica";
        const fontStyle = fontAdded ? "normal" : "bold"; 
        
        console.log("사용할 폰트:", fontName, fontAdded ? "(프리텐다드)" : "(기본 폰트)");
        
        // 기본 폰트로 설정 (안전하게 시작)
        try {
            doc.setFont(fontName, fontStyle);
        } catch (e) {
            console.warn("폰트 설정 실패, helvetica로 전환:", e);
            doc.setFont("helvetica", "bold");
        }
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = margin;

        // 제목
        const title = `${employeeName} - ${year} ${month} 개인차량 및 지출 청구서`;
        doc.setFontSize(16);
        doc.setFont(fontName, fontStyle);
        doc.text(title, pageWidth / 2, yPos, { align: "center" });
        yPos += 20;

        // 1. 개인차량 마일리지 섹션
        doc.setFontSize(14);
        doc.setFont(fontName, fontStyle);
        doc.text("1. 개인차량 마일리지", margin, yPos);
        yPos += 10;

        // 마일리지 테이블 데이터 준비 (dateRaw 사용)
        const mileageTableData = mileageDetails.map((item) => {
            const dateInfo = parseDate(item.dateRaw || item.date || "");
            const routeParts = (item.route || "").split(" → ");
            const fromPlace = routeParts[0]?.trim() || "";
            const toPlace = routeParts[1]?.trim() || "";
            return [
                dateInfo.year.toString(),
                dateInfo.month.toString(),
                dateInfo.day.toString(),
                dateInfo.dayOfWeek,
                fromPlace,
                toPlace,
                `${item.distance || 0} km`,
                `${(item.amount || 0).toLocaleString("ko-KR")} 원`,
                item.details || "",
            ];
        });

        if (mileageTableData.length > 0) {
            try {
                // 폰트가 등록되었고 실제로 사용 가능한지 확인
                let tableFont = "helvetica"; // 기본값
                if (fontAdded) {
                    try {
                        const fontList = doc.getFontList();
                        if (fontName in fontList) {
                            // 폰트 사용 테스트
                            doc.setFont(fontName, "normal");
                            tableFont = fontName;
                        }
                    } catch (e) {
                        console.warn("폰트 확인 실패, 기본 폰트 사용:", e);
                        tableFont = "helvetica";
                    }
                }
                
                // 페이지 사용 가능 너비 계산 (A4: 210mm, margin 20mm씩 = 170mm 사용 가능)
                const availableWidth = pageWidth - (margin * 2);
                
                autoTable(doc, {
                    startY: yPos,
                    head: [["년", "월", "일", "요일", "장소 From", "장소 To", "거리 (km)", "마일리지 (KRW)", "비고"]],
                    body: mileageTableData,
                    styles: { 
                        fontSize: 9,
                        font: tableFont, // 폰트 사용 가능 여부에 따라 선택
                        fontStyle: "normal",
                        textColor: [0, 0, 0],
                        cellPadding: 3,
                        lineColor: [0, 0, 0], // 모든 셀 테두리 색상
                        lineWidth: 0.5, // 모든 셀 테두리 두께
                    },
                    headStyles: { 
                        fillColor: [255, 255, 200], // 노란색 헤더
                        textColor: [0, 0, 0], 
                        fontStyle: tableFont === "helvetica" ? "bold" : "normal", // helvetica는 bold, 나눔고딕은 normal
                        fontSize: 9,
                        cellPadding: 3,
                        font: tableFont, // 헤더에도 폰트 명시
                        lineColor: [0, 0, 0], // 헤더 셀 테두리 색상
                        lineWidth: 0.5, // 헤더 셀 테두리 두께
                    },
                    bodyStyles: {
                        font: tableFont, // 바디에도 폰트 명시
                        fontStyle: "normal",
                        lineColor: [0, 0, 0], // 바디 셀 테두리 색상
                        lineWidth: 0.5, // 바디 셀 테두리 두께
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250], // 짝수 행 배경색
                        lineColor: [0, 0, 0], // 짝수 행 테두리 색상
                        lineWidth: 0.5, // 짝수 행 테두리 두께
                    },
                    columnStyles: {
                        0: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 년
                        1: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 월
                        2: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 일
                        3: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 요일
                        4: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 장소 From
                        5: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 장소 To
                        6: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 거리
                        7: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 마일리지
                        8: { cellWidth: availableWidth * 0.11, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 비고
                    },
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    tableLineColor: [0, 0, 0], // 검은색 테두리로 선명하게
                    tableLineWidth: 0.5, // 테두리 두께 증가
                });

                yPos = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPos + 50;
            } catch (tableError: any) {
                console.error("테이블 생성 오류:", tableError);
                // 테이블 생성 실패 시 기본 텍스트로 표시
                doc.setFontSize(9);
                doc.setFont(fontName, "normal");
                mileageTableData.forEach((row) => {
                    doc.text(row.join(" | "), margin, yPos);
                    yPos += 5;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(11);
            doc.setFont(fontName, "normal");
            doc.text("마일리지 내역이 없습니다.", margin, yPos);
            yPos += 15;
        }

        // 마일리지 합계 (한 줄에 표시)
        const totalDistance = mileageDetails.reduce((sum, item) => sum + (item.distance || 0), 0);
        const totalMileage = mileageDetails.reduce((sum, item) => sum + (item.amount || 0), 0);

        doc.setFontSize(11);
        doc.setFont(fontName, "normal");
        const summaryText = `총 거리: ${totalDistance.toLocaleString("ko-KR")} km | 총 마일리지: ${totalMileage.toLocaleString("ko-KR")} 원`;
        doc.text(summaryText, margin, yPos);
        yPos += 15;

        // 2. 개인카드/현금 지출 섹션
        doc.setFontSize(14);
        // 폰트 설정 시도 (실패 시 기본 폰트)
        try {
            doc.setFont(fontName, fontStyle);
        } catch (e) {
            doc.setFont("helvetica", "bold");
        }
        doc.text("2. 개인카드/현금 지출", margin, yPos);
        yPos += 10;

        // 카드 지출 테이블 데이터 준비 (dateRaw 사용)
        const cardTableData = cardDetails.map((item) => {
            const dateInfo = parseDate(item.dateRaw || item.date || "");
            return [
                dateInfo.year.toString(),
                dateInfo.month.toString(),
                dateInfo.day.toString(),
                dateInfo.dayOfWeek,
                item.category || "기타",
                `${(item.amount || 0).toLocaleString("ko-KR")} 원`,
                item.details || "",
            ];
        });

        if (cardTableData.length > 0) {
            try {
                // 폰트가 등록되었고 실제로 사용 가능한지 확인
                let tableFont = "helvetica"; // 기본값
                if (fontAdded) {
                    try {
                        const fontList = doc.getFontList();
                        if (fontName in fontList) {
                            // 폰트 사용 테스트
                            doc.setFont(fontName, "normal");
                            tableFont = fontName;
                        }
                    } catch (e) {
                        console.warn("폰트 확인 실패, 기본 폰트 사용:", e);
                        tableFont = "helvetica";
                    }
                }
                
                // 페이지 사용 가능 너비 계산 (A4: 210mm, margin 20mm씩 = 170mm 사용 가능)
                const availableWidth = pageWidth - (margin * 2);
                
                autoTable(doc, {
                    startY: yPos,
                    head: [["년", "월", "일", "요일", "구분", "금액 (KRW)", "비고"]],
                    body: cardTableData,
                    styles: { 
                        fontSize: 9,
                        font: tableFont, // 폰트 사용 가능 여부에 따라 선택
                        fontStyle: "normal",
                        textColor: [0, 0, 0],
                        cellPadding: 3,
                        lineColor: [0, 0, 0], // 모든 셀 테두리 색상
                        lineWidth: 0.5, // 모든 셀 테두리 두께
                    },
                    headStyles: { 
                        fillColor: [255, 255, 200], // 노란색 헤더
                        textColor: [0, 0, 0], 
                        fontStyle: tableFont === "helvetica" ? "bold" : "normal", // helvetica는 bold, 나눔고딕은 normal
                        fontSize: 9,
                        cellPadding: 3,
                        font: tableFont, // 헤더에도 폰트 명시
                        lineColor: [0, 0, 0], // 헤더 셀 테두리 색상
                        lineWidth: 0.5, // 헤더 셀 테두리 두께
                    },
                    bodyStyles: {
                        font: tableFont, // 바디에도 폰트 명시
                        fontStyle: "normal",
                        lineColor: [0, 0, 0], // 바디 셀 테두리 색상
                        lineWidth: 0.5, // 바디 셀 테두리 두께
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250], // 짝수 행 배경색
                        lineColor: [0, 0, 0], // 짝수 행 테두리 색상
                        lineWidth: 0.5, // 짝수 행 테두리 두께
                    },
                    columnStyles: {
                        0: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 년
                        1: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 월
                        2: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 일
                        3: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 요일
                        4: { cellWidth: availableWidth * 0.18, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 구분
                        5: { cellWidth: availableWidth * 0.18, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 금액
                        6: { cellWidth: availableWidth * 0.16, lineColor: [0, 0, 0], lineWidth: 0.5 }, // 비고
                    },
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    tableLineColor: [0, 0, 0], // 검은색 테두리로 선명하게
                    tableLineWidth: 0.5, // 테두리 두께 증가
                });

                yPos = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPos + 50;
            } catch (tableError: any) {
                console.error("테이블 생성 오류:", tableError);
                // 테이블 생성 실패 시 기본 텍스트로 표시
                doc.setFontSize(9);
                doc.setFont(fontName, "normal");
                cardTableData.forEach((row) => {
                    doc.text(row.join(" | "), margin, yPos);
                    yPos += 5;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(11);
            doc.setFont(fontName, "normal");
            doc.text("카드 지출 내역이 없습니다.", margin, yPos);
            yPos += 15;
        }

        // 카드 지출 합계
        const totalExpense = cardDetails.reduce((sum, item) => sum + (item.amount || 0), 0);

        doc.setFontSize(11);
        doc.setFont(fontName, "normal");
        doc.text(`총 지출: ${totalExpense.toLocaleString("ko-KR")}원`, margin, yPos);
        yPos += 15;

        // 총 청구 금액 (크게만 표시, Bold 없음)
        const totalClaim = totalMileage + totalExpense;
        doc.setFontSize(18); // 폰트 크기 증가 (16 -> 18)
        // 폰트 설정: Normal 스타일만 사용 (Bold 제거)
        try {
            if (fontAdded) {
                doc.setFont("Pretendard", "normal");
            } else {
                doc.setFont("helvetica", "normal");
            }
        } catch (e) {
            if (fontAdded) {
                doc.setFont("Pretendard", "normal");
            } else {
                doc.setFont("helvetica", "normal");
            }
        }
        doc.text(`총 청구 금액: ${totalClaim.toLocaleString("ko-KR")} 원`, margin, yPos);
        yPos += 25; // 여백도 조금 증가

        // 3. 영수증 섹션
        const receipts = cardDetails.filter((item) => item.receipt_path);
        if (receipts.length > 0) {
            doc.setFontSize(14);
            doc.setFont(fontName, fontStyle);
            doc.text("3. 영수증", margin, yPos);
            yPos += 10;

            // 영수증을 날짜순으로 정렬 (dateRaw 사용)
            const sortedReceipts = [...receipts].sort((a, b) => {
                const dateA = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
                const dateB = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
                return dateA - dateB;
            });

            for (const item of sortedReceipts) {
                const dateInfo = parseDate(item.dateRaw || item.date || "");
                const dateStr = `${dateInfo.year}.${String(dateInfo.month).padStart(2, "0")}.${String(dateInfo.day).padStart(2, "0")}`;
                
                // 텍스트 표시
                doc.setFontSize(10);
                doc.setFont(fontName, "normal");
                const receiptText = `${dateStr} - ${item.category || "기타"} (${(item.amount || 0).toLocaleString("ko-KR")}원)`;
                doc.text(receiptText, margin, yPos);
                
                // 영수증 이미지 추가
                const receiptUrl = item.receipt_path ? getReceiptUrl(item.receipt_path) : null;
                if (receiptUrl) {
                    try {
                        // 이미지 로드 및 추가
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        
                        await new Promise<void>((resolve) => {
                            const timeout = setTimeout(() => {
                                console.warn("이미지 로드 타임아웃:", receiptUrl);
                                yPos += 20;
                                resolve();
                            }, 5000);
                            
                            img.onload = () => {
                                clearTimeout(timeout);
                                try {
                                    // 이미지 크기 조정 (최대 너비 60mm)
                                    const maxWidth = 60;
                                    const maxHeight = 60;
                                    let imgWidth = img.width;
                                    let imgHeight = img.height;
                                    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                                    imgWidth = imgWidth * ratio;
                                    imgHeight = imgHeight * ratio;

                                    // 페이지 여백 확인
                                    const pageHeight = doc.internal.pageSize.getHeight();
                                    if (yPos + imgHeight + 10 > pageHeight - margin) {
                                        doc.addPage();
                                        yPos = margin;
                                    }

                                    // 이미지 추가
                                    doc.addImage(
                                        img,
                                        "JPEG",
                                        margin,
                                        yPos + 5,
                                        imgWidth,
                                        imgHeight
                                    );
                                    yPos += imgHeight + 15;
                                    resolve();
                                } catch (err) {
                                    console.error("이미지 추가 실패:", err);
                                    yPos += 20;
                                    resolve();
                                }
                            };
                            img.onerror = () => {
                                clearTimeout(timeout);
                                console.error("이미지 로드 실패:", receiptUrl);
                                yPos += 20;
                                resolve();
                            };
                            img.src = receiptUrl;
                        });
                    } catch (error) {
                        console.error("영수증 이미지 처리 실패:", error);
                        yPos += 20;
                    }
                } else {
                    yPos += 20;
                }
            }
        }

        // PDF 다운로드
        const fileName = `${employeeName}_${year.replace("년", "")}_${month.replace("월", "")}_청구서.pdf`;
        doc.save(fileName);
    } catch (error) {
        console.error("PDF 생성 오류:", error);
        const errorMessage = `PDF 생성 실패: ${error instanceof Error ? error.message : String(error)}`;
        if (onError) {
            onError(errorMessage);
        }
        // onError가 없으면 에러만 로깅 (alert 제거)
    }
}

type TbmPdfParams = {
    tbmId: string;
    onError?: (message: string) => void;
};

const formatDateForFilename = (value?: string | null) =>
    value ? String(value).replace(/-/g, "") : "TBM";

export async function generateTbmPdf({
    tbmId,
    onError,
}: TbmPdfParams): Promise<void> {
    let container: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;

    try {
        const { tbm, participants } = await import("./tbmApi").then((mod) =>
            mod.getTbmDetail(tbmId)
        );

        if (!tbm) throw new Error("TBM 정보를 불러오지 못했습니다.");

        container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-10000px";
        container.style.top = "0";
        container.style.width = "794px";
        container.style.padding = "0";
        container.style.background = "#ffffff";
        container.style.zIndex = "-1";
        document.body.appendChild(container);

        root = createRoot(container);
        root.render(
            React.createElement(
                "div",
                {
                    style: {
                        width: "794px",
                        padding: "24px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                        fontFamily: '"Pretendard JP", sans-serif'
                    },
                },
                React.createElement(TbmDetailSheet, {
                    tbm,
                    participants: participants || [],
                    variant: "pdf",
                })
            )
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
        if ("fonts" in document) {
            await (document as any).fonts.ready;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));

        const sheet = container.querySelector("[data-tbm-sheet]") as HTMLElement | null;
        if (!sheet) {
            throw new Error("TBM PDF 렌더링에 실패했습니다.");
        }

        const canvas = await html2canvas(sheet, {
            scale: 2,
            backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // 설정: 좌우 여백 40pt, 상단 여백 40pt
        const horizontalMargin = 40;
        const topMargin = 40;

        // 가로 너비를 페이지 너비에서 양쪽 여백을 뺀 크기로 설정
        const renderWidth = pageWidth - (horizontalMargin * 2);
        // 세로 길이는 가로 너비 비율에 맞춰 계산
        const renderHeight = (imgHeight * renderWidth) / imgWidth;

        const offsetX = horizontalMargin;
        const offsetY = topMargin;

        doc.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight);

        const filename = `TBM_${formatDateForFilename(tbm.tbm_date)}_${tbm.line_name || ""}_${tbm.work_name || ""}.pdf`;
        doc.save(filename.replace(/\s+/g, "_"));
    } catch (error: any) {
        console.error("TBM PDF 생성 오류:", error);
        const message = error?.message || "TBM PDF 생성에 실패했습니다.";
        onError?.(message);
    } finally {
        if (root) {
            root.unmount();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
}
