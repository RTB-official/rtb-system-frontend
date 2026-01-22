import { create } from 'zustand';

// 타입 정의
export interface WorkLogEntry {
  id: number;
  dateFrom: string;
  timeFrom: string;
  dateTo: string;
  timeTo: string;
  descType: '작업' | '이동' | '대기' | '';
  details: string;
  persons: string[];
  note: string;
  noLunch: boolean;
  moveFrom?: string;
  moveTo?: string;
}

export interface ExpenseEntry {
  id: number;
  date: string;
  type: string;
  detail: string;
  amount: number;
}

export interface MaterialEntry {
  id: number;
  name: string;
  qty: number;
  unit: string;
}

export type FileCategory = '숙박영수증' | '자재구매영수증' | '식비및유대영수증' | '기타';

export interface UploadedFile {
  id: number;
  file?: File; // 새로 업로드하는 파일
  preview?: string;
  category: FileCategory;
  // 기존 영수증 정보 (DB에서 로드된 경우)
  receiptId?: number; // DB의 receipt id
  storagePath?: string;
  originalName?: string;
  fileUrl?: string; // Storage 공개 URL
  mimeType?: string;
  isExisting?: boolean; // 기존 영수증인지 여부
}

// 직급별 직원 데이터
export const STAFF_DATA: Record<string, string[]> = {
  '부장': ['김춘근', '안재훈', '온권태', '정영철', '김희규'],
  '차장': ['이효익', '정상민', '김동민', '손재진', '우상윤', '성기형', '류성관'],
  '과장': [],
  '대리': ['이종훈', '조용남', '고두형'],
  '주임': ['박영성', '문채훈', '김민규', '김상민', '박민욱'],
  '인턴': ['강민지'],
};

// 지역별 인원 매핑
export const REGION_GROUPS: Record<string, string[]> = {
  BC: ['김희규', '이효익', '정상민', '손재진', '류성관', '이종훈', '조용남', '박영성', '문채훈', '김민규', '박민욱', '김상민', '고두형'],
  UL: ['온권태', '김동민', '성기형'],
  JY: ['김춘근', '안재훈', '정영철'],
  GJ: ['우상윤'],
};

// 참관 감독 그룹별 인원
export const ORDER_PERSONS: Record<string, string[]> = {
  ELU: ['김용웅', '허만기', '김재봉', '송준희', '이대겸', '김연형', '이영철', '장덕훈'],
  PRIME: ['이유수', '김효민', '안희재'],
};

// 출장지 목록
export const LOCATIONS = [
  'HD중공업(해양)', 'HD미포', 'HD삼호', 'PNC', 'PNIT', 'HPNT', 'BNCT', 'HJNC', '한화오션', '삼성중공업',
];

// 운행차량 목록
export const VEHICLES = ['5423', '4272', '0892', '5739', '0598', '7203', '6297', '카니발'];

// 자재 단위 매핑
export const MATERIAL_UNITS: Record<string, string> = {
  '장갑': '타',
  '보루': 'EA',
  '실리콘그리스': 'EA',
  '그리스': 'EA',
  '방청윤활유(WD40)': 'EA',
  '모리코트': 'EA',
  '모리코트(스프레이)': 'EA',
};

// 자재 목록
export const MATERIALS = Object.keys(MATERIAL_UNITS);

// 지출 분류
export const EXPENSE_TYPES = ['조식', '중식', '석식', '숙박', '유류비'];

interface WorkReportState {
  // 기본정보
  author: string;
  vessel: string;
  engine: string;
  orderGroup: string;
  orderPerson: string;
  location: string;
  locationCustom: string;
  vehicles: string[];
  subject: string;
  
  // 전체 인원원 (전체)
  workers: string[];
  
  // 상세정보 (출장 업무 일지)
  workLogEntries: WorkLogEntry[];
  editingEntryId: number | null;
  
  // 현재 입력 중인 상세정보
  currentEntry: Partial<WorkLogEntry>;
  currentEntryPersons: string[];
  
  // 지출내역
  expenses: ExpenseEntry[];
  editingExpenseId: number | null;
  
  // 소모자재
  materials: MaterialEntry[];
  
  // 첨부파일
  uploadedFiles: UploadedFile[];
  
