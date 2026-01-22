import { useState, useRef, useEffect } from "react";

/**
 * 서브메뉴 열림 상태를 localStorage와 동기화하는 커스텀 훅
 * @param storageKey localStorage에 저장할 키
 * @param initialValue 초기값 (localStorage에 값이 없을 때 사용)
 * @returns [isOpen, setIsOpen, isOpenRef] - 상태, 상태 설정 함수, ref
 */
export function useSubMenuState(
    storageKey: string,
    initialValue: boolean = false
): [boolean, (value: boolean) => void, React.RefObject<boolean>] {
    // localStorage에서 초기값 읽기
    const getInitialValue = () => {
        const saved = localStorage.getItem(storageKey);
        if (saved === null) {
            return initialValue;
        }
        return saved === "true";
    };

    const [isOpen, setIsOpen] = useState<boolean>(getInitialValue);

    // ref로 현재 상태 추적
    const isOpenRef = useRef<boolean>(getInitialValue());

    // 상태 변경 시 localStorage에 저장 및 ref 업데이트
    useEffect(() => {
        isOpenRef.current = isOpen;
        localStorage.setItem(storageKey, String(isOpen));
    }, [isOpen, storageKey]);

    // setIsOpen을 래핑하여 안전하게 사용
    const setOpen = (value: boolean) => {
        setIsOpen(value);
    };

    return [isOpen, setOpen, isOpenRef];
}

