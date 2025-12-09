import { useState, useRef } from 'react';
import { useWorkReportStore, FileCategory } from '../../store/workReportStore';

// 아이콘들
const IconBed = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 13C8.66 13 10 11.66 10 10C10 8.34 8.66 7 7 7C5.34 7 4 8.34 4 10C4 11.66 5.34 13 7 13ZM19 7H11V14H3V5H1V20H3V17H21V20H23V11C23 8.79 21.21 7 19 7Z" fill="currentColor"/>
  </svg>
);

const IconTool = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.7 19L13.6 9.9C14.5 7.6 14 4.9 12.1 3C10.1 1 7.1 0.6 4.7 1.7L9 6L6 9L1.6 4.7C0.4 7.1 0.9 10.1 2.9 12.1C4.8 14 7.5 14.5 9.8 13.6L18.9 22.7C19.3 23.1 19.9 23.1 20.3 22.7L22.6 20.4C23.1 20 23.1 19.3 22.7 19Z" fill="currentColor"/>
  </svg>
);

const IconRestaurant = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 9H9V2H7V9H5V2H3V9C3 11.12 4.66 12.84 6.75 12.97V22H9.25V12.97C11.34 12.84 13 11.12 13 9V2H11V9ZM16 6V14H18.5V22H21V2C18.24 2 16 4.24 16 6Z" fill="currentColor"/>
  </svg>
);

const IconFolder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" fill="currentColor"/>
  </svg>
);

const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 15.01L9.41 16.42L11 14.84V19H13V14.84L14.59 16.43L16 15.01L12.01 11L8 15.01Z" fill="currentColor"/>
  </svg>
);

const IconAdd = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor"/>
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
  </svg>
);

interface FileCardProps {
  icon: React.ReactNode;
  title: string;
  category: FileCategory;
  onPreview: (url: string, name: string, type: string) => void;
}

function FileCard({ icon, title, category, onPreview }: FileCardProps) {
  const { uploadedFiles, addFiles, removeFile } = useWorkReportStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const categoryFiles = uploadedFiles.filter(f => f.category === category);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files).filter(
      file => file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    if (fileArray.length > 0) {
      addFiles(fileArray, category);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeFile(id);
  };

  const handleThumbnailClick = (item: { preview?: string; file: File }) => {
    if (item.preview) {
      onPreview(item.preview, item.file.name, item.file.type);
    } else if (item.file.type === 'application/pdf') {
      const url = URL.createObjectURL(item.file);
      onPreview(url, item.file.name, item.file.type);
    }
  };

  return (
    <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-[#374151]">
        {icon}
        <span className="font-semibold text-[14px]">{title}</span>
      </div>

      {/* 파일 추가 버튼 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-10 bg-[#364153] hover:bg-[#1f2937] text-white rounded-lg flex items-center justify-center gap-1 transition-colors"
      >
        <IconAdd />
        <span className="text-[13px] font-medium">파일 추가</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* 파일 목록 */}
      {categoryFiles.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-[#6b7280]">업로드 된 파일 ({categoryFiles.length}개)</p>
          {categoryFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 bg-white border border-[#e5e7eb] rounded-lg"
            >
              {/* 썸네일 - 클릭 시 미리보기 */}
              <div 
                className="w-12 h-12 bg-[#1f2937] rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-blue-400 transition-all"
                onClick={() => handleThumbnailClick(item)}
              >
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-[10px] font-bold">PDF</span>
                )}
              </div>
              
              {/* 파일명 */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#374151] truncate">{item.file.name}</p>
              </div>
              
              {/* 삭제 버튼 */}
              <button
                onClick={(e) => handleDelete(e, item.id)}
                className="w-6 h-6 flex items-center justify-center text-[#9ca3af] hover:text-[#ef4444] transition-colors"
              >
                <IconClose />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#9ca3af] text-center py-2">업로드 된 파일이 없습니다.</p>
      )}
    </div>
  );
}

export default function FileUploadSection() {
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const openPreview = (url: string, name: string, type: string) => {
    setPreviewFile({ url, name, type });
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 md:p-7 overflow-hidden flex flex-col gap-4 md:gap-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <IconUpload />
        <div>
          <h2 className="text-[18px] md:text-[22px] font-semibold text-[#364153] leading-[1.364] tracking-[-0.43px]">
            첨부파일 업로드
          </h2>
          <p className="text-[12px] text-[#9ca3af]">영수증, TBM사진 등</p>
        </div>
      </div>

      {/* 4개 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FileCard
          icon={<IconBed />}
          title="숙박 영수증"
          category="숙박영수증"
          onPreview={openPreview}
        />
        <FileCard
          icon={<IconTool />}
          title="자재 영수증"
          category="자재영수증"
          onPreview={openPreview}
        />
        <FileCard
          icon={<IconRestaurant />}
          title="식비 및 유대 영수증"
          category="식비영수증"
          onPreview={openPreview}
        />
        <FileCard
          icon={<IconFolder />}
          title="기타 (TBM사진 등)"
          category="기타"
          onPreview={openPreview}
        />
      </div>

      {/* 미리보기 모달 */}
      {previewFile && (
        <div
          onClick={closePreview}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
        >
          {/* 닫기 버튼 */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          </button>
          
          {/* 이미지/PDF - 클릭해도 모달 안닫힘 */}
          <div 
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {previewFile.type.startsWith('image/') ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-white object-contain"
              />
            ) : (
              <iframe
                src={previewFile.url}
                title={previewFile.name}
                className="w-[85vw] h-[85vh] bg-white rounded-xl shadow-2xl"
              />
            )}
            {/* 파일명 */}
            <p className="text-white text-center mt-3 text-[14px] truncate">{previewFile.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
