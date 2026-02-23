// pdfUtils.ts
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

// =====================
// 공통 유틸
// =====================

// 요일 변환 함수
const getDayOfWeek = (date: Date): string => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return days[date.getDay()];
};

// 날짜 파싱 (YYYY-MM-DD 형식)
const parseDate = (
    dateStr: string
): { year: number; month: number; day: number; dayOfWeek: string } => {
    if (!dateStr) {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            dayOfWeek: getDayOfWeek(now),
        };
    }
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
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

// =====================
// ✅ 나눔고딕 폰트 임베딩 (jsPDF용)
// =====================

/**
 * NanumGothic 폰트를 jsPDF VFS에 등록해서 한글 깨짐을 막는다.
 * public/fonts 에 아래 파일이 있어야 함:
 * - /fonts/NanumGothic-Regular.ttf
 * - /fonts/NanumGothic-Bold.ttf
 */
export async function addNanumGothicFont(
    doc: jsPDF
): Promise<{ success: boolean; hasBold: boolean }> {
    try {
        let regularAdded = false;
        let boldAdded = false;

        // Regular
        try {
            const regularUrl = "/fonts/NanumGothic-Regular.ttf";
            const res = await fetch(regularUrl);
            if (res.ok) {
                const buf = await res.arrayBuffer();
                const base64 = arrayBufferToBase64(buf);
                (doc as any).addFileToVFS("NanumGothic-Regular.ttf", base64);
                try {
                    (doc as any).addFont(
                        "NanumGothic-Regular.ttf",
                        "NanumGothic",
                        "normal"
                    );
                    regularAdded = true;
                } catch (e: any) {
                    console.warn("나눔고딕 Regular addFont 실패:", e?.message || e);
                }
            } else {
                console.warn("나눔고딕 Regular fetch 실패:", res.status);
            }
        } catch (e) {
            console.warn("나눔고딕 Regular 로드 실패:", e);
        }

        // Bold
        try {
            const boldUrl = "/fonts/NanumGothic-Bold.ttf";
            const res = await fetch(boldUrl);
            if (res.ok) {
                const buf = await res.arrayBuffer();
                const base64 = arrayBufferToBase64(buf);
                (doc as any).addFileToVFS("NanumGothic-Bold.ttf", base64);
                try {
                    (doc as any).addFont(
                        "NanumGothic-Bold.ttf",
                        "NanumGothic",
                        "bold"
                    );
                    boldAdded = true;
                } catch (e: any) {
                    const msg = e?.message || String(e);
                    // 일부 환경 unicode cmap 경고는 무시 가능
                    if (!msg.includes("unicode cmap") && !msg.includes("No unicode cmap")) {
                        console.warn("나눔고딕 Bold addFont 실패:", msg);
                    }
                }
            } else {
                console.warn("나눔고딕 Bold fetch 실패:", res.status);
            }
        } catch (e) {
            console.warn("나눔고딕 Bold 로드 실패:", e);
        }

        if (!(regularAdded || boldAdded)) {
            return { success: false, hasBold: false };
        }

        // 등록 확인 + 사용 테스트
        try {
            const fontList = doc.getFontList();
            if (!("NanumGothic" in fontList)) {
                console.warn("NanumGothic 폰트가 getFontList에 없음");
                return { success: false, hasBold: false };
            }
            try {
                doc.setFont("NanumGothic", regularAdded ? "normal" : "bold");
                return { success: true, hasBold: boldAdded };
            } catch (e: any) {
                console.warn("NanumGothic setFont 실패:", e?.message || e);
                return { success: false, hasBold: false };
            }
        } catch (e) {
            console.warn("폰트 목록 확인 실패:", e);
            return { success: false, hasBold: false };
        }
    } catch (e) {
        console.error("나눔고딕 폰트 추가 실패:", e);
        return { success: false, hasBold: false };
    }
}

