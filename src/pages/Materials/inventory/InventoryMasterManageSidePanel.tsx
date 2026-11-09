import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import {
    IconArrowDown,
    IconArrowUp,
    IconChevronLeft,
    IconChevronRight,
    IconClose,
    IconEdit,
    IconPlus,
} from "../../../components/icons/Icons";
import { useToast } from "../../../components/ui/ToastProvider";
import {
    INVENTORY_CATEGORY_MAX_DEPTH,
    INVENTORY_FORM_CONFIG_MIN_DEPTH,
    createInventoryCategory,
    createInventoryLocation,
    deleteInventoryCategory,
    deleteInventoryLocation,
    getInventoryCategoryDescendantIds,
    moveInventoryCategory,
    updateInventoryCategoryName,
    type InventoryCategory,
    type InventoryLocation,
} from "../../../lib/inventoryApi";
import InventoryCategoryFieldsSidePanel from "./InventoryCategoryFieldsSidePanel";

type MasterKind = "category" | "location";

type CategoryTreeNode = {
    id: string;
    name: string;
    pathLabel: string;
    depth: number;
    count: number;
    childCount: number;
    children: CategoryTreeNode[];
};

interface InventoryMasterManageSidePanelProps {
    kind: MasterKind | null;
    categories: InventoryCategory[];
    locations: InventoryLocation[];
    itemCountByCategoryId: Map<string, number>;
    itemCountByLocationId: Map<string, number>;
    onClose: () => void;
    onChanged: () => void;
}

/** 카드 고정 높이 — 가로 연결선 Y를 부모/자식 모두 동일하게 */
const ORG_CARD_HEIGHT = 52;
const ORG_CARD_ELBOW = ORG_CARD_HEIGHT / 2;
const ORG_GUTTER = 20; // 카드 ↔ 자식 열 간격(가로선 길이)

/** 노드 자신 + 모든 하위 id (펼침 시 하위 전체 열기용) */
function collectSubtreeIds(node: CategoryTreeNode): string[] {
    return [node.id, ...node.children.flatMap(collectSubtreeIds)];
}