  // Actions - 기본정보
  setAuthor: (author: string) => void;
  setVessel: (vessel: string) => void;
  setEngine: (engine: string) => void;
  setOrderGroup: (group: string) => void;
  setOrderPerson: (person: string) => void;
  setLocation: (location: string) => void;
  setLocationCustom: (custom: string) => void;
  toggleVehicle: (vehicle: string) => void;
  setVehicles: (vehicles: string[]) => void;
  setSubject: (subject: string) => void;
  
  // Actions - 작업자
  addWorker: (name: string) => void;
  setWorkers: (workers: string[]) => void;
  removeWorker: (name: string) => void;
  addWorkersByRegion: (region: string) => void;
  
  // Actions - 상세정보
  setCurrentEntry: (entry: Partial<WorkLogEntry>) => void;
  addCurrentEntryPerson: (name: string) => void;
  removeCurrentEntryPerson: (name: string) => void;
  addAllCurrentEntryPersons: () => void;
  addRegionPersonsToEntry: (region: string) => void;
  saveWorkLogEntry: (onError?: (message: string) => void) => void;
  setWorkLogEntries: (entries: WorkLogEntry[]) => void;
  deleteWorkLogEntry: (id: number) => void;
  editWorkLogEntry: (id: number) => void;
  cancelEditEntry: () => void;
  
  // Actions - 지출내역
  addExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  setExpenses: (expenses: ExpenseEntry[]) => void;
  updateExpense: (id: number, expense: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: number) => void;
  editExpense: (id: number) => void;
  cancelEditExpense: () => void;
  
  // Actions - 소모자재
  addMaterial: (material: Omit<MaterialEntry, 'id'>) => void;
  setMaterials: (materials: MaterialEntry[]) => void;
  removeMaterial: (id: number) => void;
  
  // Actions - 첨부파일
  addFiles: (files: File[], category: FileCategory) => void;
  addExistingReceipt: (receipt: {
    receiptId: number;
    category: FileCategory;
    storagePath: string;
    originalName: string | null;
    fileUrl?: string;
    mimeType?: string | null;
  }) => void;
  removeFile: (id: number) => void;
  
  // Actions - 전체
  resetForm: () => void;
  getExpenseTotal: () => number;
}

const initialCurrentEntry: Partial<WorkLogEntry> = {
  dateFrom: '',
  timeFrom: '',
  dateTo: '',
  timeTo: '',
  descType: '',
  details: '',
  note: '',
  noLunch: false,
  moveFrom: '',
  moveTo: '',
};

