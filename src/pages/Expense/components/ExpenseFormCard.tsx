import React from "react";
import {
    IconCard,
    IconUpload,
    IconCalendar,
} from "../../../components/icons/Icons";
import DatePicker from "../../../components/ui/DatePicker";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Button from "../../../components/common/Button";
import SectionCard from "../../../components/ui/SectionCard";

export default function ExpenseFormCard({
    onAdd,
    initialDate,
}: {
    onAdd?: (item: any) => void;
    initialDate?: string;
}) {
    const [date, setDate] = React.useState(initialDate || "");
    React.useEffect(() => {
        if (initialDate) setDate(initialDate);
    }, [initialDate]);
    const [type, setType] = React.useState("");
    const [amount, setAmount] = React.useState("");
    const [detail, setDetail] = React.useState("");
    const [preview, setPreview] = React.useState<string | null>(null);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const fileRef = React.useRef<HTMLInputElement | null>(null);
    const [errors, setErrors] = React.useState<{
        date?: string;
        type?: string;
        amount?: string;
    }>({});

    const handleAdd = () => {
        const newErrors: typeof errors = {};

        if (!date || date.trim() === "") {
            newErrors.date = "날짜를 입력해주세요.";
        }
        if (!type || type.trim() === "") {
            newErrors.type = "유형을 선택해주세요.";
        }
        if (!amount || amount.trim() === "" || isNaN(Number(amount)) || Number(amount) <= 0) {
            newErrors.amount = "올바른 금액을 입력해주세요.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        if (onAdd) {
            onAdd({
                id: Date.now(),
                date,
                type,
                amount,
                detail,
                img: preview,
                file: selectedFile, // 파일 객체 전달
            });
            // Reset form
            setDate(initialDate || "");
            setType("");
            setAmount("");
            setDetail("");
            setPreview(null);
            setSelectedFile(null);
            if (fileRef.current) {
                fileRef.current.value = "";
            }
        }
    };

    return (
        <SectionCard
            title={
                <span className="flex items-center gap-2 text-gray-900">
                    <IconCard />
                    개인 카드/현금 지출 내역
                </span>
            }
            className="h-full border-gray-200"
        >
            <div className="flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-6">
                    <div>
                    <DatePicker
                        label="날짜"
                        value={date}
                            onChange={(value) => {
                                setDate(value);
                                if (errors.date) {
                                    setErrors((prev) => ({ ...prev, date: undefined }));
                                }
                            }}
                        placeholder="연도. 월. 일"
                        icon={<IconCalendar className="w-6 h-6" />}
                        iconPosition="right"
                    />
                        {errors.date && (
                            <p className="text-red-500 text-xs mt-1">{errors.date}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <Select
                                label="유형"
                                fullWidth
                                placeholder="유형 선택"
                                options={[
                                    { value: "주유", label: "주유" },
                                    { value: "통행료", label: "통행료" },
                                    { value: "식비", label: "식비" },
                                    { value: "자재구매", label: "자재구매" },
                                    { value: "기타", label: "기타" },
                                ]}
                                value={type}
                                onChange={(value) => {
                                    setType(value);
                                    if (errors.type) {
                                        setErrors((prev) => ({ ...prev, type: undefined }));
                                    }
                                }}
                            />
                            {errors.type && (
                                <p className="text-red-500 text-xs mt-1">{errors.type}</p>
                            )}
                        </div>

                        <div>
                            <Input
                                label="금액(원)"
                                value={amount}
                                onChange={(value) => {
                                    setAmount(value);
                                    if (errors.amount) {
                                        setErrors((prev) => ({ ...prev, amount: undefined }));
                                    }
                                }}
                                placeholder="예) 26000"
                            />
                            {errors.amount && (
                                <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <Input
                            label="상세내역"
                            value={detail}
                            onChange={setDetail}
                            placeholder="상세내역"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-600 mb-2 block">
                            영수증 첨부
                        </label>
                        <div
                            className="mt-2 border-dashed border-2 border-gray-200 rounded-xl p-6 text-center text-sm flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gray-300 transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="preview"
                                    className="w-20 h-20 object-cover rounded"
                                />
                            ) : (
                                <>
                                    <IconUpload className="w-8 h-8 text-gray-400" />
                                    <div className="text-gray-400">
                                        파일 업로드
                                    </div>
                                    <div className="text-xs text-gray-300">
                                        Maximum 300 MB file size
                                    </div>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                if (f) {
                                    const url = URL.createObjectURL(f);
                                    setPreview(url);
                                    setSelectedFile(f);
                                } else {
                                    setPreview(null);
                                    setSelectedFile(null);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div>
                <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={handleAdd}
                >
                    추가
                </Button>
            </div>
        </SectionCard>
    );
}
