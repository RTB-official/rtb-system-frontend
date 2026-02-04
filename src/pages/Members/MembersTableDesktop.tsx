import Table from "../../components/common/Table";
import { getMembersTableColumns, type MembersTableColumnOpts } from "./getMembersTableColumns";
import type { Member } from "./types";

interface MembersTableDesktopProps extends MembersTableColumnOpts {
    data: Member[];
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}

export default function MembersTableDesktop({
    data,
    page,
    pageCount,
    onPageChange,
    ...columnOpts
}: MembersTableDesktopProps) {
    return (
        <div className="hidden md:block overflow-x-auto w-full">
            <Table<Member>
                columns={getMembersTableColumns(columnOpts)}
                data={data}
                rowKey="id"
                emptyText="등록된 구성원이 없습니다."
                pagination={{
                    currentPage: page,
                    totalPages: pageCount,
                    onPageChange,
                }}
            />
        </div>
    );
}
