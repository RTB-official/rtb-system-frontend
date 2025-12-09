import { useState, useMemo, useRef } from 'react';
import SectionCard from '../ui/SectionCard';
import TextInput from '../ui/TextInput';
import Select from '../ui/Select';
import Chip from '../ui/Chip';
import DatePicker from '../ui/DatePicker';
import { useWorkReportStore, calcDurationHours, toKoreanTime, REGION_GROUPS } from '../../store/workReportStore';

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8ZM9 14H7V12H9V14ZM13 14H11V12H13V14ZM17 14H15V12H17V14ZM9 18H7V16H9V18ZM13 18H11V16H13V18ZM17 18H15V16H17V18Z" fill="#6a7282" />
  </svg>
);

const IconEdit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="#99a1af" />
  </svg>
);

const IconDelete = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="#99a1af" />
  </svg>
);

const IconChevron = ({ expanded }: { expanded: boolean }) => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none"
    className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
  >
    <path d="M7 10L12 15L17 10H7Z" fill="#6a7282" />
  </svg>
);

// 시간 선택 옵션
const hourOptions = Array.from({ length: 25 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: `${String(i).padStart(2, '0')}시`,
}));

const minuteOptions = [
  { value: '00', label: '00분' },
  { value: '30', label: '30분' },
];

// 작업 분류 옵션
const descTypeOptions = [
  { value: '작업', label: '작업' },
  { value: '이동', label: '이동' },
  { value: '대기', label: '대기' },
];

// 이동 장소 옵션
const moveFromPlaces = ['자택', '강동동 공장', '출장지', '숙소'];
const moveToPlaces = ['자택', '강동동 공장', '출장지', '숙소'];

