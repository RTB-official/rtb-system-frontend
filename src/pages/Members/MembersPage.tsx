import { useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import Header from "../../components/common/Header";
import Tabs from "../../components/common/Tabs";
import ActionMenu from "../../components/common/ActionMenu";
import AddMemberModal from "../../components/modals/AddMemberModal";
import ResetPasswordModal from "../../components/modals/ResetPasswordModal";
import PageContainer from "../../components/common/PageContainer";
import MembersSkeleton from "../../components/common/skeletons/MembersSkeleton";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { uploadPassportPhoto, uploadProfilePhoto } from "../../lib/memberFilesApi";
import { useMembersData } from "./useMembersData";
import { getFilteredMembers, getMembersByRole } from "./membersListUtils";
import { normalizeDateToISO } from "./utils";
import type { MembersTab } from "./types";
import MembersMobileList from "./MembersMobileList";
import MembersMobileDetailSheet from "./MembersMobileDetailSheet";
import MembersTableDesktop from "./MembersTableDesktop";

export default function MembersPage() {
    const { showSuccess, showError } = useToast();
    const {
        members,
        loading,
        loadError,
        roleReady,
        isAdmin,
        isStaff,
        myUserId,
        fetchMembers,
        downloadStorageFile,
        deleteStorageFile,
    } = useMembersData();

    const [activeTab, setActiveTab] = useState<MembersTab>("ALL");
    const [page, setPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [actionOpen, setActionOpen] = useState(false);
    const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    const PAGE_SIZE = isStaff ? 14 : 10;
    const filteredMembers = useMemo(
        () => getFilteredMembers(members, activeTab, myUserId),
        [members, activeTab, myUserId]
    );
    const membersByRole = useMemo(
        () => getMembersByRole(filteredMembers, myUserId),
        [filteredMembers, myUserId]
    );
    const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    const pagedMembers = useMemo(
        () => filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filteredMembers, page, PAGE_SIZE]
    );
    const selectedMember = useMemo(
        () => members.find((m) => m.id === selectedMemberId) ?? null,
        [members, selectedMemberId]
    );

    const totalCount = members.length;
    const adminCount = members.filter((m) => m.team === "공무팀").length;
    const staffCount = members.filter((m) => m.team === "공사팀").length;

    const isLoading = !roleReady || (loading && members.length === 0);

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header title="구성원 관리" onMenuClick={() => setSidebarOpen(true)} />
                <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
                    <PageContainer className="py-4 md:py-9">
                        {loadError && (
                            <div className="mb-3 text-sm text-red-600">profiles 조회 실패: {loadError}</div>
                        )}
                        <div className="mb-4">
                            <Tabs
                                items={[
                                    { value: "ALL", label: `전체 ${totalCount}` },
                                    { value: "ADMIN", label: `공무팀 ${adminCount}` },
                                    { value: "STAFF", label: `공사팀 ${staffCount}` },
                                ]}
                                value={activeTab}
                                onChange={(v) => {
                                    setActiveTab(v as MembersTab);
                                    setPage(1);
                                }}
                            />
                        </div>

                        {isLoading ? (
                            <>
                                <div className="md:hidden flex flex-col items-center justify-center min-h-[50vh] gap-4">
                                    <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                                    <p className="text-[14px] text-gray-500">로딩중</p>
                                </div>
                                <div className="hidden md:block">
                                    <MembersSkeleton />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="md:hidden">
                                    <MembersMobileList
                                        sections={membersByRole}
                                        onMemberClick={(member) => {
                                            setSelectedMemberId(member.id);
                                            setMobileDetailOpen(true);
                                        }}
                                    />
                                </div>

                                {mobileDetailOpen && selectedMember && (
                                    <MembersMobileDetailSheet
                                        member={selectedMember}
                                        onClose={() => setMobileDetailOpen(false)}
                                        onEdit={() => {
                                            setMobileDetailOpen(false);
                                            setEditModalOpen(true);
                                        }}
                                        onResetPassword={() => {
                                            setMobileDetailOpen(false);
                                            setResetPasswordModalOpen(true);
                                        }}
                                        onDelete={() => {
                                            setMobileDetailOpen(false);
                                            setDeleteConfirmOpen(true);
                                        }}
                                        isAdmin={isAdmin}
                                        myUserId={myUserId}
                                        isStaff={isStaff}
                                        downloadStorageFile={downloadStorageFile}
                                        showError={showError}
                                    />
                                )}

                                <MembersTableDesktop
                                    data={pagedMembers}
                                    page={page}
                                    pageCount={pageCount}
                                    onPageChange={setPage}
                                    isAdmin={isAdmin}
                                    myUserId={myUserId}
                                    isStaff={isStaff}
                                    downloadStorageFile={downloadStorageFile}
                                    showError={showError}
                                    setSelectedMemberId={setSelectedMemberId}
                                    setActionAnchor={setActionAnchor}
                                    setActionOpen={setActionOpen}
                                />
                            </>
                        )}
                        <div className="h-8" />
                    </PageContainer>
                </div>
            </div>

            <AddMemberModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                member={selectedMember}
                onSubmit={async (payload) => {
                    if (!selectedMemberId || !selectedMember) return;
                    if (!isAdmin && selectedMemberId !== myUserId) {
                        showError("본인 계정만 수정할 수 있습니다.");
                        return;
                    }
                    const domain = selectedMember.email?.split("@")[1] || "rtb-kor.com";
                    const localPart = (payload.emailPrefix || "").split("@")[0].trim();
                    const nextEmail = localPart ? `${localPart}@${domain}` : selectedMember.email || "";
                    const joinISO = normalizeDateToISO(payload.joinDate);
                    const birthISO = normalizeDateToISO(payload.birthDate);
                    const passportExpiryISO = normalizeDateToISO(payload.passportExpiry);

                    const { error } = await supabase
                        .from("profiles")
                        .update({
                            join_date: joinISO,
                            birth_date: birthISO,
                            email: nextEmail,
                            phone_number: payload.phone,
                            address: payload.address,
                            department: payload.team,
                            position: payload.position,
                        })
                        .eq("id", selectedMemberId);

                    if (error) {
                        showError("구성원 정보 수정에 실패했습니다.");
                        return;
                    }
                    if (payload.profilePhotoFile) {
                        try {
                            const prevBucket = selectedMember.profilePhotoBucket;
                            const prevPath = selectedMember.profilePhotoPath;
                            const uploaded = await uploadProfilePhoto(selectedMemberId, payload.profilePhotoFile);
                            await supabase
                                .from("profiles")
                                .update({
                                    profile_photo_bucket: uploaded.bucket,
                                    profile_photo_path: uploaded.path,
                                    profile_photo_name: uploaded.name,
                                })
                                .eq("id", selectedMemberId);
                            if (prevBucket && prevPath && (prevBucket !== uploaded.bucket || prevPath !== uploaded.path)) {
                                await deleteStorageFile(prevBucket, prevPath);
                            }
                        } catch (e: any) {
                            showError(e?.message || "증명사진 업로드에 실패했습니다.");
                        }
                    }
                    const { error: ppError } = await supabase.from("profile_passports").upsert(
                        {
                            user_id: selectedMemberId,
                            passport_last_name: payload.passportLastName,
                            passport_first_name: payload.passportFirstName,
                            passport_number: payload.passportNo,
                            passport_expiry_date: passportExpiryISO,
                        },
                        { onConflict: "user_id" }
                    );
                    if (ppError) {
                        showError("여권정보 저장에 실패했습니다.");
                        return;
                    }
                    if (payload.passportPhotoFile) {
                        try {
                            const prevBucket = selectedMember.passportPhotoBucket;
                            const prevPath = selectedMember.passportPhotoPath;
                            const uploaded = await uploadPassportPhoto(selectedMemberId, payload.passportPhotoFile);
                            await supabase.from("profile_passports").upsert(
                                {
                                    user_id: selectedMemberId,
                                    passport_image_bucket: uploaded.bucket,
                                    passport_image_path: uploaded.path,
                                    passport_image_name: uploaded.name,
                                },
                                { onConflict: "user_id" }
                            );
                            if (prevBucket && prevPath && (prevBucket !== uploaded.bucket || prevPath !== uploaded.path)) {
                                await deleteStorageFile(prevBucket, prevPath);
                            }
                        } catch (e: any) {
                            showError(e?.message || "여권사진 업로드에 실패했습니다.");
                        }
                    }
                    showSuccess("구성원 정보가 수정되었습니다.");
                    setEditModalOpen(false);
                    await fetchMembers();
                }}
            />

            <ActionMenu
                isOpen={actionOpen}
                anchorEl={actionAnchor}
                onClose={() => { setActionOpen(false); setActionAnchor(null); }}
                onEdit={() => {
                    if (!isAdmin && selectedMemberId !== myUserId) return;
                    setActionOpen(false);
                    setEditModalOpen(true);
                }}
                onResetPassword={() => {
                    if (!isAdmin && selectedMemberId !== myUserId) return;
                    setActionOpen(false);
                    setResetPasswordModalOpen(true);
                }}
                onDelete={isAdmin ? () => { if (selectedMemberId) setDeleteConfirmOpen(true); } : undefined}
                showDelete={isAdmin}
                width="w-44"
            />

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={async () => {
                    if (!selectedMemberId) return;
                    setDeleteConfirmOpen(false);
                    const { error } = await supabase.from("profiles").delete().eq("id", selectedMemberId);
                    if (error) {
                        showError("삭제에 실패했습니다.");
                        return;
                    }
                    showSuccess("삭제 완료");
                    setActionOpen(false);
                    setActionAnchor(null);
                    await fetchMembers();
                }}
                title="구성원 삭제"
                message="정말 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
            />

            <ResetPasswordModal
                isOpen={resetPasswordModalOpen}
                memberName={selectedMember?.name}
                onClose={() => setResetPasswordModalOpen(false)}
                onSubmit={async (payload) => {
                    if (!selectedMemberId) return false;
                    if (!isAdmin && selectedMemberId !== myUserId) {
                        showError("본인 비밀번호만 변경할 수 있습니다.");
                        return false;
                    }
                    if (selectedMemberId === myUserId) {
                        const { error } = await supabase.auth.updateUser({ password: payload.newPassword });
                        if (error) {
                            showError("비밀번호 변경에 실패했습니다.");
                            return false;
                        }
                        showSuccess("비밀번호가 변경되었습니다.");
                        return true;
                    }
                    if (isAdmin && selectedMemberId !== myUserId) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.access_token) {
                            showError("로그인 정보가 없습니다.");
                            return false;
                        }
                        if (payload.newPassword.length < 6) {
                            showError("비밀번호는 최소 6자 이상이어야 합니다.");
                            return false;
                        }
                        const { error } = await supabase.functions.invoke("admin-reset-password", {
                            body: { userId: selectedMemberId, newPassword: payload.newPassword },
                            headers: { Authorization: `Bearer ${session.access_token}` },
                        });
                        if (error) {
                            showError(error?.message || "비밀번호 재설정에 실패했습니다.");
                            return false;
                        }
                        showSuccess("비밀번호가 재설정되었습니다.");
                        return true;
                    }
                    return false;
                }}
            />
        </div>
    );
}