function CategoryOrgNode({
    node,
    busy,
    editMode,
    selectedNodeId,
    onActivateNode,
    siblingIndex,
    siblingCount,
    onMove,
    addingParentId,
    draftName,
    onDraftNameChange,
    onStartAdd,
    onCancelAdd,
    onConfirmAdd,
    onDelete,
    onRename,
    expandedIds,
    onExpandNode,
    onCollapseNode,
}: {
    node: CategoryTreeNode;
    busy: boolean;
    editMode: boolean;
    selectedNodeId: string | null;
    onActivateNode: (node: CategoryTreeNode | null) => void;
    siblingIndex: number;
    siblingCount: number;
    onMove: (nodeId: string, direction: "up" | "down") => void;
    addingParentId: string | null;
    draftName: string;
    onDraftNameChange: (value: string) => void;
    onStartAdd: (parentId: string) => void;
    onCancelAdd: () => void;
    onConfirmAdd: () => void;
    onDelete: (node: CategoryTreeNode) => void;
    onRename: (nodeId: string, name: string) => void;
    expandedIds: Set<string>;
    onExpandNode: (node: CategoryTreeNode, mode: "self" | "subtree") => void;
    onCollapseNode: (node: CategoryTreeNode) => void;
}) {
    const canMoveUp = siblingIndex > 0;
    const canMoveDown = siblingIndex < siblingCount - 1;
    const hasChildren = node.children.length > 0;
    const canAddChild = node.depth < INVENTORY_CATEGORY_MAX_DEPTH;
    const isAddingHere = addingParentId === node.id;
    const canToggle = hasChildren || canAddChild;
    const isSelected = selectedNodeId === node.id;
    const showEditControls = editMode && (isSelected || isAddingHere);
    const expanded = expandedIds.has(node.id);
    const [renameDraft, setRenameDraft] = useState(node.name);
    const renameSessionKey = editMode && isSelected ? node.id : null;
    const [appliedRenameSession, setAppliedRenameSession] = useState<string | null>(null);
    if (renameSessionKey !== appliedRenameSession) {
        setAppliedRenameSession(renameSessionKey);
        if (renameSessionKey) setRenameDraft(node.name);
    }

    const commitRename = () => {
        const next = renameDraft.trim();
        if (!next) {
            setRenameDraft(node.name);
            return;
        }
        if (next === node.name) return;
        onRename(node.id, next);
    };

    const toggleExpand = () => {
        if (!canToggle || busy) return;
        if (expanded) {
            if (isAddingHere) onCancelAdd();
            onCollapseNode(node);
            onActivateNode(null);
            return;
        }
        if (!hasChildren && canAddChild) {
            if (!editMode) {
                onExpandNode(node, "self");
                return;
            }
            onExpandNode(node, "self");
            onStartAdd(node.id);
            return; // 하위 추가 입력 중에는 선택 유지
        }
        // 펼치면 해당 카테고리의 하위 전체를 연다
        onExpandNode(node, "subtree");
        onActivateNode(null);
    };

    const showBranch = expanded && (hasChildren || isAddingHere);

    return (
        <div className="flex items-start">
            <div
                className="relative shrink-0"
                data-org-card
                data-org-node-id={node.id}
            >
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onActivateNode(isSelected ? null : node)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onActivateNode(isSelected ? null : node);
                        }
                    }}
                    style={{ height: ORG_CARD_HEIGHT }}
                    className={`rounded-xl border px-3 min-w-[120px] max-w-[160px] shadow-sm text-center flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                        isSelected
                            ? "border-gray-900 bg-gray-900 text-white shadow-md"
                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:shadow-md hover:bg-gray-50"
                    }`}
                >
                    {editMode && isSelected ? (
                        <input
                            value={renameDraft}
                            disabled={busy}
                            autoFocus
                            title="카테고리명 수정"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitRename()}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === "Escape") {
                                    e.preventDefault();
                                    setRenameDraft(node.name);
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            className="w-full bg-white/15 text-white placeholder:text-white/50 font-medium text-sm text-center rounded-md px-1 py-0.5 outline-none ring-1 ring-white/40 focus:ring-2 focus:ring-white/70"
                        />
                    ) : (
                        <>
                            <p
                                className={`font-medium text-sm truncate w-full ${
                                    isSelected ? "text-white" : "text-gray-900"
                                }`}
                                title={node.name}
                            >
                                {node.name}
                            </p>
                            <p
                                className={`text-[11px] leading-tight ${
                                    isSelected ? "text-white/70" : "text-gray-400"
                                }`}
                            >
                                자재 {node.count}개
                            </p>
                        </>
                    )}
                </div>

                {/* 좌측: 위/아래 순서 변경 — 수정 모드 + 선택 시 */}
                <div
                    className={`absolute right-full top-0 bottom-0 mr-1 flex flex-col justify-center gap-0.5 z-20 transition-opacity ${
                        showEditControls
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                    }`}
                >
                    <button
                        type="button"
                        title="위로"
                        disabled={busy || !canMoveUp}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMove(node.id, "up");
                        }}
                        className="h-6 w-6 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700 flex items-center justify-center"
                    >
                        <IconArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        title="아래로"
                        disabled={busy || !canMoveDown}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMove(node.id, "down");
                        }}
                        className="h-6 w-6 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700 flex items-center justify-center"
                    >
                        <IconArrowDown className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* 펼침/접기 — 조회 모드에서도 가능 */}
                {isSelected && canToggle && (
                    <button
                        type="button"
                        title={expanded ? "접기" : "펼치기"}
                        disabled={busy}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand();
                        }}
                        className={`absolute inset-y-0 right-0 w-8 flex items-center justify-center rounded-r-xl disabled:opacity-50 z-10 animate-[fadeSlideIn_200ms_ease-out] ${
                            isSelected && editMode
                                ? "text-white hover:bg-white/10"
                                : "text-gray-800 hover:bg-black/5"
                        }`}
                    >
                        {expanded ? (
                            <IconChevronLeft className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                            <IconChevronRight className="w-5 h-5 stroke-[2.5]" />
                        )}
                    </button>
                )}

                {/* 추가/삭제 — 수정 모드 + 선택 시 */}
                <div
                    className={`absolute left-full top-0 bottom-0 ml-1 flex flex-col justify-center gap-0.5 z-20 transition-opacity ${
                        showEditControls
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                    }`}
                >
                    {canAddChild && (
                        <button
                            type="button"
                            title="하위 카테고리 추가"
                            disabled={busy}
                            onClick={() => {
                                onExpandNode(node, "self");
                                onStartAdd(node.id);
                            }}
                            className="h-6 w-6 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 flex items-center justify-center"
                        >
                            <IconPlus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        title="삭제"
                        disabled={busy}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node);
                        }}
                        className="h-6 w-6 rounded-full border border-red-200 bg-white text-red-500 shadow-sm hover:border-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50 flex items-center justify-center"
                    >
                        <IconClose className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* 부모 카드 세로 중앙에서 나가는 가로선 (자식 엘보와 동일 Y) */}
                {showBranch && (
                    <div
                        className="absolute left-full h-px bg-gray-300 pointer-events-none"
                        style={{ top: ORG_CARD_ELBOW, width: ORG_GUTTER }}
                        aria-hidden
                    />
                )}
            </div>

            {showBranch && (
                <div
                    className="flex flex-col animate-[fadeSlideIn_400ms_ease-out]"
                    style={{ marginLeft: ORG_GUTTER }}
                >
                    {isAddingHere && editMode && (
                        <OrgBranchRow
                            isFirst
                            isLast={node.children.length === 0}
                            showSpine={node.children.length > 0}
                        >
                            <div
                                className="flex items-center gap-1.5 shrink-0"
                                style={{ height: ORG_CARD_HEIGHT }}
                            >
                                <Input
                                    value={draftName}
                                    onChange={onDraftNameChange}
                                    placeholder="하위 카테고리명"
                                    className="w-[140px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            onConfirmAdd();
                                        }
                                        if (e.key === "Escape") {
                                            e.preventDefault();
                                            onCancelAdd();
                                        }
                                    }}
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={busy || !draftName.trim()}
                                    onClick={onConfirmAdd}
                                >
                                    추가
                                </Button>
                                <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-700 px-1"
                                    disabled={busy}
                                    onClick={onCancelAdd}
                                >
                                    취소
                                </button>
                            </div>
                        </OrgBranchRow>
                    )}
                    {node.children.map((child, index) => {
                        const branchCount =
                            node.children.length + (isAddingHere && editMode ? 1 : 0);
                        const rowIndex = index + (isAddingHere && editMode ? 1 : 0);
                        return (
                            <OrgBranchRow
                                key={child.id}
                                isFirst={rowIndex === 0}
                                isLast={rowIndex === branchCount - 1}
                                showSpine={branchCount > 1}
                            >
                                <div
                                    style={{
                                        animation: `fadeSlideIn 400ms ease-out ${index * 32}ms both`,
                                    }}
                                >
                                    <CategoryOrgNode
                                        node={child}
                                        busy={busy}
                                        editMode={editMode}
                                        selectedNodeId={selectedNodeId}
                                        onActivateNode={onActivateNode}
                                        siblingIndex={index}
                                        siblingCount={node.children.length}
                                        onMove={onMove}
                                        addingParentId={addingParentId}
                                        draftName={draftName}
                                        onDraftNameChange={onDraftNameChange}
                                        onStartAdd={onStartAdd}
                                        onCancelAdd={onCancelAdd}
                                        onConfirmAdd={onConfirmAdd}
                                        onDelete={onDelete}
                                        onRename={onRename}
                                        expandedIds={expandedIds}
                                        onExpandNode={onExpandNode}
                                        onCollapseNode={onCollapseNode}
                                    />
                                </div>
                            </OrgBranchRow>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/**
 * 자식 행별 연결선.
 * 가로: 카드 중앙 / 세로: 행 전체 높이를 채워 형제 사이가 끊기지 않게.
 */
function OrgBranchRow({
    isFirst,
    isLast,
    showSpine,
    children,
}: {
    isFirst: boolean;
    isLast: boolean;
    showSpine: boolean;
    children: ReactNode;
}) {
    return (
        <div className={`relative ${isLast ? "" : "pb-3"}`}>
            <div
                className="absolute left-0 top-0 bottom-0 pointer-events-none"
                style={{ width: ORG_GUTTER }}
                aria-hidden
            >
                {showSpine &&
                    (isFirst && isLast ? null : isFirst ? (
                        <div
                            className="absolute left-0 w-px bg-gray-300"
                            style={{ top: ORG_CARD_ELBOW, bottom: 0 }}
                        />
                    ) : isLast ? (
                        <div
                            className="absolute left-0 top-0 w-px bg-gray-300"
                            style={{ height: ORG_CARD_ELBOW }}
                        />
                    ) : (
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300" />
                    ))}
                <div
                    className="absolute left-0 right-0 h-px bg-gray-300"
                    style={{ top: ORG_CARD_ELBOW }}
                />
            </div>
            <div className="min-w-0" style={{ paddingLeft: ORG_GUTTER }}>
                {children}
            </div>
        </div>
    );
}

export default function InventoryMasterManageSidePanel({
    kind,
    categories,
    locations,
    itemCountByCategoryId,
    itemCountByLocationId,
    onClose,
    onChanged,
}: InventoryMasterManageSidePanelProps) {
    const { showError, showSuccess } = useToast();
    const [newName, setNewName] = useState("");
    const [busy, setBusy] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeRootId, setActiveRootId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
    const [addingParentId, setAddingParentId] = useState<string | null>(null);
    const chartScrollRef = useRef<HTMLDivElement>(null);
    const chartAreaRef = useRef<HTMLDivElement>(null);
    const [draftChildName, setDraftChildName] = useState("");
    const [addingRoot, setAddingRoot] = useState(false);
    const [draftRootName, setDraftRootName] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [fieldsCategoryId, setFieldsCategoryId] = useState<string | null>(null);
    const addRootPanelRef = useRef<HTMLDivElement>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
        childCount: number;
        itemCount: number;
    } | null>(null);

    const handleExpandNode = useCallback((node: CategoryTreeNode, mode: "self" | "subtree") => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (mode === "subtree") {
                for (const id of collectSubtreeIds(node)) next.add(id);
            } else {
                next.add(node.id);
            }
            return next;
        });
    }, []);

    const handleCollapseNode = useCallback((node: CategoryTreeNode) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            for (const id of collectSubtreeIds(node)) next.delete(id);
            return next;
        });
    }, []);

    const isOpen = kind != null;
    /** 닫힘 애니메이션 동안에도 마지막 kind로 내용 유지 */
    const [displayKind, setDisplayKind] = useState<MasterKind | null>(kind);
    if (kind != null && displayKind !== kind) {
        setDisplayKind(kind);
    }
    const effectiveKind = kind ?? displayKind;
    const title = effectiveKind === "category" ? "카테고리 상세" : "보관 위치 상세";
    const isCategory = effectiveKind === "category";

    const categoryTrees = useMemo(() => {
        const childrenMap = new Map<string | null, InventoryCategory[]>();
        for (const c of categories) {
            const key = c.parentId;
            const list = childrenMap.get(key) ?? [];
            list.push(c);
            childrenMap.set(key, list);
        }
        for (const list of childrenMap.values()) {
            list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));
        }

        const build = (
            cat: InventoryCategory,
            depth: number,
            prefix: string[]
        ): CategoryTreeNode => {
            const path = [...prefix, cat.name];
            const descendantIds = getInventoryCategoryDescendantIds(categories, cat.id);
            const count = descendantIds.reduce(
                (sum, id) => sum + (itemCountByCategoryId.get(id) ?? 0),
                0
            );
            const kids = childrenMap.get(cat.id) ?? [];
            return {
                id: cat.id,
                name: cat.name,
                pathLabel: path.join(" › "),
                depth,
                count,
                childCount: kids.length,
                children: kids.map((child) => build(child, depth + 1, path)),
            };
        };

        return (childrenMap.get(null) ?? []).map((root) => build(root, 1, []));
    }, [categories, itemCountByCategoryId]);

    const activeRoot = useMemo(
        () => categoryTrees.find((r) => r.id === activeRootId) ?? null,
        [categoryTrees, activeRootId]
    );

    const handleSelectRoot = useCallback(
        (root: CategoryTreeNode) => {
            if (activeRootId === root.id) {
                setActiveRootId(null);
                setExpandedIds(new Set());
                setSelectedNodeId(null);
                setFieldsCategoryId(null);
                setAddingParentId(null);
                setDraftChildName("");
                return;
            }
            setActiveRootId(root.id);
            setSelectedNodeId(null);
            setFieldsCategoryId(null);
            setAddingParentId(null);
            setDraftChildName("");
            setExpandedIds(new Set(collectSubtreeIds(root)));
            window.requestAnimationFrame(() => {
                if (chartAreaRef.current) chartAreaRef.current.scrollTop = 0;
                if (chartScrollRef.current) chartScrollRef.current.scrollLeft = 0;
            });
        },
        [activeRootId]
    );

    const handleActivateNode = useCallback((node: CategoryTreeNode | null) => {
        if (!node) {
            // 카드 밖 클릭: 2단 패널이 열려 있으면 카드 on 유지
            if (fieldsCategoryId != null) return;
            setSelectedNodeId(null);
            return;
        }
        // 4단계 이상 → 입력란·버튼 설정 패널 (하위는 상속)
        if (node.depth >= INVENTORY_FORM_CONFIG_MIN_DEPTH) {
            setSelectedNodeId(node.id);
            setFieldsCategoryId(node.id);
            return;
        }
        // 3단계 이하: 2단이 열려 있으면 해당 카드 on 유지
        if (fieldsCategoryId != null) return;
        setSelectedNodeId(node.id);
    }, [fieldsCategoryId]);

    const fieldsCategory = useMemo(
        () => categories.find((c) => c.id === fieldsCategoryId) ?? null,
        [categories, fieldsCategoryId]
    );

    /** 짧은 ease-out 스크롤 (native smooth보다 빠르게) */
    const animateScroll = useCallback(
        (
            el: HTMLElement,
            to: { top?: number; left?: number },
            durationMs = 400
        ) => {
            const fromTop = el.scrollTop;
            const fromLeft = el.scrollLeft;
            const targetTop = to.top ?? fromTop;
            const targetLeft = to.left ?? fromLeft;
            const deltaTop = targetTop - fromTop;
            const deltaLeft = targetLeft - fromLeft;
            if (Math.abs(deltaTop) < 1 && Math.abs(deltaLeft) < 1) return;

            const started = performance.now();
            const tick = (now: number) => {
                const t = Math.min(1, (now - started) / durationMs);
                const eased = 1 - (1 - t) ** 3;
                if (to.top != null) el.scrollTop = fromTop + deltaTop * eased;
                if (to.left != null) el.scrollLeft = fromLeft + deltaLeft * eased;
                if (t < 1) window.requestAnimationFrame(tick);
            };
            window.requestAnimationFrame(tick);
        },
        []
    );

    /** 2차 노드를 차트 영역 세로 상단(가로도 보이도록)에 맞춤 — 트리 구조는 유지 */
    const scrollToOrgNode = useCallback(
        (nodeId: string) => {
            const tryScroll = (attempt: number) => {
                const area = chartAreaRef.current;
                const chart = chartScrollRef.current;
                const scope = chart ?? area ?? document.body;
                const target = scope.querySelector(
                    `[data-org-node-id="${CSS.escape(nodeId)}"]`
                ) as HTMLElement | null;
                if (!target) {
                    if (attempt < 10) window.setTimeout(() => tryScroll(attempt + 1), 16);
                    return;
                }

                if (area) {
                    const areaRect = area.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    const nextTop = Math.max(
                        0,
                        area.scrollTop + (targetRect.top - areaRect.top)
                    );
                    animateScroll(area, { top: nextTop }, 400);
                }

                if (chart) {
                    const chartRect = chart.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    const nextLeft = Math.max(
                        0,
                        chart.scrollLeft + (targetRect.left - chartRect.left) - 40
                    );
                    animateScroll(chart, { left: nextLeft }, 400);
                }
            };
            window.requestAnimationFrame(() => tryScroll(0));
        },
        [animateScroll]
    );

    const handleSelectLevel2 = useCallback(
        (child: CategoryTreeNode) => {
            setSelectedNodeId(child.id);
            setExpandedIds((prev) => {
                const next = new Set(prev);
                next.add(child.id);
                for (const id of collectSubtreeIds(child)) next.add(id);
                return next;
            });
            scrollToOrgNode(child.id);
        },
        [scrollToOrgNode]
    );

    const locationList = useMemo(
        () =>
            locations
                .filter((l) => !l.parentId)
                .map((l) => ({
                    id: l.id,
                    name: l.name,
                    count: itemCountByLocationId.get(l.id) ?? 0,
                })),
        [locations, itemCountByLocationId]
    );

    // 패널 오픈 시 첫 페인트부터 왼쪽 1차가 선택된 상태가 되도록 렌더 중 동기화
    const openSessionKey = isOpen ? kind : null;
    const [appliedSessionKey, setAppliedSessionKey] = useState<MasterKind | null>(null);
    if (openSessionKey !== appliedSessionKey) {
        setAppliedSessionKey(openSessionKey);
        setNewName("");
        setDeleteTarget(null);
        setSelectedNodeId(null);
        setAddingParentId(null);
        setDraftChildName("");
        setAddingRoot(false);
        setDraftRootName("");
        setEditMode(false);
        setFieldsCategoryId(null);
        if (openSessionKey === "category" && categoryTrees[0]) {
            const first = categoryTrees[0];
            setActiveRootId(first.id);
            setExpandedIds(new Set(collectSubtreeIds(first)));
        } else {
            setActiveRootId(null);
            setExpandedIds(new Set());
        }
    }

    const handleAddLocation = async () => {
        if (!newName.trim()) {
            showError("위치명을 입력해 주세요.");
            return;
        }
        setBusy(true);
        try {
            await createInventoryLocation({ name: newName });
            showSuccess("보관 위치가 추가되었습니다.");
            setNewName("");
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "추가에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleConfirmChildAdd = async () => {
        if (!addingParentId || !draftChildName.trim()) {
            showError("카테고리명을 입력해 주세요.");
            return;
        }
        setBusy(true);
        try {
            await createInventoryCategory(draftChildName, addingParentId);
            showSuccess("하위 카테고리가 추가되었습니다.");
            setAddingParentId(null);
            setDraftChildName("");
            setSelectedNodeId(null);
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "추가에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleRenameCategory = async (nodeId: string, name: string) => {
        setBusy(true);
        try {
            await updateInventoryCategoryName(nodeId, name);
            showSuccess("카테고리명이 변경되었습니다.");
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "이름 변경에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleConfirmRootAdd = async () => {
        if (!draftRootName.trim()) {
            showError("카테고리명을 입력해 주세요.");
            return;
        }
        setBusy(true);
        try {
            await createInventoryCategory(draftRootName, null);
            showSuccess("1차 카테고리가 추가되었습니다.");
            setAddingRoot(false);
            setDraftRootName("");
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "추가에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleMoveCategory = async (nodeId: string, direction: "up" | "down") => {
        setBusy(true);
        try {
            await moveInventoryCategory(nodeId, direction);
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "순서 변경에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!kind || !deleteTarget) return;
        setBusy(true);
        try {
            if (kind === "category") {
                await deleteInventoryCategory(deleteTarget.id);
                showSuccess("카테고리가 삭제되었습니다.");
            } else {
                await deleteInventoryLocation(deleteTarget.id);
                showSuccess("보관 위치가 삭제되었습니다.");
            }
            setDeleteTarget(null);
            setSelectedNodeId(null);
            if (deleteTarget && activeRootId === deleteTarget.id) {
                setActiveRootId(null);
                setExpandedIds(new Set());
            }
            onChanged();
        } catch (error) {
            showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <>
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
            <button
                type="button"
                className={`fixed inset-0 z-[90] bg-black/30 transition-opacity duration-300 ease-in-out ${
                    isOpen
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                }`}
                aria-label="닫기"
                aria-hidden={!isOpen}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => {
                    if (busy || !isOpen) return;
                    onClose();
                }}
            />
            <div
                className={`fixed inset-y-0 right-0 z-[91] flex max-w-full shadow-xl transition-transform duration-300 ease-in-out ${
                    isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
                }`}
                aria-hidden={!isOpen}
            >
                {isCategory && fieldsCategoryId != null && isOpen && (
                    <InventoryCategoryFieldsSidePanel
                        open
                        category={fieldsCategory}
                        categories={categories}
                        onClose={() => {
                            setFieldsCategoryId(null);
                            setSelectedNodeId(null);
                        }}
                        onSaved={onChanged}
                    />
                )}
                {/* 1단 패널: 1차 카테고리 선택과 무관하게 가로폭 고정 */}
                <aside
                    className={`h-full shrink-0 bg-white flex flex-col min-w-0 border-l border-gray-200 ${
                        isCategory
                            ? "w-full sm:w-[640px] md:w-[780px] lg:w-[920px]"
                            : "w-full sm:w-[420px] md:w-[480px]"
                    }`}
                >
                <div className="relative flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <div className="flex items-center gap-1">
                        {isCategory && (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    className={`p-2 rounded-lg transition-colors ${
                                        editMode
                                            ? "bg-gray-900 text-white hover:bg-gray-800"
                                            : "text-gray-500 hover:bg-gray-100"
                                    }`}
                                    aria-pressed={editMode}
                                    aria-label={editMode ? "수정 모드 끄기" : "수정 모드 켜기"}
                                    title={editMode ? "수정 모드 ON" : "수정 모드"}
                                    onClick={() => {
                                        setEditMode((on) => {
                                            const next = !on;
                                            if (!next) {
                                                setAddingParentId(null);
                                                setDraftChildName("");
                                                setSelectedNodeId(null);
                                            }
                                            return next;
                                        });
                                    }}
                                >
                                    <IconEdit className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors ${
                                        addingRoot ? "bg-gray-100 text-gray-900" : ""
                                    }`}
                                    aria-expanded={addingRoot}
                                    aria-haspopup="dialog"
                                    aria-label="1차 카테고리 추가"
                                    title="1차 카테고리 추가"
                                    onClick={() => {
                                        setAddingRoot((open) => !open);
                                        setDraftRootName("");
                                    }}
                                >
                                    <IconPlus className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            onClick={() => {
                                if (busy) return;
                                onClose();
                            }}
                        >
                            <IconClose className="w-5 h-5" />
                        </button>
                    </div>

                    {isCategory && addingRoot && (
                        <div
                            ref={addRootPanelRef}
                            role="dialog"
                            aria-label="1차 카테고리 추가"
                            className="absolute right-4 top-[calc(100%+0.5rem)] z-[100] w-[min(20rem,calc(100%-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_40px_-10px_rgba(15,23,42,0.18),0_2px_8px_-4px_rgba(15,23,42,0.08)] sm:right-6"
                        >
                            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3 py-2.5 sm:px-4 sm:py-3">
                                <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    1차 카테고리 추가
                                </p>
                                <button
                                    type="button"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 transition-colors hover:bg-gray-100"
                                    onClick={() => {
                                        setAddingRoot(false);
                                        setDraftRootName("");
                                    }}
                                    aria-label="닫기"
                                    title="닫기"
                                >
                                    <IconClose className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-3 p-3 sm:p-4">
                                <Input
                                    value={draftRootName}
                                    onChange={setDraftRootName}
                                    placeholder="카테고리명"
                                    disabled={busy}
                                    className="w-full"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void handleConfirmRootAdd();
                                        }
                                    }}
                                />
                                <Button
                                    variant="primary"
                                    size="md"
                                    loading={busy && !deleteTarget}
                                    icon={<IconPlus className="w-4 h-4" />}
                                    onClick={() => void handleConfirmRootAdd()}
                                    className="w-full"
                                >
                                    추가
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {effectiveKind === "location" && (
                        <div className="shrink-0 px-4 py-4 sm:px-6 border-b border-gray-100">
                            <div className="rounded-2xl border border-gray-200 p-3 flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-700">보관 위치 추가</p>
                                <div className="flex gap-2">
                                    <Input
                                        value={newName}
                                        onChange={setNewName}
                                        placeholder="새 위치명"
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="primary"
                                        size="md"
                                        loading={busy && !deleteTarget}
                                        icon={<IconPlus className="w-4 h-4" />}
                                        onClick={handleAddLocation}
                                    >
                                        추가
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isCategory && (
                        <div className="shrink-0 z-20 bg-white border-b border-gray-100 px-4 py-3 sm:px-6 flex flex-col gap-3">
                            {categoryTrees.length > 0 && (
                                <>
                                    {/* 1차: 가로 버튼 그리드 (한 줄 4개) */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                                        {categoryTrees.map((root) => {
                                            const isActive = activeRootId === root.id;
                                            return (
                                                <button
                                                    key={root.id}
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => handleSelectRoot(root)}
                                                    className={`w-full rounded-xl border px-3 py-3 text-center transition-all ${
                                                        isActive
                                                            ? "border-gray-900 bg-gray-900 text-white shadow-md"
                                                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:shadow-sm"
                                                    }`}
                                                >
                                                    <p className="font-medium text-sm truncate">
                                                        {root.name}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 2차: 스크롤 시에도 상단 고정 */}
                                    {activeRoot && activeRoot.children.length > 0 && (
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 md:gap-2">
                                            {activeRoot.children.map((child) => {
                                                const isActive = selectedNodeId === child.id;
                                                return (
                                                    <button
                                                        key={child.id}
                                                        type="button"
                                                        disabled={busy}
                                                        title={child.name}
                                                        onClick={() => handleSelectLevel2(child)}
                                                        className={`w-full rounded-lg border px-2 py-2 text-center transition-all ${
                                                            isActive
                                                                ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                                                : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50"
                                                        }`}
                                                    >
                                                        <p className="font-medium text-xs truncate">
                                                            {child.name}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div
                        ref={chartAreaRef}
                        className="flex-1 min-h-0 min-w-0 overflow-auto px-4 py-4 sm:px-6"
                        onMouseDown={(e) => {
                            if (!isCategory) return;
                            const target = e.target as HTMLElement;
                            if (target.closest("[data-org-card]")) return;
                            handleActivateNode(null);
                        }}
                    >
                        {isCategory ? (
                            categoryTrees.length === 0 ? (
                                <div className="rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                                    등록된 항목이 없습니다.
                                </div>
                            ) : activeRoot ? (
                                activeRoot.children.length === 0 ? (
                                    <div className="rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                                        2차 카테고리가 없습니다.
                                    </div>
                                ) : (
                                    <div
                                        ref={chartScrollRef}
                                        className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pl-10 pr-12 pb-4"
                                        onMouseDown={(e) => {
                                            const target = e.target as HTMLElement;
                                            if (target.closest("[data-org-card]")) return;
                                            handleActivateNode(null);
                                        }}
                                    >
                                        {/* 1차는 상단 버튼만 — 조직도는 2차부터 */}
                                        <div className="w-max flex flex-col gap-3">
                                            {activeRoot.children.map((child, index) => (
                                                <CategoryOrgNode
                                                    key={child.id}
                                                    node={child}
                                                    busy={busy}
                                                    editMode={editMode}
                                                    selectedNodeId={selectedNodeId}
                                                    onActivateNode={handleActivateNode}
                                                    siblingIndex={index}
                                                    siblingCount={activeRoot.children.length}
                                                    onMove={handleMoveCategory}
                                                    addingParentId={addingParentId}
                                                    draftName={draftChildName}
                                                    onDraftNameChange={setDraftChildName}
                                                    onStartAdd={(parentId) => {
                                                        if (!editMode) return;
                                                        setAddingParentId(parentId);
                                                        setDraftChildName("");
                                                        setSelectedNodeId(parentId);
                                                        setFieldsCategoryId(null);
                                                        setExpandedIds((prev) => {
                                                            const next = new Set(prev);
                                                            next.add(parentId);
                                                            return next;
                                                        });
                                                    }}
                                                    onCancelAdd={() => {
                                                        setAddingParentId(null);
                                                        setDraftChildName("");
                                                        setSelectedNodeId(null);
                                                    }}
                                                    onConfirmAdd={handleConfirmChildAdd}
                                                    onDelete={(node) =>
                                                        setDeleteTarget({
                                                            id: node.id,
                                                            name: node.pathLabel,
                                                            childCount: node.childCount,
                                                            itemCount: node.count,
                                                        })
                                                    }
                                                    onRename={handleRenameCategory}
                                                    expandedIds={expandedIds}
                                                    onExpandNode={handleExpandNode}
                                                    onCollapseNode={handleCollapseNode}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                                    상단에서 1차 카테고리를 선택해 주세요.
                                </div>
                            )
                        ) : locationList.length === 0 ? (
                            <div className="rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                                등록된 항목이 없습니다.
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {locationList.map((row) => (
                                    <li
                                        key={row.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 truncate">
                                                {row.name}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                연결 자재 {row.count}개
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600! border-red-200! shrink-0"
                                            disabled={busy}
                                            onClick={() =>
                                                setDeleteTarget({
                                                    id: row.id,
                                                    name: row.name,
                                                    childCount: 0,
                                                    itemCount: row.count,
                                                })
                                            }
                                        >
                                            삭제
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                </aside>
            </div>

            <ConfirmDialog
                isOpen={deleteTarget != null}
                onClose={() => {
                    if (busy) return;
                    setDeleteTarget(null);
                }}
                onConfirm={handleDelete}
                title={kind === "category" ? "카테고리 삭제" : "보관 위치 삭제"}
                message={
                    deleteTarget
                        ? kind === "category"
                            ? `"${deleteTarget.name}" 카테고리를 삭제할까요?${
                                  deleteTarget.childCount > 0
                                      ? ` 하위 카테고리 ${deleteTarget.childCount}개도 함께 삭제됩니다.`
                                      : ""
                              }${
                                  deleteTarget.itemCount > 0
                                      ? ` 연결된 자재 ${deleteTarget.itemCount}개는 미분류로 남습니다.`
                                      : ""
                              }`
                            : `"${deleteTarget.name}" 위치를 삭제할까요?${
                                  deleteTarget.itemCount > 0
                                      ? ` (연결된 자재 ${deleteTarget.itemCount}개는 위치 미지정으로 남습니다.)`
                                      : ""
                              }`
                        : ""
                }
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={busy}
            />
        </>,
        document.body
    );
}
