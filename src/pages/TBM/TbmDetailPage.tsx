// TbmDetailPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { IconArrowBack, IconDownload } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { getTbmDetail, signTbm, TbmParticipant, TbmRecord } from "../../lib/tbmApi";
import { useUser } from "../../hooks/useUser";
import TbmDetailSkeleton from "../../components/common/skeletons/TbmDetailSkeleton";
import TbmDetailSheet from "../../components/tbm/TbmDetailSheet";
import { generateTbmPdf } from "../../lib/pdfUtils";
import { supabase } from "../../lib/supabase";

export default function TbmDetailPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();
    const { showError, showSuccess } = useToast();
    const { currentUserId } = useUser();
    const [loading, setLoading] = useState(true);
    const [tbm, setTbm] = useState<TbmRecord | null>(null);
    const [participants, setParticipants] = useState<TbmParticipant[]>([]);
    const [signing, setSigning] = useState(false);
    const [signatureUrls, setSignatureUrls] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await getTbmDetail(id);
                setTbm(data.tbm);
                setParticipants(data.participants);

                // 서명 완료된 참가자들의 서명 이미지 URL 미리 로드
                const signedUserIds = data.participants
                    .filter((p) => p.user_id && p.signed_at)
                    .map((p) => p.user_id!);

                if (signedUserIds.length > 0) {
                    const { data: profiles, error } = await supabase
                        .from("profiles")
                        .select("id, signature_bucket, signature_path")
                        .in("id", signedUserIds);

                    if (!error && profiles) {
                        const urlMap = new Map<string, string>();

                        // 병렬로 URL 생성
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
                                urlMap.set(result.userId, result.url);
                            }
                        });

                        setSignatureUrls(urlMap);
                    }
                }
            } catch (e: any) {
                showError(e?.message || "TBM을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, showError]);


    const handleSign = async (participant: TbmParticipant) => {
        if (!id || !currentUserId) return;
        if (participant.user_id !== currentUserId) return;
        if (participant.signed_at) return;
        if (signing) return; // ✅ 이미 서명 처리 중이면 무시

        try {
            setSigning(true); // ✅ 서명 시작
            await signTbm(id, currentUserId);

            setParticipants((prev) =>
                prev.map((p) =>
                    p.user_id === currentUserId
                        ? { ...p, signed_at: new Date().toISOString() }
                        : p
                )
            );

            // 서명 후 서명 이미지 URL 로드
            if (currentUserId) {
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("id, signature_bucket, signature_path")
                    .eq("id", currentUserId)
                    .single();

                if (!error && profile?.signature_bucket && profile?.signature_path) {
                    try {
                        const { data, error: urlError } = await supabase.storage
                            .from(profile.signature_bucket)
                            .createSignedUrl(profile.signature_path, 60 * 60);

                        if (!urlError && data) {
                            setSignatureUrls((prev) => new Map(prev).set(currentUserId, data.signedUrl));
                        } else {
                            const { data: publicData } = supabase.storage
                                .from(profile.signature_bucket)
                                .getPublicUrl(profile.signature_path);
                            setSignatureUrls((prev) => new Map(prev).set(currentUserId, publicData.publicUrl));
                        }
                    } catch (e) {
                        console.error("서명 이미지 URL 로드 실패:", e);
                    }
                }
            }

            showSuccess("서명 처리되었습니다.");
        } catch (e: any) {
            showError(e?.message || "서명 처리에 실패했습니다.");
        } finally {
            setSigning(false); // ✅ 성공/실패 상관없이 해제
        }
    };


    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="TBM 상세"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <button
                            onClick={() => navigate("/tbm")}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="목록으로 돌아가기"
                        >
                            <IconArrowBack />
                        </button>
                    }
                    rightContent={
                        id ? (
                            <Button
                                variant="primary"
                                size="md"
                                className="h-8! px-2! text-sm! md:h-12! md:px-4! md:text-base!"
                                icon={<IconDownload />}
                                onClick={() =>
                                    generateTbmPdf({
                                        tbmId: id,
                                        onError: showError,
                                    })
                                }
                            >
                                <span className="hidden sm:inline">PDF 저장</span>
                                <span className="sm:hidden">PDF</span>
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24">
                    {loading || !tbm ? (
                        <TbmDetailSkeleton />
                    ) : (
                        <div className="max-w-[900px] mx-auto">
                            <TbmDetailSheet
                                tbm={tbm}
                                participants={participants}
                                variant="screen"
                                currentUserId={currentUserId}
                                onSign={handleSign}
                                signatureUrls={signatureUrls}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
