import { useState, useRef, useEffect } from "react";
import { useWorkReportStore, FileCategory, UploadedFile } from "../../store/workReportStore";
import Button from "../common/Button";
import { getWorkLogReceipts, deleteWorkLogReceipt } from "../../lib/workLogApi";
import { useToast } from "../ui/ToastProvider";

// 아이콘들
const IconBed = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M7 13C8.66 13 10 11.66 10 10C10 8.34 8.66 7 7 7C5.34 7 4 8.34 4 10C4 11.66 5.34 13 7 13ZM19 7H11V14H3V5H1V20H3V17H21V20H23V11C23 8.79 21.21 7 19 7Z"
            fill="currentColor"
        />
    </svg>
);

const IconTool = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M22.7 19L13.6 9.9C14.5 7.6 14 4.9 12.1 3C10.1 1 7.1 0.6 4.7 1.7L9 6L6 9L1.6 4.7C0.4 7.1 0.9 10.1 2.9 12.1C4.8 14 7.5 14.5 9.8 13.6L18.9 22.7C19.3 23.1 19.9 23.1 20.3 22.7L22.6 20.4C23.1 20 23.1 19.3 22.7 19Z"
            fill="currentColor"
        />
    </svg>
);

const IconRestaurant = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M11 9H9V2H7V9H5V2H3V9C3 11.12 4.66 12.84 6.75 12.97V22H9.25V12.97C11.34 12.84 13 11.12 13 9V2H11V9ZM16 6V14H18.5V22H21V2C18.24 2 16 4.24 16 6Z"
            fill="currentColor"
        />
    </svg>
);

const IconFolder = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z"
            fill="currentColor"
        />
    </svg>
);

const IconUpload = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 15.01L9.41 16.42L11 14.84V19H13V14.84L14.59 16.43L16 15.01L12.01 11L8 15.01Z"
            fill="currentColor"
        />
    </svg>
);

const IconAdd = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"
            fill="currentColor"
        />
    </svg>
);

const IconClose = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
            fill="currentColor"
        />
    </svg>
);

interface FileCardProps {
    icon: React.ReactNode;
    title: string;
    category: FileCategory;
    onPreview: (url: string, name: string, type: string) => void;
    workLogId?: number | null;
}

