import {
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

/**
 * 워크로드 사유 섹션과 같은 이징·속성(max-h / opacity / translate-y),
 * 편집 영역은 조금 더 길게 보이도록 duration만 길게 둠.
 */
export const TRAVEL_OVERRIDE_EDITOR_ANIM_MS = 500;

type TravelOverrideEditorAnimatedShellProps = {
    editorKey: string;
    /** `expandedEditorKey === editorKey` */
    isExpanded: boolean;
    /** 닫힘 애니메이션 중 (행은 유지, 내용은 워크로드와 같이 먼저 제거) */
    isClosing: boolean;
    children: ReactNode;
};

export function TravelOverrideEditorAnimatedShell({
    editorKey,
    isExpanded,
    isClosing,
    children,
}: TravelOverrideEditorAnimatedShellProps) {
    const [openedVisual, setOpenedVisual] = useState(false);
    /** 직전 렌더에서 이미 펼쳐진 상태였는지 (키만 바뀐 경우 재오픈 애니메이션 생략) */
    const wasExpandedOpenRef = useRef(false);

    useLayoutEffect(() => {
        if (!isExpanded || isClosing) {
            setOpenedVisual(false);
            wasExpandedOpenRef.current = false;
            return;
        }

        if (wasExpandedOpenRef.current) {
            setOpenedVisual(true);
            return;
        }

        wasExpandedOpenRef.current = true;
        setOpenedVisual(false);
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setOpenedVisual(true));
        });

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [isExpanded, isClosing, editorKey]);

    const showContent = isExpanded;
    const shellOpen = isExpanded && !isClosing && openedVisual;

    const openClasses =
        "max-h-[min(32rem,70vh)] opacity-100 translate-y-0 py-3";
    const closedClasses =
        "max-h-0 opacity-0 -translate-y-2 py-0 border-transparent";

    return (
        <div
            data-travel-override-editor="true"
            data-editor-key={editorKey}
            className={[
                "overflow-hidden transition-all duration-400 ease-out",
                shellOpen ? openClasses : closedClasses,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {showContent ? children : null}
        </div>
    );
}
