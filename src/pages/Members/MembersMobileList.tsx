import Avatar from "../../components/common/Avatar";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import { IconChevronRight } from "../../components/icons/Icons";
import type { Member, MemberSection } from "./types";

interface MembersMobileListProps {
    sections: MemberSection[];
    onMemberClick: (member: Member) => void;
}

export default function MembersMobileList({ sections, onMemberClick }: MembersMobileListProps) {
    if (sections.length === 0) {
        return (
            <div className="py-10 text-center text-gray-500 text-sm">
                등록된 구성원이 없습니다.
            </div>
        );
    }
    return (
        <div className="pb-6">
            {sections.map(({ role, members: sectionMembers }) => (
                <section key={role} className="mb-6">
                    <h3 className="text-[13px] font-medium text-gray-500 px-1 mb-2">{role}</h3>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                        {sectionMembers.map((row) => (
                            <li key={row.id}>
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 py-3 px-3 text-left"
                                    onClick={() => onMemberClick(row)}
                                >
                                    <Avatar email={row.avatarEmail} size={40} position={row.role} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[15px] font-semibold text-gray-900">
                                            {row.name || <EmptyValueIndicator />}
                                        </div>
                                        <div className="text-[13px] text-gray-500 mt-0.5">
                                            {row.phone || "—"}
                                        </div>
                                    </div>
                                    <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
