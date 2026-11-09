import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Tabs from "../../components/common/Tabs";
import { IconCategory, IconLocation, IconPlus } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../../store/auth";
import { PATHS } from "../../utils/paths";
import {
    fetchInventoryCategories,
    fetchInventoryItems,
    fetchInventoryLocations,
    fetchInventoryStats,
    flattenInventoryCategories,
    type InventoryCategory,
    type InventoryItemListRow,
    type InventoryItemStatus,
    type InventoryLocation,
    type InventoryStats,
} from "../../lib/inventoryApi";
import InventoryStatsCards from "./inventory/InventoryStatsCards";
import InventoryListView from "./inventory/InventoryListView";
import InventoryCategoryView from "./inventory/InventoryCategoryView";
import InventoryLocationView from "./inventory/InventoryLocationView";
import InventoryItemSidePanel from "./inventory/InventoryItemSidePanel";
import InventoryMasterManageSidePanel from "./inventory/InventoryMasterManageSidePanel";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

type MainTab = "list" | "category" | "location";
type ViewMode = "list" | "card";
type StatusSite = "factory" | "ulsan";

const SITE_META: Record<StatusSite, { title: string; description: string }> = {
    factory: {
        title: "공구·자재현황 · 공장",
        description: "공장 내 자재·공구 재고를 관리합니다.",
    },
    ulsan: {
        title: "공구·자재현황 · 울산",
        description: "울산 현장 자재·공구 재고를 관리합니다.",
    },
};

const searchIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
);

const MATERIALS_STATUS_ALLOWED_IDS = ["mw.park", "brian.ko"] as const;

