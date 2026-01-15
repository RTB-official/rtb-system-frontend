/**
 * 이미지 압축 유틸리티 함수
 */

/**
 * 이미지 파일을 압축하여 새로운 Blob을 반환합니다.
 * @param file 원본 이미지 파일
 * @param maxWidth 최대 너비 (기본: 1920px)
 * @param maxHeight 최대 높이 (기본: 1920px)
 * @param quality 품질 (0.1 ~ 1.0, 기본: 0.8)
 * @param maxSizeKB 최대 파일 크기 (KB, 기본: 500KB)
 * @returns 압축된 Blob Promise
 */
export async function compressImage(
    file: File,
    options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        maxSizeKB?: number;
    }
): Promise<Blob> {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality: initialQuality = 0.6,
        maxSizeKB = 300,
    } = options || {};

    return new Promise((resolve, reject) => {
        // 이미지 파일이 아닌 경우 원본 반환
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 캔버스 생성
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // 비율 유지하면서 리사이즈
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;

                // 이미지 그리기
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Canvas context를 가져올 수 없습니다."));
                    return;
                }

                // 이미지 품질 향상을 위한 설정
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                ctx.drawImage(img, 0, 0, width, height);

                // PNG는 JPEG로 변환 (압축률이 더 좋음)
                const outputType = file.type === "image/png" ? "image/jpeg" : file.type;

                // 품질을 점진적으로 낮추면서 목표 크기 이하로 압축
                const compress = (currentQuality: number): void => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error("이미지 압축에 실패했습니다."));
                                return;
                            }

                            const sizeKB = blob.size / 1024;

                            // 목표 크기 이하이거나 품질이 0.2 이하이면 완료
                            if (
                                sizeKB <= maxSizeKB ||
                                currentQuality <= 0.2
                            ) {
                                resolve(blob);
                            } else {
                                // 품질을 0.05씩 낮춰서 다시 압축 (더 세밀하게)
                                compress(Math.max(0.2, currentQuality - 0.05));
                            }
                        },
                        outputType,
                        currentQuality
                    );
                };

                // 초기 품질로 압축 시작
                compress(initialQuality);
            };

            img.onerror = () => {
                reject(new Error("이미지를 로드할 수 없습니다."));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error("파일을 읽을 수 없습니다."));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * 이미지 파일을 압축하여 File 객체로 반환합니다.
 * @param file 원본 이미지 파일
 * @param options 압축 옵션
 * @returns 압축된 File Promise
 */
export async function compressImageFile(
    file: File,
    options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        maxSizeKB?: number;
    }
): Promise<File> {
    const blob = await compressImage(file, options);

    // 원본 파일명 유지 (확장자는 압축 후 타입에 맞게 변경될 수 있음)
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const extension = blob.type.split("/")[1] || "jpg";
    const compressedFileName = `${fileName}_compressed.${extension}`;

    return new File([blob], compressedFileName, {
        type: blob.type,
        lastModified: Date.now(),
    });
}