function FileCard({ icon, title, category, onPreview, workLogId }: FileCardProps) {
    const { uploadedFiles, addFiles, removeFile, addExistingReceipt } = useWorkReportStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showError, showSuccess } = useToast();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [loadedReceiptIds, setLoadedReceiptIds] = useState<Set<number>>(new Set());

    const categoryFiles = uploadedFiles.filter((f) => f.category === category);

    // 기존 영수증 로드 (한 번만 실행)
    useEffect(() => {
        if (!workLogId) return;

        const loadReceipts = async () => {
            try {
                const receipts = await getWorkLogReceipts(workLogId);
                const currentUploadedFiles = uploadedFiles; // 클로저로 현재 상태 캡처
                
                receipts.forEach((receipt) => {
                    // 이미 uploadedFiles에 있는지 확인 (중복 방지)
                    const alreadyExists = currentUploadedFiles.some(
                        (f) => f.isExisting && f.receiptId === receipt.id
                    );
                    
                    // 이미 로드된 영수증인지 확인
                    const alreadyLoaded = loadedReceiptIds.has(receipt.id);
                    
                    // 카테고리가 일치하고, 아직 추가되지 않은 경우만 추가
                    if (!alreadyExists && !alreadyLoaded && receipt.category === category) {
                        addExistingReceipt({
                            receiptId: receipt.id,
                            category: receipt.category as FileCategory,
                            storagePath: receipt.storage_path,
                            originalName: receipt.original_name,
                            fileUrl: receipt.file_url,
                            mimeType: receipt.mime_type,
                        });
                        setLoadedReceiptIds((prev) => new Set(prev).add(receipt.id));
                    }
                });
            } catch (error: any) {
                console.error("Error loading receipts:", error);
            }
        };

        loadReceipts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workLogId, category]); // uploadedFiles를 dependency에서 제거하여 무한 루프 방지

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const fileArray = Array.from(files).filter(
            (file) =>
                file.type.startsWith("image/") ||
                file.type === "application/pdf"
        );
        if (fileArray.length > 0) {
            addFiles(fileArray, category);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        
        const file = uploadedFiles.find((f) => f.id === id);
        if (!file) return;

        // 기존 영수증인 경우 DB와 Storage에서 삭제
        if (file.isExisting && file.receiptId && file.storagePath) {
            setDeletingId(id);
            try {
                await deleteWorkLogReceipt(file.receiptId, file.storagePath);
                removeFile(id);
                showSuccess("영수증이 삭제되었습니다.");
            } catch (error: any) {
                console.error("Error deleting receipt:", error);
                showError(`영수증 삭제 실패: ${error.message || "알 수 없는 오류"}`);
            } finally {
                setDeletingId(null);
            }
        } else {
            // 새로 추가한 파일인 경우 로컬에서만 삭제
            removeFile(id);
        }
    };

    const handleThumbnailClick = (item: UploadedFile) => {
        if (item.isExisting && item.fileUrl) {
            // 기존 영수증
            const mimeType = item.mimeType || "image/jpeg";
            const fileName = item.originalName || "영수증";
            onPreview(item.fileUrl, fileName, mimeType);
        } else if (item.file) {
            // 새로 업로드한 파일
            if (item.preview) {
                onPreview(item.preview, item.file.name, item.file.type);
            } else if (item.file.type === "application/pdf") {
                const url = URL.createObjectURL(item.file);
                onPreview(url, item.file.name, item.file.type);
            }
        }
    };

    return (
        <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3">
            {/* 헤더 */}
            <div className="flex items-center gap-2 text-[#374151]">
                {icon}
                <span className="font-semibold text-[14px]">{title}</span>
            </div>

            {/* 파일 추가 버튼 */}
            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="primary"
                size="md"
                fullWidth
                icon={<IconAdd />}
            >
                파일 추가
            </Button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
            />

            {/* 파일 목록 */}
            {categoryFiles.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] text-[#6b7280]">
                        업로드 된 파일 ({categoryFiles.length}개)
                    </p>
                    {categoryFiles.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 bg-white border border-[#e5e7eb] rounded-lg"
                        >
                            {/* 썸네일 - 클릭 시 미리보기 */}
                            <div
                                className="w-12 h-12 bg-[#1f2937] rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-blue-400 transition-all"
                                onClick={() => handleThumbnailClick(item)}
                            >
                                {item.isExisting && item.fileUrl && (item.mimeType || "").startsWith("image/") ? (
                                    // 기존 파일이 이미지일 때만 썸네일 표시
                                    <img
                                        src={item.fileUrl}
                                        alt={item.originalName || "영수증"}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                ) : item.isExisting && item.fileUrl ? (
                                    // PDF 등 이미지가 아닌 기존 파일
                                    <span className="text-white text-[10px] font-bold">
                                        PDF
                                    </span>
                                ) : item.preview ? (
                                    // 새로 업로드한 이미지 파일
                                    <img
                                        src={item.preview}
                                        alt={item.file?.name || ""}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    // PDF 또는 이미지 로드 실패
                                    <span className="text-white text-[10px] font-bold">
                                        {item.isExisting ? "IMG" : "PDF"}
                                    </span>
                                )}
                            </div>

                            {/* 파일명 */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#374151] truncate">
                                    {item.isExisting
                                        ? item.originalName || "영수증"
                                        : item.file?.name || ""}
                                </p>
                            </div>

                            {/* 삭제 버튼 */}
                            <button
                                onClick={(e) => handleDelete(e, item.id)}
                                disabled={deletingId === item.id}
                                className="w-6 h-6 flex items-center justify-center text-[#9ca3af] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                            >
                                {deletingId === item.id ? (
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                ) : (
                                    <IconClose />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-[12px] text-[#9ca3af] text-center py-2">
                    업로드 된 파일이 없습니다.
                </p>
            )}
        </div>
    );
}

interface FileUploadSectionProps {
    workLogId?: number | null;
}

export default function FileUploadSection({ workLogId }: FileUploadSectionProps) {
    const { reportType } = useWorkReportStore();
    const [previewFile, setPreviewFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);

    const openPreview = (url: string, name: string, type: string) => {
        setPreviewFile({ url, name, type });
    };

    const closePreview = () => {
        setPreviewFile(null);
    };

    return (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 md:p-7 overflow-hidden flex flex-col gap-4 md:gap-5">
            {/* 헤더 */}
            <div className="flex items-center gap-2">
                <IconUpload />
                <div>
                    <h2 className="text-[18px] md:text-[22px] font-semibold text-[#364153] leading-[1.364] tracking-[-0.43px]">
                        첨부파일 업로드
                    </h2>
                </div>
            </div>

            {/* 4개 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reportType !== "education" && (
                    <>
                        <FileCard
                            icon={<IconBed />}
                            title="숙박 영수증"
                            category="숙박영수증"
                            onPreview={openPreview}
                            workLogId={workLogId}
                        />
                        <FileCard
                            icon={<IconTool />}
                            title="자재 영수증"
                            category="자재구매영수증"
                            onPreview={openPreview}
                            workLogId={workLogId}
                        />
                    </>
                )}
                <FileCard
                    icon={<IconRestaurant />}
                    title="식비 및 유대 영수증"
                    category="식비및유대영수증"
                    onPreview={openPreview}
                    workLogId={workLogId}
                />
                <FileCard
                    icon={<IconFolder />}
                    title="기타"
                    category="기타"
                    onPreview={openPreview}
                    workLogId={workLogId}
                />
            </div>

            {/* 미리보기 모달 */}
            {previewFile && (
                <div
                    onClick={closePreview}
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
                >
                    {/* 닫기 버튼 */}
                    <button
                        onClick={closePreview}
                        className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>

                    {/* 이미지/PDF - 클릭해도 모달 안닫힘 */}
                    <div
                        className="max-w-[90vw] max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {previewFile.type.startsWith("image/") ? (
                            <img
                                src={previewFile.url}
                                alt={previewFile.name}
                                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-white object-contain"
                            />
                        ) : (
                            <iframe
                                src={previewFile.url}
                                title={previewFile.name}
                                className="w-[85vw] h-[85vh] bg-white rounded-xl shadow-2xl"
                            />
                        )}
                        {/* 파일명 */}
                        <p className="text-white text-center mt-3 text-[14px] truncate">
                            {previewFile.name}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