export default function WorkLogSection() {
  const {
    workers,
    workLogEntries,
    editingEntryId,
    currentEntry,
    currentEntryPersons,
    setCurrentEntry,
    addCurrentEntryPerson,
    removeCurrentEntryPerson,
    addAllCurrentEntryPersons,
    addRegionPersonsToEntry,
    saveWorkLogEntry,
    deleteWorkLogEntry,
    editWorkLogEntry,
    cancelEditEntry,
    location,
    locationCustom,
  } = useWorkReportStore();

  // 출장지 이름
  const siteName = location === 'OTHER' ? locationCustom : location;

  // 경유지 상태
  const [hasDetour, setHasDetour] = useState(false);

  // 폼 영역 ref (수정 시 스크롤용)
  const formRef = useRef<HTMLDivElement>(null);

  // 시간 분리
  const [timeFromHour, timeFromMin] = (currentEntry.timeFrom || '').split(':');
  const [timeToHour, timeToMin] = (currentEntry.timeTo || '').split(':');

  const handleTimeChange = (type: 'from' | 'to', part: 'hour' | 'min', value: string) => {
    if (type === 'from') {
      const hour = part === 'hour' ? value : timeFromHour || '00';
      const min = part === 'min' ? value : timeFromMin || '00';
      setCurrentEntry({ timeFrom: `${hour}:${min}` });
    } else {
      const hour = part === 'hour' ? value : timeToHour || '00';
      const min = part === 'min' ? value : timeToMin || '00';
      setCurrentEntry({ timeTo: `${hour}:${min}` });
    }
  };

  // 이동 상세내용 자동 생성
  const handleMovePlace = (type: 'from' | 'to', place: string) => {
    const resolvedPlace = place === '출장지' ? (siteName || '출장지') : place;
    if (type === 'from') {
      setCurrentEntry({ moveFrom: resolvedPlace });
      updateMoveDetails(resolvedPlace, currentEntry.moveTo, hasDetour);
    } else {
      setCurrentEntry({ moveTo: resolvedPlace });
      updateMoveDetails(currentEntry.moveFrom, resolvedPlace, hasDetour);
    }
  };

  // 경유지 토글
  const handleDetourToggle = () => {
    const newHasDetour = !hasDetour;
    setHasDetour(newHasDetour);
    updateMoveDetails(currentEntry.moveFrom, currentEntry.moveTo, newHasDetour);
  };

  // 상세내용 업데이트
  const updateMoveDetails = (from?: string, to?: string, detour?: boolean) => {
    if (from && to) {
      if (detour) {
        setCurrentEntry({ details: `${from}→강동동 공장→${to} 이동.` });
      } else {
        setCurrentEntry({ details: `${from}→${to} 이동.` });
      }
    } else if (from) {
      if (detour) {
        setCurrentEntry({ details: `${from}→강동동 공장→` });
      } else {
        setCurrentEntry({ details: `${from}→` });
      }
    } else if (to) {
      if (detour) {
        setCurrentEntry({ details: `→강동동 공장→${to} 이동.` });
      } else {
        setCurrentEntry({ details: `→${to} 이동.` });
      }
    }
  };

  // 선택 가능한 작업자 (이미 추가된 인원 제외)
  const availableWorkers = workers.filter(w => !currentEntryPersons.includes(w));

  // 카드 확장 상태
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const toggleCard = (id: number) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 엔트리를 시작 시간 기준으로 정렬
  const sortedEntries = useMemo(() => {
    return [...workLogEntries].sort((a, b) => {
      const aKey = `${a.dateFrom}T${a.timeFrom || '00:00'}`;
      const bKey = `${b.dateFrom}T${b.timeFrom || '00:00'}`;
      return aKey.localeCompare(bKey);
    });
  }, [workLogEntries]);

  return (
    <SectionCard title="출장 업무 일지">
      <div className="flex flex-col gap-5">
        {/* 입력 폼 */}
        <div ref={formRef} className="flex flex-col gap-5 scroll-mt-24">
          {/* 시작/종료 시간 */}
          <div className="rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row">
              {/* 시작 */}
              <div className="flex-1 p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <p className="font-semibold text-[14px] text-slate-700">시작</p>
                </div>
                <div className="flex flex-col gap-2">
                  <DatePicker
                    value={currentEntry.dateFrom || ''}
                    onChange={(val) => {
                      setCurrentEntry({ dateFrom: val });
                      if (!currentEntry.dateTo) {
                        setCurrentEntry({ dateTo: val });
                      }
                    }}
                    placeholder="날짜 선택"
                  />
                  <div className="flex gap-2">
                    <select
                      value={timeFromHour || ''}
                      onChange={(e) => handleTimeChange('from', 'hour', e.target.value)}
                      className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-[14px] bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                    >
                      <option value="">시</option>
                      {hourOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={timeFromMin || '00'}
                      onChange={(e) => handleTimeChange('from', 'min', e.target.value)}
                      className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-[14px] bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                    >
                      {minuteOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 구분선 */}
              <div className="w-px bg-slate-300 hidden md:block" />
              <div className="h-px bg-slate-300 md:hidden" />

              {/* 종료 */}
              <div className="flex-1 p-4 bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  <p className="font-semibold text-[14px] text-slate-700">종료</p>
                </div>
                <div className="flex flex-col gap-2">
                  <DatePicker
                    value={currentEntry.dateTo || ''}
                    onChange={(val) => setCurrentEntry({ dateTo: val })}
                    placeholder="날짜 선택"
                  />
                  <div className="flex gap-2">
                    <select
                      value={timeToHour || ''}
                      onChange={(e) => handleTimeChange('to', 'hour', e.target.value)}
                      className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-[14px] bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                    >
                      <option value="">시</option>
                      {hourOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={timeToMin || '00'}
                      onChange={(e) => handleTimeChange('to', 'min', e.target.value)}
                      className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-[14px] bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                    >
                      {minuteOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 작업 분류 */}
          <div className="flex flex-col gap-3">
            <Select 
              label="유형" 
              placeholder="선택"
              className="w-full sm:w-40"
              options={descTypeOptions}
              value={currentEntry.descType || ''}
              onChange={(v) => setCurrentEntry({ descType: v as '' | '작업' | '이동' | '대기' })}
            />
          </div>

          {/* 이동일 때 From/To 선택 */}
          {currentEntry.descType === '이동' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-medium text-[14px] text-[#101828] mb-2 block">From</label>
                <div className="flex flex-wrap gap-2 p-3 border border-dashed border-[#e5e7eb] rounded-lg bg-white">
                  {moveFromPlaces.map(place => {
                    const resolvedPlace = place === '출장지' ? (siteName || '출장지') : place;
                    return (
                      <Chip
                        key={place}
                        variant={currentEntry.moveFrom === resolvedPlace ? 'selected' : 'default'}
                        onClick={() => handleMovePlace('from', place)}
                        size="sm"
                      >
                        {place === '출장지' ? (siteName || '출장지') : place}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="font-medium text-[14px] text-[#101828] mb-2 block">To</label>
                <div className="flex flex-wrap gap-2 p-3 border border-dashed border-[#e5e7eb] rounded-lg bg-white">
                  {moveToPlaces.map(place => {
                    const resolvedPlace = place === '출장지' ? (siteName || '출장지') : place;
                    return (
                      <Chip
                        key={place}
                        variant={currentEntry.moveTo === resolvedPlace ? 'selected' : 'default'}
                        onClick={() => handleMovePlace('to', place)}
                        size="sm"
                      >
                        {place === '출장지' ? (siteName || '출장지') : place}
                      </Chip>
                    );
                  })}
                  <Chip
                    variant={hasDetour ? 'region-jy' : 'default'}
                    onClick={handleDetourToggle}
                    size="sm"
                  >
                    강동동 공장 경유
                  </Chip>
                </div>
              </div>
            </div>
          )}

          {/* 상세내용 */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">상세내용</label>
            <textarea
              placeholder="수행한 업무 내용을 자세히 기록해주세요"
              value={currentEntry.details || ''}
              onChange={(e) => setCurrentEntry({ details: e.target.value })}
              className="w-full min-h-[80px] p-3 border border-[#e5e7eb] rounded-xl text-[16px] resize-none outline-none focus:border-[#9ca3af]"
            />
          </div>

          {/* 참여 인원 선택 */}
          <div className="flex flex-col gap-3">
            <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">참여 인원 선택</label>
            
            {/* 선택 가능한 작업자 */}
            <div className="border border-[#e5e7eb] rounded-xl p-4">
              <p className="text-[13px] text-[#6a7282] mb-2">작업자 클릭하여 추가</p>
              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {availableWorkers.length === 0 ? (
                  <p className="text-[#99a1af] text-sm">모든 작업자가 추가됨</p>
                ) : (
                  availableWorkers.map(worker => (
                    <Chip
                      key={worker}
                      variant="default"
                      onClick={() => addCurrentEntryPerson(worker)}
                    >
                      {worker}
                    </Chip>
                  ))
                )}
              </div>
            </div>

            {/* 빠른 추가 버튼들 */}
            <div className="flex flex-wrap gap-2">
              <Chip variant="gray" onClick={addAllCurrentEntryPersons} size="sm">
                모두 추가
              </Chip>
              <Chip variant="region-bc" onClick={() => addRegionPersonsToEntry('BC')} size="sm">
                부산/창원
              </Chip>
              <Chip variant="region-ul" onClick={() => addRegionPersonsToEntry('UL')} size="sm">
                울산
              </Chip>
              <Chip variant="region-jy" onClick={() => addRegionPersonsToEntry('JY')} size="sm">
                정관/양산
              </Chip>
              <Chip variant="region-gj" onClick={() => addRegionPersonsToEntry('GJ')} size="sm">
                거제
              </Chip>
            </div>

            {/* 선택된 인원 */}
            <div className="border-2 border-[#2b7fff] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 13.475L4.025 10L2.8375 11.175L7.5 15.8375L17.5 5.8375L16.325 4.6625L7.5 13.475Z" fill="#2b7fff" />
                </svg>
                <span className="font-medium text-[15px] text-[#101828]">선택된 작업자</span>
                <span className="text-[14px] text-[#99a1af]">{currentEntryPersons.length}명</span>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {currentEntryPersons.length === 0 ? (
                  <p className="text-[#99a1af] text-sm">인원을 선택해주세요</p>
                ) : (
                  currentEntryPersons.map(person => (
                    <Chip
                      key={person}
                      variant="tag"
                      onRemove={() => removeCurrentEntryPerson(person)}
                    >
                      {person}
                    </Chip>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 작업일 때 점심 체크박스 */}
          {currentEntry.descType === '작업' && (
            <label className="flex items-start gap-3 p-3 border border-[#e5e7eb] rounded-xl bg-[#fffbeb] cursor-pointer hover:bg-[#fef3c7] transition-colors">
              <input 
                type="checkbox"
                checked={currentEntry.noLunch || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCurrentEntry({ noLunch: checked });
                  // 특이사항에 자동 추가/제거
                  const noLunchText = '점심 안먹고 작업진행(12:00~13:00)';
                  const currentNote = currentEntry.note || '';
                  if (checked) {
                    if (!currentNote.includes(noLunchText)) {
                      setCurrentEntry({ note: currentNote ? `${currentNote}\n${noLunchText}` : noLunchText });
                    }
                  } else {
                    setCurrentEntry({ 
                      note: currentNote
                        .replace(noLunchText, '')
                        .replace(/\n{2,}/g, '\n')
                        .trim() 
                    });
                  }
                }}
                className="w-5 h-5 mt-0.5 accent-amber-500"
              />
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-[#92400e]">점심 안먹고 작업진행(12:00~13:00)</span>
                <span className="text-[12px] text-[#b45309]">※운항선 작업일 때 체크해주세요.</span>
              </div>
            </label>
          )}

          {/* 특이사항 */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">특이사항</label>
            <textarea
              placeholder="특이사항이 있으면 입력해주세요"
              value={currentEntry.note || ''}
              onChange={(e) => setCurrentEntry({ note: e.target.value })}
              className="w-full min-h-[60px] p-3 border border-[#e5e7eb] rounded-xl text-[16px] resize-none outline-none focus:border-[#9ca3af]"
            />
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex gap-3">
          <button 
            onClick={() => {
              saveWorkLogEntry();
              setHasDetour(false);
            }}
            className="flex-1 h-12 bg-[#364153] rounded-xl flex items-center justify-center text-white font-medium text-[16px] hover:bg-[#1f2937] transition-colors"
          >
            {editingEntryId ? '수정 저장' : '저장'}
          </button>
          {editingEntryId && (
            <button 
              onClick={() => {
                cancelEditEntry();
                setHasDetour(false);
              }}
              className="h-12 px-6 border border-[#e5e7eb] rounded-xl flex items-center justify-center font-medium text-[16px] hover:bg-[#f3f4f6] transition-colors"
            >
              취소
            </button>
          )}
        </div>

        {/* 저장된 일지 목록 */}
        {sortedEntries.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            {sortedEntries.map((entry, index) => {
              const hours = calcDurationHours(
                entry.dateFrom, 
                entry.timeFrom, 
                entry.dateTo, 
                entry.timeTo,
                entry.noLunch
              );
              const isExpanded = expandedCards[entry.id] ?? false;
              
              // 유형별 스타일 설정
              const typeStyles = {
                '작업': {
                  gradient: 'from-blue-500 to-indigo-600',
                  bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
                  border: 'border-blue-200',
                  badge: 'bg-blue-500',
                  text: 'text-blue-700',
                },
                '이동': {
                  gradient: 'from-emerald-500 to-teal-600',
                  bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                  border: 'border-emerald-200',
                  badge: 'bg-emerald-500',
                  text: 'text-emerald-700',
                },
                '대기': {
                  gradient: 'from-amber-500 to-orange-600',
                  bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                  border: 'border-amber-200',
                  badge: 'bg-amber-500',
                  text: 'text-amber-700',
                },
              };
              const style = typeStyles[entry.descType as keyof typeof typeStyles] || typeStyles['작업'];

              // 날짜 변경 체크
              const prevEntry = sortedEntries[index - 1];
              const showDateSeparator = prevEntry && prevEntry.dateFrom !== entry.dateFrom;

              return (
                <div key={entry.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-rose-300" />
                      <span className="text-[12px] font-medium text-rose-500 px-2">날짜 변경</span>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-rose-300" />
                    </div>
                  )}
                  <div className={`rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border ${style.border} ${style.bg}`}>
                    {/* 상단 컬러바 */}
                    <div className={`h-1 bg-gradient-to-r ${style.gradient}`} />
                    
                    {/* 헤더 (클릭으로 접기/펼치기) */}
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => toggleCard(entry.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {/* 유형 배지 & 시간 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center px-3 py-1 ${style.badge} text-white text-[13px] font-bold rounded-full shadow-sm`}>
                              {entry.descType}
                            </span>
                            <span className={`text-[15px] font-bold ${style.text}`}>
                              {hours}시간
                            </span>
                          </div>
                          
                          {/* 시간 정보 */}
                          <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                            </svg>
                            <span>{entry.dateFrom} {toKoreanTime(entry.timeFrom)}</span>
                            <span className="text-slate-400">→</span>
                            <span>{entry.dateTo} {toKoreanTime(entry.timeTo)}</span>
                          </div>
                          
                          {/* 인원 */}
                          <div className="flex items-center gap-2 text-[13px] text-slate-600">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                            <span className="font-medium">{entry.persons.length}명</span>
                            <span className="text-slate-400">|</span>
                            <span className="truncate max-w-[200px]">{entry.persons.join(', ')}</span>
                          </div>
                        </div>
                        
                        {/* 확장 아이콘 */}
                        <div className={`w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-500">
                            <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* 본문 (확장 시) */}
                    <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="px-4 pb-4 border-t border-white/50">
                        <div className="pt-4 space-y-3">
                          {/* 상세내용 */}
                          <div className="bg-white/60 rounded-xl p-3">
                            <p className="text-[12px] text-slate-500 mb-1">상세내용</p>
                            <p className="text-[14px] text-slate-800">{entry.details || '-'}</p>
                          </div>
                          
                          {/* 특이사항 */}
                          {entry.note && (
                            <div className="bg-white/60 rounded-xl p-3">
                              <p className="text-[12px] text-slate-500 mb-1">특이사항</p>
                              <p className="text-[14px] text-slate-800">{entry.note}</p>
                            </div>
                          )}
                          
                          {/* 액션 버튼 */}
                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                editWorkLogEntry(entry.id);
                                setTimeout(() => {
                                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-[13px] font-medium text-slate-700 transition-all"
                            >
                              <IconEdit /> 수정
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (confirm('삭제하시겠습니까?')) deleteWorkLogEntry(entry.id); 
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-[13px] font-medium text-slate-700 transition-all"
                            >
                              <IconDelete /> 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

