// src/pages/TBM/TbmPdfPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../components/common/Button";
import { IconDownload } from "../../components/icons/Icons";
import { getTbmDetail, TbmParticipant, TbmRecord } from "../../lib/tbmApi";
import TbmDetailSheet from "../../components/tbm/TbmDetailSheet";

export default function TbmPdfPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const autoDownload = searchParams.get("download") === "1";
    const [loading, setLoading] = useState(true);
    const [tbm, setTbm] = useState<TbmRecord | null>(null);
    const [participants, setParticipants] = useState<TbmParticipant[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError("TBM ID가 필요합니다.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        getTbmDetail(id)
            .then(({ tbm, participants }) => {
                setTbm(tbm);
                setParticipants(participants);
            })
            .catch((e: any) => {
                setError(e?.message || "TBM 정보를 불러오지 못했습니다.");
            })
            .finally(() => setLoading(false));
    }, [id]);

    const printPdf = () => {
        window.print();
    };

    useEffect(() => {
        if (!autoDownload) return;
        if (loading || !tbm) return;
        const timer = setTimeout(() => {
            window.print();
            setTimeout(() => window.close(), 300);
        }, 200);
        return () => clearTimeout(timer);
    }, [autoDownload, loading, tbm]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
                <p className="text-sm text-gray-600">PDF를 준비 중입니다…</p>
            </div>
        );
    }

    if (error || !tbm) {
        return (
            <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
                <div className="bg-white px-6 py-4 rounded-xl shadow-md">
                    <p className="text-sm text-red-600">{error || "TBM을 찾을 수 없습니다."}</p>
                    <button
                        onClick={() => navigate("/tbm")}
                        className="mt-3 text-sm text-blue-600 underline"
                    >
                        TBM 목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f6fb] pb-10">
            <div className="max-w-[920px] mx-auto text-gray-900">
                {!autoDownload && (
                    <div className="flex justify-end pt-6 px-4">
                        <Button
                            variant="primary"
                            size="md"
                            icon={<IconDownload />}
                            onClick={printPdf}
                        >
                            PDF로 저장
                        </Button>
                    </div>
                )}
                <div className="mt-4 mx-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] rounded-lg print:shadow-none print:mx-0 print:mt-0">
                    <TbmDetailSheet
                        tbm={tbm}
                        participants={participants}
                        variant="pdf"
                    />
                </div>
            </div>
        </div>
    );
}
