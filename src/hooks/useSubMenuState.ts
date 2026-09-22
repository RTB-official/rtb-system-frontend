import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 서브메뉴 열림 상태를 localStorage와 동기화
 */
export function useSubMenuState(
    storageKey: string,
    initialValue: boolean = false
): [boolean, (value: boolean) => void, React.RefObject<boolean>] {
    const getInitialValue = () => {
        const saved = localStorage.getItem(storageKey);
        if (saved === null) return initialValue;
        return saved === "true";
    };

    const [isOpen, setIsOpen] = useState<boolean>(getInitialValue);
    const isOpenRef = useRef<boolean>(getInitialValue());

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const setOpen = useCallback(
        (value: boolean) => {
            isOpenRef.current = value;
            localStorage.setItem(storageKey, String(value));
            setIsOpen(value);
        },
        [storageKey]
    );

    return [isOpen, setOpen, isOpenRef];
}