export const useWorkReportStore = create<WorkReportState>((set, get) => ({
  // 초기 상태
  author: '',
  vessel: '',
  engine: '',
  orderGroup: '',
  orderPerson: '',
  location: '',
  locationCustom: '',
  vehicles: [],
  subject: '',
  workers: [],
  workLogEntries: [],
  editingEntryId: null,
  currentEntry: { ...initialCurrentEntry },
  currentEntryPersons: [],
  expenses: [],
  editingExpenseId: null,
  materials: [],
  uploadedFiles: [],
  
  // 기본정보 Actions
  setAuthor: (author) => set({ author }),
  setVessel: (vessel) => set({ vessel }),
  setEngine: (engine) => set({ engine: engine.toUpperCase() }),
  setOrderGroup: (orderGroup) => set({ orderGroup, orderPerson: '' }),
  setOrderPerson: (orderPerson) => set({ orderPerson }),
  setLocation: (location) => set({ location, locationCustom: location === 'OTHER' ? get().locationCustom : '' }),
  setLocationCustom: (locationCustom) => set({ locationCustom }),
  toggleVehicle: (vehicle) => set((state) => ({
    vehicles: state.vehicles.includes(vehicle)
      ? state.vehicles.filter((v) => v !== vehicle)
      : [...state.vehicles, vehicle],
  })),
  setVehicles: (vehicles) => set({ vehicles }),
  setSubject: (subject) => set({ subject }),
  
  // 작업자 Actions
  addWorker: (name) => set((state) => {
    const trimmed = name.trim();
    if (!trimmed || state.workers.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      return state;
    }
    return { workers: [...state.workers, trimmed] };
  }),
  setWorkers: (workers) => set({ workers }),
  removeWorker: (name) => set((state) => ({
    workers: state.workers.filter((w) => w !== name),
  })),
  addWorkersByRegion: (region) => set((state) => {
    const regionWorkers = REGION_GROUPS[region] || [];
    const newWorkers = regionWorkers.filter(
      (w) => !state.workers.some((existing) => existing.toLowerCase() === w.toLowerCase())
    );
    return { workers: [...state.workers, ...newWorkers] };
  }),
  
  // 상세정보 Actions
  setCurrentEntry: (entry) => set((state) => ({
    currentEntry: { ...state.currentEntry, ...entry },
  })),
  addCurrentEntryPerson: (name) => set((state) => {
    if (state.currentEntryPersons.includes(name)) return state;
    return { currentEntryPersons: [...state.currentEntryPersons, name] };
  }),
  removeCurrentEntryPerson: (name) => set((state) => ({
    currentEntryPersons: state.currentEntryPersons.filter((p) => p !== name),
  })),
  addAllCurrentEntryPersons: () => set((state) => ({
    currentEntryPersons: [...state.workers],
  })),
  addRegionPersonsToEntry: (region) => set((state) => {
    const regionWorkers = REGION_GROUPS[region] || [];
    const validWorkers = regionWorkers.filter((w) =>
      state.workers.includes(w) && !state.currentEntryPersons.includes(w)
    );
    return { currentEntryPersons: [...state.currentEntryPersons, ...validWorkers] };
  }),
  saveWorkLogEntry: (onError?: (message: string) => void) => set((state) => {
    const { currentEntry, currentEntryPersons, editingEntryId, workLogEntries } = state;
    
    if (!currentEntry.dateFrom || !currentEntry.dateTo || !currentEntry.descType || !currentEntry.details || currentEntryPersons.length === 0) {
      const errorMessage = '필수 항목을 모두 입력해주세요.';
      if (onError) {
        onError(errorMessage);
      }
      // onError가 없으면 에러만 무시 (alert 제거)
      return state;
    }
    
    const entry: WorkLogEntry = {
      id: editingEntryId ?? Date.now(),
      dateFrom: currentEntry.dateFrom || '',
      timeFrom: currentEntry.timeFrom || '',
      dateTo: currentEntry.dateTo || '',
      timeTo: currentEntry.timeTo || '',
      descType: currentEntry.descType as WorkLogEntry['descType'],
      details: currentEntry.details || '',
      persons: [...currentEntryPersons],
      note: currentEntry.note || '',
      noLunch: currentEntry.noLunch || false,
      moveFrom: currentEntry.moveFrom,
      moveTo: currentEntry.moveTo,
    };
    
    // 다음 엔트리의 시작 시간을 현재 종료 시간으로 자동 설정
    const nextEntry = {
      ...initialCurrentEntry,
      dateFrom: currentEntry.dateTo || '',
      timeFrom: currentEntry.timeTo || '',
      dateTo: currentEntry.dateTo || '',
    };
    
    if (editingEntryId) {
      return {
        workLogEntries: workLogEntries.map((e) => (e.id === editingEntryId ? entry : e)),
        currentEntry: nextEntry,
        currentEntryPersons: [],
        editingEntryId: null,
      };
    }
    
    return {
      workLogEntries: [...workLogEntries, entry],
      currentEntry: nextEntry,
      currentEntryPersons: [],
    };
  }),
  setWorkLogEntries: (entries) => set({ workLogEntries: entries }),
  deleteWorkLogEntry: (id) => set((state) => ({
    workLogEntries: state.workLogEntries.filter((e) => e.id !== id),
  })),
  editWorkLogEntry: (id) => set((state) => {
    const entry = state.workLogEntries.find((e) => e.id === id);
    if (!entry) return state;
    return {
      editingEntryId: id,
      currentEntry: {
        dateFrom: entry.dateFrom,
        timeFrom: entry.timeFrom,
        dateTo: entry.dateTo,
        timeTo: entry.timeTo,
        descType: entry.descType,
        details: entry.details,
        note: entry.note,
        noLunch: entry.noLunch,
        moveFrom: entry.moveFrom,
        moveTo: entry.moveTo,
      },
      currentEntryPersons: [...entry.persons],
    };
  }),
  cancelEditEntry: () => set({
    editingEntryId: null,
    currentEntry: { ...initialCurrentEntry },
    currentEntryPersons: [],
  }),
  
  // 지출내역 Actions
  addExpense: (expense) => set((state) => ({
    expenses: [...state.expenses, { ...expense, id: Date.now() }],
    editingExpenseId: null,
  })),
  setExpenses: (expenses) => set({ expenses }),
  updateExpense: (id, expense) => set((state) => ({
    expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...expense } : e)),
    editingExpenseId: null,
  })),
  deleteExpense: (id) => set((state) => ({
    expenses: state.expenses.filter((e) => e.id !== id),
  })),
  editExpense: (id) => set({ editingExpenseId: id }),
  cancelEditExpense: () => set({ editingExpenseId: null }),
  
  // 소모자재 Actions
  addMaterial: (material) => set((state) => ({
    materials: [...state.materials, { ...material, id: Date.now() }],
  })),
  setMaterials: (materials) => set({ materials }),
  removeMaterial: (id) => set((state) => ({
    materials: state.materials.filter((m) => m.id !== id),
  })),
  
  // 첨부파일 Actions
  addFiles: (files, category) => set((state) => {
    const newFiles = files.map((file, index) => ({
      id: Date.now() + index,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      category,
      isExisting: false,
    }));
    return { uploadedFiles: [...state.uploadedFiles, ...newFiles] };
  }),
  addExistingReceipt: (receipt) => set((state) => {
    // 중복 체크: 이미 같은 receiptId가 있는지 확인
    const alreadyExists = state.uploadedFiles.some(
      (f) => f.isExisting && f.receiptId === receipt.receiptId
    );
    
    if (alreadyExists) {
      console.log("이미 존재하는 영수증, 추가하지 않음:", receipt.receiptId);
      return state; // 이미 있으면 추가하지 않음
    }
    
    const newReceipt: UploadedFile = {
      id: Date.now(),
      category: receipt.category,
      receiptId: receipt.receiptId,
      storagePath: receipt.storagePath,
      originalName: receipt.originalName || undefined,
      fileUrl: receipt.fileUrl,
      mimeType: receipt.mimeType || undefined,
      preview: receipt.fileUrl && (receipt.mimeType?.startsWith('image/') || !receipt.mimeType) ? receipt.fileUrl : undefined,
      isExisting: true,
    };
    console.log("새 영수증 추가:", newReceipt);
    return { uploadedFiles: [...state.uploadedFiles, newReceipt] };
  }),
  removeFile: (id) => set((state) => {
    const file = state.uploadedFiles.find((f) => f.id === id);
    if (file?.preview && !file.isExisting) URL.revokeObjectURL(file.preview);
    return { uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id) };
  }),
  
  // 전체 Actions
  resetForm: () => set({
    author: '',
    vessel: '',
    engine: '',
    orderGroup: '',
    orderPerson: '',
    location: '',
    locationCustom: '',
    vehicles: [],
    subject: '',
    workers: [],
    workLogEntries: [],
    editingEntryId: null,
    currentEntry: { ...initialCurrentEntry },
    currentEntryPersons: [],
    expenses: [],
    editingExpenseId: null,
    materials: [],
    uploadedFiles: [],
  }),
  getExpenseTotal: () => get().expenses.reduce((sum, e) => sum + e.amount, 0),
}));

// 유틸리티 함수들
export const formatCurrency = (num: number): string => {
  return num.toLocaleString();
};

export const parseCurrency = (str: string): number => {
  return Number(str.replace(/[^\d]/g, '')) || 0;
};

export const toKoreanTime = (time: string): string => {
  if (!time) return '';
  const [hh, mm] = time.split(':');
  return mm === '00' ? `${Number(hh)}시` : `${Number(hh)}시 ${mm}분`;
};

export const calcDurationHours = (dateFrom: string, timeFrom: string, dateTo: string, timeTo: string, noLunch: boolean = false): number => {
  if (!dateFrom || !dateTo || !timeFrom || !timeTo) return 0;
  const start = new Date(`${dateFrom}T${timeFrom}`);
  const end = new Date(`${dateTo}T${timeTo}`);
  let hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  if (noLunch) hours = Math.max(0, hours - 1);
  return Math.round(hours * 10) / 10;
};