// =====================
// 청구서 PDF
// =====================

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

        // ✅ 나눔고딕 폰트 등록
        let fontAdded = false;
        let hasBold = false;
        try {
            const r = await addNanumGothicFont(doc);
            fontAdded = r.success;
            hasBold = r.hasBold;
        } catch (e) {
            console.warn("폰트 추가 중 오류, 기본 폰트 사용:", e);
        }

        const fontName = fontAdded ? "NanumGothic" : "helvetica";
        const titleStyle = fontAdded ? (hasBold ? "bold" : "normal") : "bold";
        const normalStyle = "normal"; // 본문은 normal 고정

        // 안전한 초기 설정
        try {
            doc.setFont(fontName, titleStyle);
        } catch (e) {
            doc.setFont("helvetica", "bold");
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = margin;

        // 제목
        const title = `${employeeName} - ${year} ${month} 개인차량 및 지출 청구서`;
        doc.setFontSize(16);
        doc.setFont(fontName, titleStyle);
        doc.text(title, pageWidth / 2, yPos, { align: "center" });
        yPos += 20;

        // 1. 개인차량 마일리지
        doc.setFontSize(14);
        doc.setFont(fontName, titleStyle);
        doc.text("1. 개인차량 마일리지", margin, yPos);
        yPos += 10;

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
                // ✅ 테이블용 폰트 확정 (한글 깨짐 방지)
                let tableFont = "helvetica";
                if (fontAdded) {
                    try {
                        doc.setFont("NanumGothic", "normal");
                        tableFont = "NanumGothic";
                    } catch {
                        tableFont = "helvetica";
                    }
                }

                const availableWidth = pageWidth - margin * 2;

                autoTable(doc, {
                    startY: yPos,
                    head: [
                        [
                            "년",
                            "월",
                            "일",
                            "요일",
                            "장소 From",
                            "장소 To",
                            "거리 (km)",
                            "마일리지 (KRW)",
                            "비고",
                        ],
                    ],
                    body: mileageTableData,
                    styles: {
                        fontSize: 9,
                        font: tableFont,
                        fontStyle: "normal",
                        textColor: [0, 0, 0],
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    headStyles: {
                        fillColor: [255, 255, 200],
                        textColor: [0, 0, 0],
                        font: tableFont,
                        fontStyle: tableFont === "helvetica" ? "bold" : "normal",
                        fontSize: 9,
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    bodyStyles: {
                        font: tableFont,
                        fontStyle: "normal",
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250],
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    columnStyles: {
                        0: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        1: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        2: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        3: { cellWidth: availableWidth * 0.08, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        4: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        5: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        6: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        7: { cellWidth: availableWidth * 0.15, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        8: { cellWidth: availableWidth * 0.11, lineColor: [0, 0, 0], lineWidth: 0.5 },
                    },
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    tableLineColor: [0, 0, 0],
                    tableLineWidth: 0.5,
                });

                yPos = (doc as any).lastAutoTable?.finalY
                    ? (doc as any).lastAutoTable.finalY + 10
                    : yPos + 50;
            } catch (e) {
                console.error("마일리지 테이블 생성 오류:", e);
                doc.setFontSize(9);
                doc.setFont(fontName, normalStyle);
                mileageTableData.forEach((row) => {
                    doc.text(row.join(" | "), margin, yPos);
                    yPos += 5;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(11);
            doc.setFont(fontName, normalStyle);
            doc.text("마일리지 내역이 없습니다.", margin, yPos);
            yPos += 15;
        }

        // 마일리지 합계
        const totalDistance = mileageDetails.reduce((sum, item) => sum + (item.distance || 0), 0);
        const totalMileage = mileageDetails.reduce((sum, item) => sum + (item.amount || 0), 0);

        doc.setFontSize(11);
        doc.setFont(fontName, normalStyle);
        doc.text(
            `총 거리: ${totalDistance.toLocaleString("ko-KR")} km | 총 마일리지: ${totalMileage.toLocaleString("ko-KR")} 원`,
            margin,
            yPos
        );
        yPos += 15;

        // 2. 개인카드/현금 지출
        doc.setFontSize(14);
        doc.setFont(fontName, titleStyle);
        doc.text("2. 개인카드/현금 지출", margin, yPos);
        yPos += 10;

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
                let tableFont = "helvetica";
                if (fontAdded) {
                    try {
                        doc.setFont("NanumGothic", "normal");
                        tableFont = "NanumGothic";
                    } catch {
                        tableFont = "helvetica";
                    }
                }

                const availableWidth = pageWidth - margin * 2;

                autoTable(doc, {
                    startY: yPos,
                    head: [["년", "월", "일", "요일", "구분", "금액 (KRW)", "비고"]],
                    body: cardTableData,
                    styles: {
                        fontSize: 9,
                        font: tableFont,
                        fontStyle: "normal",
                        textColor: [0, 0, 0],
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    headStyles: {
                        fillColor: [255, 255, 200],
                        textColor: [0, 0, 0],
                        font: tableFont,
                        fontStyle: tableFont === "helvetica" ? "bold" : "normal",
                        fontSize: 9,
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    bodyStyles: {
                        font: tableFont,
                        fontStyle: "normal",
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250],
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                    },
                    columnStyles: {
                        0: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        1: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        2: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        3: { cellWidth: availableWidth * 0.12, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        4: { cellWidth: availableWidth * 0.18, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        5: { cellWidth: availableWidth * 0.18, lineColor: [0, 0, 0], lineWidth: 0.5 },
                        6: { cellWidth: availableWidth * 0.16, lineColor: [0, 0, 0], lineWidth: 0.5 },
                    },
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    tableLineColor: [0, 0, 0],
                    tableLineWidth: 0.5,
                });

                yPos = (doc as any).lastAutoTable?.finalY
                    ? (doc as any).lastAutoTable.finalY + 10
                    : yPos + 50;
            } catch (e) {
                console.error("카드 테이블 생성 오류:", e);
                doc.setFontSize(9);
                doc.setFont(fontName, normalStyle);
                cardTableData.forEach((row) => {
                    doc.text(row.join(" | "), margin, yPos);
                    yPos += 5;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(11);
            doc.setFont(fontName, normalStyle);
            doc.text("카드 지출 내역이 없습니다.", margin, yPos);
            yPos += 15;
        }

        // 카드 지출 합계
        const totalExpense = cardDetails.reduce((sum, item) => sum + (item.amount || 0), 0);

        doc.setFontSize(11);
        doc.setFont(fontName, normalStyle);
        doc.text(`총 지출: ${totalExpense.toLocaleString("ko-KR")}원`, margin, yPos);
        yPos += 15;

        // 총 청구 금액 (크게, normal)
        const totalClaim = totalMileage + totalExpense;
        doc.setFontSize(18);
        try {
            if (fontAdded) {
                doc.setFont("NanumGothic", "normal");
            } else {
                doc.setFont("helvetica", "normal");
            }
        } catch {
            doc.setFont("helvetica", "normal");
        }
        doc.text(`총 청구 금액: ${totalClaim.toLocaleString("ko-KR")} 원`, margin, yPos);
        yPos += 25;

        // 3. 영수증
        const receipts = cardDetails.filter((item) => item.receipt_path);
        if (receipts.length > 0) {
            doc.setFontSize(14);
            doc.setFont(fontName, titleStyle);
            doc.text("3. 영수증", margin, yPos);
            yPos += 10;

            const sortedReceipts = [...receipts].sort((a, b) => {
                const dateA = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
                const dateB = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
                return dateA - dateB;
            });

            for (const item of sortedReceipts) {
                const dateInfo = parseDate(item.dateRaw || item.date || "");
                const dateStr = `${dateInfo.year}.${String(dateInfo.month).padStart(2, "0")}.${String(
                    dateInfo.day
                ).padStart(2, "0")}`;

                // 텍스트
                doc.setFontSize(10);
                doc.setFont(fontName, normalStyle);
                const receiptText = `${dateStr} - ${item.category || "기타"} (${(item.amount || 0).toLocaleString(
                    "ko-KR"
                )}원)`;
                doc.text(receiptText, margin, yPos);

                const receiptUrl = item.receipt_path ? getReceiptUrl(item.receipt_path) : null;

                if (receiptUrl) {
                    try {
                        const img = new Image();
                        img.crossOrigin = "anonymous";

                        await new Promise<void>((resolve) => {
                            const timeout = setTimeout(() => {
                                console.warn("이미지 로드 타임아웃:", receiptUrl);
                                yPos += 20;
                                resolve();
                            }, 7000);

                            img.onload = () => {
                                clearTimeout(timeout);
                                try {
                                    const maxWidth = 60;
                                    const maxHeight = 60;
                                    let imgWidth = img.width;
                                    let imgHeight = img.height;
                                    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                                    imgWidth *= ratio;
                                    imgHeight *= ratio;

                                    const pageHeight = doc.internal.pageSize.getHeight();
                                    if (yPos + imgHeight + 10 > pageHeight - margin) {
                                        doc.addPage();
                                        yPos = margin;
                                    }

                                    doc.addImage(img, "JPEG", margin, yPos + 5, imgWidth, imgHeight);
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
                    } catch (e) {
                        console.error("영수증 이미지 처리 실패:", e);
                        yPos += 20;
                    }
                } else {
                    yPos += 20;
                }
            }
        }

        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
        console.error("PDF 생성 오류:", error);
        const errorMessage = `PDF 생성 실패: ${error instanceof Error ? error.message : String(error)}`;
        onError?.(errorMessage);
    }
}

// =====================
// TBM PDF (html2canvas → 이미지 → PDF)
// =====================

type TbmPdfParams = {
    tbmId: string;
    onError?: (message: string) => void;
};

const formatDateForFilename = (value?: string | null) =>
    value ? String(value).replace(/-/g, "") : "TBM";

export async function generateTbmPdf({ tbmId, onError }: TbmPdfParams): Promise<void> {
    let container: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;

    try {
        const { tbm, participants } = await import("./tbmApi").then((mod) =>
            mod.getTbmDetail(tbmId)
        );

        if (!tbm) throw new Error("TBM 정보를 불러오지 못했습니다.");

        // 서명 완료된 참가자들의 서명 이미지 URL 로드
        const signatureUrls = new Map<string, string>();
        const signedUserIds = (participants || [])
            .filter((p) => p.user_id && p.signed_at)
            .map((p) => p.user_id!);

        if (signedUserIds.length > 0) {
            const { supabase } = await import("./supabase");
            const { data: profiles, error } = await supabase
                .from("profiles")
                .select("id, signature_bucket, signature_path")
                .in("id", signedUserIds);

            if (!error && profiles) {
                const urlPromises = profiles.map(async (profile) => {
                    if (profile.signature_bucket && profile.signature_path) {
                        try {
                            const { data, error: urlError } = await supabase.storage
                                .from(profile.signature_bucket)
                                .createSignedUrl(profile.signature_path, 60 * 60);

                            if (!urlError && data) {
                                return { userId: profile.id, url: data.signedUrl };
                            } else {
                                const { data: publicData } = supabase.storage
                                    .from(profile.signature_bucket)
                                    .getPublicUrl(profile.signature_path);
                                return { userId: profile.id, url: publicData.publicUrl };
                            }
                        } catch (e) {
                            console.error(`서명 URL 로드 실패 (${profile.id}):`, e);
                            return null;
                        }
                    }
                    return null;
                });

                const results = await Promise.all(urlPromises);
                results.forEach((result) => {
                    if (result) {
                        signatureUrls.set(result.userId, result.url);
                    }
                });
            }
        }

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

        // ✅ TBM은 캔버스로 "화면을 찍는" 방식이라
        // CSS 폰트가 제대로 적용되어야 한글이 안 깨짐.
        // 그래서 fontFamily를 NanumGothic으로 강제.
        root.render(
            React.createElement(
                "div",
                {
                    style: {
                        width: "794px",
                        padding: "24px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                        fontFamily: '"NanumGothic", sans-serif',
                    },
                },
                React.createElement(TbmDetailSheet, {
                    tbm,
                    participants: participants || [],
                    variant: "pdf",
                    signatureUrls,
                })
            )
        );

        // 렌더/폰트 로딩 대기
        await new Promise((resolve) => setTimeout(resolve, 0));
        if ("fonts" in document) {
            await (document as any).fonts.ready;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 서명 이미지 로딩 대기
        if (signatureUrls.size > 0) {
            const imagePromises: Promise<void>[] = [];
            signatureUrls.forEach((url) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                const promise = new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // 실패해도 계속 진행
                    img.src = url;
                    // 타임아웃 설정 (5초)
                    setTimeout(() => resolve(), 5000);
                });
                imagePromises.push(promise);
            });
            await Promise.all(imagePromises);
            // 추가 대기 시간 (이미지 렌더링 완료 보장)
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const sheet = container.querySelector("[data-tbm-sheet]") as HTMLElement | null;
        if (!sheet) throw new Error("TBM PDF 렌더링에 실패했습니다.");

        const canvas = await html2canvas(sheet, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            allowTaint: false,
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

        const horizontalMargin = 40;
        const topMargin = 40;

        const renderWidth = pageWidth - horizontalMargin * 2;
        const renderHeight = (imgHeight * renderWidth) / imgWidth;

        doc.addImage(imgData, "PNG", horizontalMargin, topMargin, renderWidth, renderHeight);

        const filename = `TBM_${formatDateForFilename(tbm.tbm_date)}_${tbm.line_name || ""}_${tbm.work_name || ""}.pdf`;
        doc.save(filename.replace(/\s+/g, "_"));
    } catch (error: any) {
        console.error("TBM PDF 생성 오류:", error);
        onError?.(error?.message || "TBM PDF 생성에 실패했습니다.");
    } finally {
        if (root) root.unmount();
        if (container?.parentNode) container.parentNode.removeChild(container);
    }
}
