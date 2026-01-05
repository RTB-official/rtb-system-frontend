import React from "react";
import {
    IconCardAlt,
    IconUpload,
    IconCalendar,
} from "../../../components/icons/Icons";
import DatePickerPanel from "../../../components/DatePickerPanel";
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
    const hiddenDateRef = React.useRef<HTMLInputElement | null>(null);
    const [showPicker, setShowPicker] = React.useState(false);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const [type, setType] = React.useState("");
    const [amount, setAmount] = React.useState("");
    const [detail, setDetail] = React.useState("");
    const [preview, setPreview] = React.useState<string | null>(null);
    const fileRef = React.useRef<HTMLInputElement | null>(null);

    const handleAdd = () => {
        if (onAdd) {
            onAdd({
                id: Date.now(),
                date,
                type,
                amount,
                detail,
                img: preview,
            });
            // Reset form
            setType("");
            setAmount("");
            setDetail("");
            setPreview(null);
        }
    };

    return (
        <SectionCard
            title={
                <span className="flex items-center gap-2 text-gray-900">
                    <IconCardAlt />
                    개인 카드/현금 지출내역
                </span>
            }
            className="h-full shadow-[0_24px_60px_rgba(15,23,42,0.08)] border-gray-100"
        >
            <div className="flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-6">
                    <div>
                        <Input
                            label="날짜"
                            value={date}
                            onChange={setDate}
                            placeholder="연도. 월. 일"
                            icon={<IconCalendar className="w-6 h-6" />}
                            iconPosition="right"
                            onClick={() => setShowPicker((s) => !s)}
                        />
                        <input
                            ref={hiddenDateRef}
                            type="date"
                            onChange={(e) => setDate(e.target.value)}
                            style={{
                                position: "absolute",
                                left: "-9999px",
                                width: 1,
                                height: 1,
                                opacity: 0,
                            }}
                        />
                        {showPicker && (
                            <div
                                ref={wrapperRef}
                                className="absolute z-40 right-0 mt-2"
                            >
                                <DatePickerPanel
                                    selected={date || null}
                                    onSelect={(d) => {
                                        setDate(d);
                                        setShowPicker(false);
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Select
                                label="유형"
                                options={[
                                    { value: "", label: "유형 선택" },
                                    { value: "교통비", label: "교통비" },
                                    { value: "식대", label: "식대" },
                                ]}
                                value={type}
                                onChange={setType}
                            />
                        </div>

                        <div>
                            <Input
                                label="금액(원)"
                                value={amount}
                                onChange={setAmount}
                                placeholder="예) 26000"
                            />
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
                                } else {
                                    setPreview(null);
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
