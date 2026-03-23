// ReceiptExpenseModal.tsx
import { useState, useMemo, useEffect, useRef } from "react";
import BaseModal from "../ui/BaseModal";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import TextInput from "../ui/TextInput";
import Select from "../common/Select";
import RequiredIndicator from "../ui/RequiredIndicator";
import { useWorkReportStore, formatCurrency, parseCurrency, EXPENSE_TYPES, FileCategory, UploadedFile, ExpenseEntry } from "../../store/workReportStore";
import { IconChevronLeft, IconChevronRight } from "../icons/Icons";

interface ReceiptExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    receiptsByCategory: Record<FileCategory, UploadedFile[]>;
}

export default function ReceiptExpenseModal({
    isOpen,
    onClose,
    receiptsByCategory,
}: ReceiptExpenseModalProps) {
    const { workers, vehicles, workLogEntries, addExpense, expenses, deleteExpense, updateExpense, editingExpenseId, editExpense, cancelEditExpense } = useWorkReportStore();

    const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
    const [sortOrder, setSortOrder] = useState<'category' | 'time'>('category');

    // 모든 영수증을 하나의 배열로 합치기 및 정렬
    const allReceipts = useMemo(() => {
        const receipts: Array<{ file: UploadedFile; category: FileCategory }> = [];
        Object.entries(receiptsByCategory).forEach(([category, files]) => {
            files.forEach((file) => {
                receipts.push({ file, category: category as FileCategory });
            });
        });
        
        // 정렬
        if (sortOrder === 'time') {
            // 시간순 정렬
            receipts.sort((a, b) => {
                // NEW 배지가 있는 새로 업로드한 파일을 최우선으로
                const aIsNew = !a.file.isExisting;
                const bIsNew = !b.file.isExisting;
                
                if (aIsNew && !bIsNew) return -1; // a가 NEW면 앞으로
                if (!aIsNew && bIsNew) return 1;  // b가 NEW면 앞으로
                
                // 둘 다 NEW이거나 둘 다 기존 파일인 경우
                if (aIsNew && bIsNew) {
                    // 둘 다 NEW면 lastModified 기준 내림차순 (최신이 앞)
                    const dateA = a.file.file?.lastModified || 0;
                    const dateB = b.file.file?.lastModified || 0;
                    return dateB - dateA;
                } else {
                    // 둘 다 기존 파일이면 createdAt 기준 내림차순 (최신이 앞)
                    const dateA = a.file.createdAt 
                        ? new Date(a.file.createdAt).getTime()
                        : 0;
                    const dateB = b.file.createdAt 
                        ? new Date(b.file.createdAt).getTime()
                        : 0;
                    return dateB - dateA;
                }
            });
        }
        // 유형순은 Object.entries 순서 유지 (기본값)
        
        return receipts;
    }, [receiptsByCategory, sortOrder]);

    // 입력 상태
    const [date, setDate] = useState("");
    const [type, setType] = useState("");
    const [typeCustom, setTypeCustom] = useState("");
    const [detail, setDetail] = useState("");
    const [amount, setAmount] = useState("");
    const [isAmountFocused, setIsAmountFocused] = useState(false);
    const [currency, setCurrency] = useState<string>("원");

    // 이미지 확대/축소 및 드래그 상태 (모바일 전용)
    const [imageScale, setImageScale] = useState(1);
    const [imageTranslate, setImageTranslate] = useState({ x: 0, y: 0 });
    const [lastTouchDistance, setLastTouchDistance] = useState(0);
    const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const inputFormRef = useRef<HTMLDivElement>(null);

    // 현재 영수증
    const currentReceipt = allReceipts[currentReceiptIndex];
    const isVehicleManageSelected =
        currentReceipt?.category === "기타" &&
        (typeCustom || type) === "차량 정비";

    // 카테고리에 따른 분류 옵션 필터링
    const getTypeOptions = (category: FileCategory | undefined) => {
        if (!category) {
            return [
                ...EXPENSE_TYPES.filter((t) => t !== "기타").map((t) => ({
                    value: t,
                    label: t,
                })),
                { value: "OTHER", label: "기타" },
            ];
        }

        if (category === "숙박영수증") {
            return [{ value: "숙박", label: "숙박" }];
        }

        if (category === "자재구매영수증") {
            return [
                { value: "자재 구입", label: "자재 구입" },
                { value: "공구 구입", label: "공구 구입" },
                { value: "소모품 구입", label: "소모품 구입" },
            ];
        }

        if (category === "식비및유대영수증") {
            return [
                { value: "조식", label: "조식" },
                { value: "중식", label: "중식" },
                { value: "석식", label: "석식" },
                { value: "간식", label: "간식" },
                { value: "유대", label: "유대" },
            ];
        }

        // 기타
        return [
            ...EXPENSE_TYPES.filter((t) => t !== "기타").map((t) => ({
                value: t,
                label: t,
            })),
            { value: "OTHER", label: "기타" },
        ];
    };

    // 카테고리 이름 표시용
    const getCategoryLabel = (category: FileCategory | undefined) => {
        switch (category) {
            case "숙박영수증":
                return "숙박";
            case "자재구매영수증":
                return "자재";
            case "식비및유대영수증":
                return "식비 및 유대";
            case "기타":
                return "기타";
            default:
                return "";
        }
    };

    // 카테고리 배지 색상 (모바일: 불투명, PC: 투명도 20%)
    const getCategoryBadgeColor = (category: FileCategory | undefined) => {
        switch (category) {
            case "숙박영수증":
                return "bg-blue-500 md:bg-blue-500/20";
            case "자재구매영수증":
                return "bg-green-500 md:bg-green-500/20";
            case "식비및유대영수증":
                return "bg-orange-500 md:bg-orange-500/20";
            case "기타":
                return "bg-gray-500 md:bg-gray-500/20";
            default:
                return "bg-gray-500 md:bg-gray-500/20";
        }
    };

    // 정렬 순서 변경 시 인덱스 리셋
    useEffect(() => {
        setCurrentReceiptIndex(0);
    }, [sortOrder]);

    // 키보드 이벤트 핸들러 (좌우 방향키로 영수증 이동)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 입력 필드에 포커스가 있으면 방향키 동작 안 함
            const activeElement = document.activeElement;
            if (
                activeElement &&
                (activeElement.tagName === 'INPUT' ||
                 activeElement.tagName === 'TEXTAREA' ||
                 (activeElement as HTMLElement).isContentEditable)
            ) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentReceiptIndex > 0) {
                    setCurrentReceiptIndex(currentReceiptIndex - 1);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (currentReceiptIndex < allReceipts.length - 1) {
                    setCurrentReceiptIndex(currentReceiptIndex + 1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, currentReceiptIndex, allReceipts.length]);

    // 영수증 변경 시 분류 자동 설정 및 확대 상태 리셋
    useEffect(() => {
        if (currentReceipt) {
            const category = currentReceipt.category;
            
            if (category === "숙박영수증") {
                setType("숙박");
                setTypeCustom("");
            } else if (category === "기타") {
                // 기타 카테고리는 직접 입력이므로 초기화
                setType("");
                setTypeCustom("");
            } else {
                // 자재나 식비의 경우 첫 번째 옵션으로 설정하지 않고 빈 값으로 둠
                setType("");
                setTypeCustom("");
            }
        }
        // 영수증 변경 시 확대/이동 상태 리셋
        setImageScale(1);
        setImageTranslate({ x: 0, y: 0 });
    }, [currentReceiptIndex, currentReceipt]);

    // 두 터치 포인트 사이의 거리 계산
    const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // 두 터치 포인트의 중심점 계산
    const getTouchCenter = (touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
        };
    };

    // 터치 시작
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // 핀치 줌 시작
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            const center = getTouchCenter(e.touches[0], e.touches[1]);
            setLastTouchDistance(distance);
            setLastTouchCenter(center);
            setIsDragging(false);
            setSwipeStart(null);
        } else if (e.touches.length === 1) {
            if (imageScale > 1) {
                // 확대된 상태에서 드래그 시작
                setIsDragging(true);
                setDragStart({
                    x: e.touches[0].clientX - imageTranslate.x,
                    y: e.touches[0].clientY - imageTranslate.y,
                });
                setSwipeStart(null);
            } else {
                // 확대되지 않은 상태에서 스와이프 시작
                setSwipeStart({
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                });
                setIsDragging(false);
            }
        }
    };

    // 터치 이동
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            // 핀치 줌
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            const center = getTouchCenter(e.touches[0], e.touches[1]);
            
            if (lastTouchDistance > 0) {
                const scaleChange = distance / lastTouchDistance;
                const newScale = Math.max(1, Math.min(5, imageScale * scaleChange));
                setImageScale(newScale);
                
                // 확대 시 중심점 기준으로 이동
                setImageTranslate(prev => ({
                    x: prev.x + (center.x - lastTouchCenter.x),
                    y: prev.y + (center.y - lastTouchCenter.y),
                }));
            }
            
            setLastTouchDistance(distance);
            setLastTouchCenter(center);
            setSwipeStart(null);
        } else if (e.touches.length === 1 && isDragging && imageScale > 1) {
            e.preventDefault();
            // 확대된 상태에서 드래그
            const newX = e.touches[0].clientX - dragStart.x;
            const newY = e.touches[0].clientY - dragStart.y;
            
            // 이미지 경계 제한 (간단한 제한)
            if (imageContainerRef.current && imageRef.current) {
                const containerRect = imageContainerRef.current.getBoundingClientRect();
                const imageRect = imageRef.current.getBoundingClientRect();
                
                const maxX = Math.max(0, (imageRect.width * imageScale - containerRect.width) / 2);
                const maxY = Math.max(0, (imageRect.height * imageScale - containerRect.height) / 2);
                
                setImageTranslate({
                    x: Math.max(-maxX, Math.min(maxX, newX)),
                    y: Math.max(-maxY, Math.min(maxY, newY)),
                });
            } else {
                setImageTranslate({
                    x: newX,
                    y: newY,
                });
            }
            setSwipeStart(null);
        } else if (e.touches.length === 1 && swipeStart && imageScale === 1) {
            // 스와이프 중일 때는 기본 동작 방지하지 않음 (스크롤 가능하도록)
            // 스와이프 감지는 handleTouchEnd에서 처리
        }
    };

    // 터치 종료
    const handleTouchEnd = (e: React.TouchEvent) => {
        setLastTouchDistance(0);
        setIsDragging(false);
        
        // 확대가 1 이하로 내려가면 리셋
        if (imageScale <= 1) {
            setImageScale(1);
            setImageTranslate({ x: 0, y: 0 });
        }

        // 스와이프 감지 (확대되지 않은 상태에서만)
        if (swipeStart && imageScale === 1 && e.changedTouches.length > 0) {
            const touchEnd = e.changedTouches[0];
            const deltaX = touchEnd.clientX - swipeStart.x;
            const deltaY = touchEnd.clientY - swipeStart.y;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);

            // 수평 이동이 수직 이동보다 크고, 최소 50px 이상 이동했을 때만 스와이프로 인식
            if (absDeltaX > absDeltaY && absDeltaX > 50) {
                if (deltaX > 0) {
                    // 오른쪽으로 스와이프 (이전 영수증, 순환)
                    if (currentReceiptIndex > 0) {
                        setCurrentReceiptIndex(currentReceiptIndex - 1);
                    } else {
                        // 첫 페이지에서 이전으로 가면 마지막 페이지로
                        setCurrentReceiptIndex(allReceipts.length - 1);
                    }
                } else if (deltaX < 0) {
                    // 왼쪽으로 스와이프 (다음 영수증, 순환)
                    if (currentReceiptIndex < allReceipts.length - 1) {
                        setCurrentReceiptIndex(currentReceiptIndex + 1);
                    } else {
                        // 마지막 페이지에서 다음으로 가면 첫 페이지로
                        setCurrentReceiptIndex(0);
                    }
                }
            }
        }

        setSwipeStart(null);
    };

    // 영수증 이미지 URL 가져오기
    const getReceiptImageUrl = (file: UploadedFile): string | null => {
        if (!file) return null;
        
        // 기존 파일 (DB에 저장된 파일)
        if (file.isExisting === true) {
            if (file.fileUrl) {
                return file.fileUrl;
            }
            return null;
        }
        
        // 새로 업로드한 파일 (isExisting이 false이거나 undefined)
        // preview가 있으면 우선 사용
        if (file.preview) {
            return file.preview;
        }
        
        // preview가 없고 file 객체가 있으면 ObjectURL 생성
        if (file.file) {
            if (file.file.type && file.file.type.startsWith("image/")) {
                return URL.createObjectURL(file.file);
            }
        }
        
        return null;
    };

    // 엔트리에서 날짜 추출
    const entryDates = useMemo(() => {
        const dates = new Set<string>();
        workLogEntries.forEach((e) => {
            if (e.dateFrom) dates.add(e.dateFrom);
            if (e.dateTo && e.dateTo !== e.dateFrom) dates.add(e.dateTo);
        });
        return Array.from(dates).sort();
    }, [workLogEntries]);

    // 이전 영수증 (순환)
    const handlePrevReceipt = () => {
        if (currentReceiptIndex > 0) {
            setCurrentReceiptIndex(currentReceiptIndex - 1);
        } else {
            // 첫 페이지에서 이전으로 가면 마지막 페이지로
            setCurrentReceiptIndex(allReceipts.length - 1);
        }
    };

    // 다음 영수증 (순환)
    const handleNextReceipt = () => {
        if (currentReceiptIndex < allReceipts.length - 1) {
            setCurrentReceiptIndex(currentReceiptIndex + 1);
        } else {
            // 마지막 페이지에서 다음으로 가면 첫 페이지로
            setCurrentReceiptIndex(0);
        }
    };

    // 금액 변경 핸들러
    const handleAmountChange = (value: string) => {
        const cleaned = value.replace(/[^\d]/g, "");
        setAmount(cleaned);
    };

    // 인원 모두 추가
    const handleAddAllPersons = () => {
        setDetail(workers.join(", "));
    };

    // 행 클릭 핸들러 - 입력란에 정보 표시
    const handleRowClick = (expense: ExpenseEntry) => {
        editExpense(expense.id);
        setDate(expense.date);
        setDetail(expense.detail);
        setAmount(String(expense.amount));
        setCurrency(expense.currency || "원");
        
        // 분류 설정
        if (expense.type === "OTHER" || expense.type === "기타") {
            setType("OTHER");
            setTypeCustom(expense.type);
        } else {
            setType(expense.type);
            setTypeCustom("");
        }
        
        // 모바일에서 입력란으로 스크롤
        if (inputFormRef.current && window.innerWidth < 768) {
            inputFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 행 추가 및 수정 저장
    const handleAddRow = () => {
        const finalDate = date || entryDates[0] || "";
        // "기타" 카테고리일 때는 typeCustom을 직접 사용, 아니면 기존 로직 사용
        const finalType = currentReceipt?.category === "기타" 
            ? (typeCustom || type) 
            : (type === "OTHER" || type === "기타" ? (typeCustom || type) : type);

        if (!finalDate || !finalType || !detail || parseCurrency(amount) <= 0) {
            alert("모든 필드를 입력해주세요.");
            return;
        }

        // 수정 모드인 경우
        if (editingExpenseId !== null) {
            updateExpense(editingExpenseId, {
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
                currency: currency || "원",
            });
        } else {
            // 새로 추가
            addExpense({
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
                currency: currency || "원",
            });
        }

        // 입력 필드 초기화 (화폐 단위는 유지)
        setDate("");
        setDetail("");
        setAmount("");
        cancelEditExpense();
        
        // 숙박 영수증이면 분류를 "숙박"으로 유지, 기타는 직접 입력이므로 초기화, 아니면 초기화
        if (currentReceipt && currentReceipt.category === "숙박영수증") {
            setType("숙박");
            setTypeCustom("");
        } else if (currentReceipt && currentReceipt.category === "기타") {
            setType("");
            setTypeCustom("");
        } else {
            setType("");
            setTypeCustom("");
        }
    };

    // 행 삭제
    const handleDeleteRow = (id: number) => {
        if (confirm("삭제하시겠습니까?")) {
            deleteExpense(id);
        }
    };

    // 수정 취소
    const handleCancelEdit = () => {
        cancelEditExpense();
        setDate("");
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
        setCurrency("원");
        
        // 숙박 영수증이면 분류를 "숙박"으로 유지
        if (currentReceipt && currentReceipt.category === "숙박영수증") {
            setType("숙박");
        }
    };

    // 모달 닫기 및 초기화
    const handleClose = () => {
        setCurrentReceiptIndex(0);
        setDate("");
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
        setCurrency("원");
        cancelEditExpense();
        onClose();
    };

    // 모달이 열릴 때 초기화
    useEffect(() => {
        if (isOpen) {
            setCurrentReceiptIndex(0);
            setDate("");
            setTypeCustom("");
            setDetail("");
            setAmount("");
            setCurrency("원");
            cancelEditExpense();
            
            // 첫 번째 영수증의 카테고리에 따라 분류 설정
            if (allReceipts.length > 0 && allReceipts[0].category === "숙박영수증") {
                setType("숙박");
            } else {
                setType("");
            }
        }
    }, [isOpen, allReceipts]);


    // 날짜 포맷팅
    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
    };

    // 업로드 날짜 포맷팅 (3/11 형식)
    const formatUploadDate = (file: UploadedFile): string => {
        let date: Date;
        
        if (file.createdAt) {
            // DB에 저장된 시간 사용
            date = new Date(file.createdAt);
        } else if (file.file) {
            // 새로 업로드한 파일인 경우 (아직 DB에 저장되지 않음)
            date = new Date(file.file.lastModified);
        } else {
            // 기본값: 현재 날짜
            date = new Date();
        }
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}.${day}`;
    };

    // 이미지 URL 메모이제이션 및 ObjectURL 관리 (Hook은 조건부 return 이전에 위치해야 함)
    const imageUrl = useMemo(() => {
        if (!currentReceipt) return null;
        const url = getReceiptImageUrl(currentReceipt.file);
        return url;
    }, [currentReceipt?.file?.id, currentReceipt?.file?.preview, currentReceipt?.file?.fileUrl, currentReceipt?.file?.isExisting, currentReceipt?.file?.file]);

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title="영수증 보면서 지출내역 추가"
            maxWidth="max-w-7xl"
            className="max-h-[85vh] md:max-h-none"
            compactHeader={true}
        >
            {allReceipts.length === 0 ? (
                <div className="py-8 md:py-10 flex flex-col items-center text-center gap-3">
                    <p className="text-[16px] font-semibold text-gray-800">
                        업로드된 영수증이 없습니다.
                    </p>
                    <p className="text-[14px] text-gray-500">
                        첨부파일 업로드 섹션에서 영수증을 먼저 추가한 뒤 다시 시도해주세요.
                    </p>
                </div>
            ) : (
            <>
            <div className="flex flex-col md:flex-row gap-2 md:gap-6 md:min-h-[600px] md:max-h-[70vh] -mt-1 md:mt-0 touch-none md:touch-auto">
                {/* 좌측: 영수증 이미지 */}
                <div 
                    ref={imageContainerRef}
                    className="flex-[0.4] md:flex-1 flex flex-col items-center justify-center relative min-h-[195px] max-h-[325px] md:min-h-[300px] md:max-h-none overflow-hidden md:overflow-auto sticky top-0 md:static z-30 md:z-auto shrink-0 bg-white"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ touchAction: 'none' }}
                >
                    {imageUrl ? (
                        <>
                            <div className="w-full h-full flex items-center justify-center relative p-2">
                                {/* 영수증 유형 배지 */}
                                {currentReceipt && (
                                    <div className={`absolute top-2 left-2 ${getCategoryBadgeColor(currentReceipt.category)} text-white px-2 py-1 rounded-full text-xs font-semibold z-10 shadow-lg`}>
                                        {getCategoryLabel(currentReceipt.category)}
                                    </div>
                                )}
                                {/* 업로드 날짜 배지 (DB에 저장된 파일만 표시) */}
                                {currentReceipt && currentReceipt.file.isExisting && (
                                    <div className="absolute top-2 right-2 bg-gray-500 md:bg-gray-500/20 text-white px-2 py-1 rounded-full text-xs font-semibold z-10 shadow-lg">
                                        {formatUploadDate(currentReceipt.file)}
                                    </div>
                                )}
                                {/* NEW 배지 (새로 업로드한 파일만 표시) */}
                                {currentReceipt && !currentReceipt.file.isExisting && (
                                    <div className="absolute top-2 right-2 bg-red-500 md:bg-red-500/20 text-white px-2 py-1 rounded-full text-xs font-semibold z-10 shadow-lg">
                                        NEW
                                    </div>
                                )}
                                <img
                                    ref={imageRef}
                                    src={imageUrl}
                                    alt="영수증"
                                    className="w-auto h-auto max-w-full max-h-[260px] md:max-h-none object-contain rounded-md shadow-lg select-none"
                                    style={{ 
                                        maxWidth: '100%', 
                                        height: 'auto',
                                        transform: `scale(${imageScale}) translate(${imageTranslate.x / imageScale}px, ${imageTranslate.y / imageScale}px)`,
                                        transformOrigin: 'center center',
                                        transition: imageScale === 1 ? 'transform 0.3s ease-out' : 'none',
                                        touchAction: 'none',
                                    }}
                                />
                                {/* 좌우 버튼 */}
                                {allReceipts.length > 1 && (
                                    <>
                                        <button
                                            onClick={handlePrevReceipt}
                                            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all z-10"
                                        >
                                            <IconChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
                                        </button>
                                        <button
                                            onClick={handleNextReceipt}
                                            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all z-10"
                                        >
                                            <IconChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
                                        </button>
                                    </>
                                )}
                            </div>
                            {/* 영수증 인덱스 표시 (모바일) */}
                            {allReceipts.length > 1 && (
                                <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded-full text-xs">
                                    {currentReceiptIndex + 1} / {allReceipts.length}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-gray-400 text-center">
                            <p>이미지를 불러올 수 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* 모바일 구분선 */}
                <div className="md:hidden border-t border-gray-200 my-2"></div>

                {/* 우측: 입력 폼 및 표 */}
                <div className="flex-1 flex flex-col gap-3 md:gap-4 overflow-y-auto md:overflow-visible min-h-0 touch-pan-y md:touch-auto relative md:relative" style={{ touchAction: 'pan-y' }}>
                    {/* 우측 상단: 입력 폼 */}
                    <div ref={inputFormRef} className="flex flex-col gap-3 md:gap-4 bg-white border border-gray-200 rounded-lg p-3 md:p-4 md:mt-0">
                        {/* 정렬 버튼 */}
                        <div className="flex items-center gap-2">
                            <Button
                                size="md"
                                variant={sortOrder === 'category' ? 'primary' : 'outline'}
                                onClick={() => setSortOrder('category')}
                                className="flex-1"
                                fullWidth
                            >
                                유형순
                            </Button>
                            <Button
                                size="md"
                                variant={sortOrder === 'time' ? 'primary' : 'outline'}
                                onClick={() => setSortOrder('time')}
                                className="flex-1"
                                fullWidth
                            >
                                시간순
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {/* 날짜 */}
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-[14px] text-gray-900">
                                    날짜
                                    <RequiredIndicator />
                                </label>
                                <DatePicker
                                    value={date}
                                    onChange={setDate}
                                    placeholder="날짜 선택"
                                />
                                {entryDates.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {entryDates.map((d) => (
                                            <Button
                                                key={d}
                                                size="sm"
                                                variant={date === d ? "primary" : "outline"}
                                                onClick={() => setDate(d)}
                                            >
                                                {formatDate(d)}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 분류 */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="font-medium text-[14px] text-gray-900">
                                        분류
                                        <RequiredIndicator />
                                    </label>
                                    {currentReceipt?.category === "기타" && (
                                        <Button
                                            type="button"
                                            size="xs"
                                            variant={isVehicleManageSelected ? "primary" : "outline"}
                                            className="shrink-0 px-2"
                                            onClick={() => {
                                                if (isVehicleManageSelected) {
                                                    setType("");
                                                    setTypeCustom("");
                                                    return;
                                                }
                                                setType("차량 정비");
                                                setTypeCustom("차량 정비");
                                            }}
                                        >
                                            차량 정비
                                        </Button>
                                    )}
                                </div>
                                {currentReceipt?.category === "숙박영수증" ? (
                                    <Select
                                        placeholder=""
                                        options={getTypeOptions(currentReceipt?.category)}
                                        value={type}
                                        onChange={(val) => {
                                            setType(val);
                                            setTypeCustom("");
                                        }}
                                        size="md"
                                        fullWidth
                                    />
                                ) : currentReceipt?.category === "자재구매영수증" || currentReceipt?.category === "식비및유대영수증" ? (
                                    <div className={`grid gap-2 ${currentReceipt.category === "자재구매영수증" ? "grid-cols-3" : "grid-cols-5"}`}>
                                        {getTypeOptions(currentReceipt?.category).map((option) => (
                                            <Button
                                                key={option.value}
                                                size="md"
                                                variant={type === option.value ? "primary" : "outline"}
                                                onClick={() => {
                                                    setType(option.value);
                                                    setTypeCustom("");
                                                }}
                                                fullWidth
                                            >
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>
                                ) : currentReceipt?.category === "기타" ? (
                                    <TextInput
                                        placeholder="분류를 직접 입력"
                                        value={typeCustom || type}
                                        onChange={(val) => {
                                            setTypeCustom(val);
                                            setType(val);
                                        }}
                                    />
                                ) : (
                                    <>
                                        <Select
                                            label=""
                                            required
                                            placeholder="분류 선택"
                                            options={getTypeOptions(currentReceipt?.category)}
                                            value={type}
                                            onChange={(val) => {
                                                setType(val);
                                                setTypeCustom("");
                                            }}
                                            size="md"
                                            fullWidth
                                        />
                                        {(type === "OTHER" || type === "기타") && (
                                            <TextInput
                                                placeholder="분류를 직접 입력"
                                                value={typeCustom}
                                                onChange={setTypeCustom}
                                            />
                                        )}
                                    </>
                                )}
                            </div>

{/* 상세내용 */}
<div className="flex flex-col gap-2 md:col-span-2">
    <div className="flex items-center justify-between">
        <label className="font-medium text-[14px] text-gray-900">
            상세내용
            <RequiredIndicator />
        </label>
        {type !== "유대" && (
            <Button
                onClick={handleAddAllPersons}
                variant="outline"
                size="sm"
            >
                인원 모두 추가
            </Button>
        )}
    </div>

    {type === "유대" && vehicles.length > 0 && (
        <div className="flex flex-wrap gap-2">
            {vehicles.map((vehicle) => (
                <Button
                    key={vehicle}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetail(`${vehicle} 주유`)}
                >
                    {vehicle}
                </Button>
            ))}
        </div>
    )}

    <TextInput
        placeholder="상세내용 입력"
        value={detail}
        onChange={setDetail}
    />
</div>

                            {/* 금액 */}
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="font-medium text-[14px] text-gray-900">
                                    금액
                                    <RequiredIndicator />
                                </label>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 min-w-0">
                                        <TextInput
                                            placeholder="0"
                                            inputMode="numeric"
                                            value={isAmountFocused ? amount : (amount ? formatCurrency(parseCurrency(amount)) : "")}
                                            onChange={(val) => handleAmountChange(val)}
                                            onFocus={(e) => {
                                                setIsAmountFocused(true);
                                                const num = parseCurrency(e.target.value);
                                                if (num > 0) {
                                                    setAmount(String(num));
                                                }
                                            }}
                                            onBlur={(e) => {
                                                setIsAmountFocused(false);
                                                const num = parseCurrency(e.target.value);
                                                if (num > 0) {
                                                    setAmount(formatCurrency(num));
                                                } else {
                                                    setAmount("");
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="w-24 shrink-0 flex-shrink-0">
                                        <Select
                                            options={[
                                                { value: "원", label: "원" },
                                                { value: "엔", label: "엔" },
                                                { value: "달러", label: "달러" },
                                                { value: "유로", label: "유로" },
                                            ]}
                                            value={currency}
                                            onChange={setCurrency}
                                            size="md"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 추가/수정 저장 버튼 */}
                        {editingExpenseId !== null ? (
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleCancelEdit}
                                    variant="outline"
                                    size="md"
                                    className="md:size-lg flex-1"
                                    fullWidth
                                >
                                    수정 취소
                                </Button>
                                <Button
                                    onClick={handleAddRow}
                                    variant="primary"
                                    size="md"
                                    className="md:size-lg flex-1"
                                    fullWidth
                                >
                                    수정 저장
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={handleAddRow}
                                variant="primary"
                                size="md"
                                className="md:size-lg"
                                fullWidth
                            >
                                추가
                            </Button>
                        )}
                    </div>

                    {/* 우측 하단: 표 */}
                    <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg min-h-0">
                        {expenses.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-left">
                                                날짜
                                            </th>
                                            <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-left">
                                                분류
                                            </th>
                                            <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-left">
                                                상세내용
                                            </th>
                                            <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-left">
                                                금액
                                            </th>
                                            <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-center">
                                                삭제
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenses.map((expense) => (
                                            <tr 
                                                key={expense.id} 
                                                className={`hover:bg-gray-50 cursor-pointer ${editingExpenseId === expense.id ? 'bg-blue-50' : ''}`}
                                                onClick={() => handleRowClick(expense)}
                                            >
                                                <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                                    {formatDate(expense.date)}
                                                </td>
                                                <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                                    {expense.type}
                                                </td>
                                                <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                                    {expense.detail}
                                                </td>
                                                <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                                    {formatCurrency(expense.amount)}{expense.currency || "원"}
                                                </td>
                                                <td className="border border-gray-200 px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleDeleteRow(expense.id)}
                                                        className="w-6 h-6 rounded-full border border-red-400 text-red-400 text-[11px] hover:bg-red-50 transition-colors"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p>추가된 지출 내역이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* PC 화면에서 영수증 인덱스 표시 (모달 최하단) */}
            {allReceipts.length > 1 && (
                <div className="hidden md:flex justify-center mt-4">
                    <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                        {currentReceiptIndex + 1} / {allReceipts.length}
                    </div>
                </div>
            )}
            </>
            )}
        </BaseModal>
    );
}