export default function MaterialStatusPage() {
    const { site } = useParams<{ site: string }>();
    const statusSite: StatusSite | null =
        site === "factory" || site === "ulsan" ? site : null;
    const siteMeta = statusSite ? SITE_META[statusSite] : SITE_META.factory;
    const { profile } = useAuth();
    const isAdmin = profile?.role === "admin";
    const accountId = (
        localStorage.getItem("sidebarLoginId") ||
        profile?.email?.split("@")[0] ||
        ""
    ).toLowerCase();
    const canAccessMaterialsStatus = (MATERIALS_STATUS_ALLOWED_IDS as readonly string[]).includes(
        accountId
    );
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
    useEffect(() => {
        setSidebarOpen(false);
    }, [setSidebarOpen]);
    const { showError } = useToast();

    const [mainTab, setMainTab] = useState<MainTab>("list");
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState<InventoryItemStatus | "all" | "">("");
    const [locationFilter, setLocationFilter] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [locations, setLocations] = useState<InventoryLocation[]>([]);
    const [items, setItems] = useState<InventoryItemListRow[]>([]);
    const [stats, setStats] = useState<InventoryStats>({
        totalItems: 0,
        lowStockItems: 0,
        unlocatedItems: 0,
        categoryCount: 0,
    });
    const [loading, setLoading] = useState(true);
    const [createMode, setCreateMode] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [masterManageKind, setMasterManageKind] = useState<"category" | "location" | null>(null);
    const [listVersion, setListVersion] = useState(0);

    const itemCountByCategoryId = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of items) {
            if (!item.categoryId) continue;
            map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
        }
        return map;
    }, [items]);

    const itemCountByLocationId = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of items) {
            for (const stock of item.stocks) {
                if (!stock.locationId) continue;
                map.set(stock.locationId, (map.get(stock.locationId) ?? 0) + 1);
            }
        }
        return map;
    }, [items]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [search]);

    const loadMasters = useCallback(async () => {
        const [nextCategories, nextLocations] = await Promise.all([
            fetchInventoryCategories(),
            fetchInventoryLocations(),
        ]);
        setCategories(nextCategories);
        setLocations(nextLocations);
    }, []);

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const [nextItems, allItems] = await Promise.all([
                fetchInventoryItems({
                    search: debouncedSearch,
                    categoryId: categoryFilter || null,
                    locationId: locationFilter || null,
                    status: (statusFilter || "all") as InventoryItemStatus | "all",
                }),
                fetchInventoryItems(),
            ]);
            setItems(nextItems);
            setStats(await fetchInventoryStats(allItems));
        } catch (error) {
            console.error(error);
            setItems([]);
            showError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, categoryFilter, locationFilter, statusFilter, showError]);

    useEffect(() => {
        loadMasters().catch((error) => {
            console.error(error);
            showError(error instanceof Error ? error.message : "기준 정보를 불러오지 못했습니다.");
        });
    }, [loadMasters, showError, listVersion]);

    useEffect(() => {
        loadItems();
    }, [loadItems, listVersion]);

    useEffect(() => {
        if (
            selectedCategoryId &&
            selectedCategoryId !== "__none__" &&
            categories.length > 0 &&
            !categories.some((c) => c.id === selectedCategoryId)
        ) {
            setSelectedCategoryId(null);
        }
    }, [categories, selectedCategoryId]);

    useEffect(() => {
        if (
            selectedLocationId &&
            selectedLocationId !== "__unlocated__" &&
            locations.length > 0 &&
            !locations.some((l) => l.id === selectedLocationId)
        ) {
            setSelectedLocationId(null);
        }
    }, [locations, selectedLocationId]);

    const refresh = () => setListVersion((v) => v + 1);

    if (!canAccessMaterialsStatus) {
        return <Navigate to={PATHS.materialsList} replace />;
    }

    if (!statusSite) {
        return <Navigate to={PATHS.materialsStatusFactory} replace />;
    }

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed inset-y-0 left-0 z-50 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} showCloseOnDesktop />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title={siteMeta.title}
                    onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                    showMenuOnDesktop
                    rightContent={
                        <div className="flex items-center gap-0.5 md:gap-1">
                            <button
                                type="button"
                                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                aria-label="카테고리 상세"
                                title="카테고리 상세"
                                onClick={() => setMasterManageKind("category")}
                            >
                                <IconCategory className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button
                                type="button"
                                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                aria-label="보관 위치 상세"
                                title="보관 위치 상세"
                                onClick={() => setMasterManageKind("location")}
                            >
                                <IconLocation className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    }
                />

                <div className="flex-1 overflow-y-auto">
                    <PageContainer className="py-4 md:py-6 pb-24">
                        <p className="text-sm text-gray-500 mb-4 md:mb-5">
                            {siteMeta.description}
                        </p>

                        <InventoryStatsCards stats={stats} loading={loading && items.length === 0} />

                        <div className="mt-5 md:mt-6 flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <Tabs
                                    items={[
                                        { value: "list", label: "자재 리스트" },
                                        { value: "category", label: "카테고리별" },
                                        { value: "location", label: "보관 위치별" },
                                    ]}
                                    value={mainTab}
                                    onChange={(value) => {
                                        setMainTab(value as MainTab);
                                        setPage(1);
                                    }}
                                />
                                {mainTab === "list" && (
                                    <div className="flex items-center gap-1 self-start md:self-auto rounded-xl border border-gray-200 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("list")}
                                            className={`px-3 py-1.5 text-sm rounded-lg ${
                                                viewMode === "list"
                                                    ? "bg-gray-900 text-white"
                                                    : "text-gray-600 hover:bg-gray-50"
                                            }`}
                                        >
                                            리스트형
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("card")}
                                            className={`px-3 py-1.5 text-sm rounded-lg ${
                                                viewMode === "card"
                                                    ? "bg-gray-900 text-white"
                                                    : "text-gray-600 hover:bg-gray-50"
                                            }`}
                                        >
                                            카드형
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3">
                                <Input
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="자재명, 규격, 코드로 검색"
                                    icon={searchIcon}
                                    iconPosition="left"
                                    className="w-full lg:flex-1"
                                />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:contents">
                                    <Select
                                        placeholder="카테고리"
                                        value={categoryFilter}
                                        onChange={(value) => {
                                            setCategoryFilter(value);
                                            setPage(1);
                                        }}
                                        options={flattenInventoryCategories(categories).map(
                                            (c) => ({
                                                value: c.id,
                                                label: c.pathLabel,
                                            })
                                        )}
                                        className="lg:w-40"
                                    />
                                    <Select
                                        placeholder="상태"
                                        value={statusFilter}
                                        onChange={(value) => {
                                            setStatusFilter(
                                                value as InventoryItemStatus | "all" | ""
                                            );
                                            setPage(1);
                                        }}
                                        options={[
                                            { value: "all", label: "전체 상태" },
                                            { value: "normal", label: "정상" },
                                            { value: "low", label: "부족" },
                                            { value: "unlocated", label: "위치 미지정" },
                                        ]}
                                        className="lg:w-36"
                                    />
                                    <Select
                                        placeholder="보관 위치"
                                        value={locationFilter}
                                        onChange={(value) => {
                                            setLocationFilter(value);
                                            setPage(1);
                                        }}
                                        options={locations.map((l) => ({
                                            value: l.id,
                                            label: l.name,
                                        }))}
                                        className="lg:w-40"
                                    />
                                    <Button
                                        variant="outline"
                                        size="md"
                                        onClick={() => {
                                            setSearch("");
                                            setDebouncedSearch("");
                                            setCategoryFilter("");
                                            setStatusFilter("");
                                            setLocationFilter("");
                                            setSelectedCategoryId(null);
                                            setSelectedLocationId(null);
                                            setPage(1);
                                        }}
                                    >
                                        초기화
                                    </Button>
                                </div>
                            </div>

                            {loading && items.length === 0 ? (
                                <div className="rounded-2xl border border-gray-200 px-4 py-16 text-center text-gray-400">
                                    불러오는 중...
                                </div>
                            ) : mainTab === "list" ? (
                                <InventoryListView
                                    items={items}
                                    viewMode={viewMode}
                                    page={page}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={setPage}
                                    onSelect={(item) => {
                                        setCreateMode(false);
                                        setSelectedItemId(item.id);
                                    }}
                                />
                            ) : mainTab === "category" ? (
                                <InventoryCategoryView
                                    categories={categories}
                                    items={items}
                                    selectedCategoryId={selectedCategoryId}
                                    onSelectCategory={setSelectedCategoryId}
                                    onSelectItem={(item) => {
                                        setCreateMode(false);
                                        setSelectedItemId(item.id);
                                    }}
                                    canManage
                                    onEditMasters={() => setMasterManageKind("category")}
                                />
                            ) : (
                                <InventoryLocationView
                                    locations={locations}
                                    items={items}
                                    selectedLocationId={selectedLocationId}
                                    onSelectLocation={setSelectedLocationId}
                                    onSelectItem={(item) => {
                                        setCreateMode(false);
                                        setSelectedItemId(item.id);
                                    }}
                                    canManage
                                    onEditMasters={() => setMasterManageKind("location")}
                                />
                            )}
                        </div>
                    </PageContainer>
                </div>

                <div className="fixed bottom-4 right-4 z-20 md:bottom-6 md:right-6">
                    <Button
                        variant="primary"
                        size="lg"
                        icon={<IconPlus />}
                        onClick={() => {
                            setSelectedItemId(null);
                            setCreateMode(true);
                        }}
                        className="shadow-lg rounded-full h-14 px-5"
                    >
                        등록
                    </Button>
                </div>
            </div>

            <InventoryItemSidePanel
                itemId={selectedItemId}
                createMode={createMode}
                categories={categories}
                locations={locations}
                isAdmin={!!isAdmin}
                onClose={() => {
                    setCreateMode(false);
                    setSelectedItemId(null);
                }}
                onChanged={refresh}
            />

            <InventoryMasterManageSidePanel
                kind={masterManageKind}
                categories={categories}
                locations={locations}
                itemCountByCategoryId={itemCountByCategoryId}
                itemCountByLocationId={itemCountByLocationId}
                onClose={() => setMasterManageKind(null)}
                onChanged={refresh}
            />
        </div>
    );
}
