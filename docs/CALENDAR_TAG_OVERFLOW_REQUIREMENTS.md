# 캘린더 태그 Overflow 처리 요구사항

## 요구사항 요약

캘린더의 각 날짜 셀에서 태그(이벤트)가 셀 높이를 벗어날 때, 넘어가는 태그는 숨기고 "+N개"로 표시해야 합니다.

## 상세 요구사항

### 1. 태그 표시 규칙
- **셀 높이 내에서 최대한 많은 태그를 표시**해야 합니다
- 예: 셀에 2개의 태그를 보여줄 수 있다면, 2개를 모두 보여주고 나머지는 "+N개"로 표시
- 잘못된 예: 1개만 보여주고 "+3개" 표시 ❌
- 올바른 예: 2개를 보여주고 "+2개" 표시 ✅

### 2. Overflow 처리
- 태그가 셀 높이를 **조금이라도 벗어나면** 해당 태그와 이후 태그들을 숨기고 "+N개"로 표시
- 태그가 셀 밖으로 **튀어나가면 안 됩니다** (overflow-hidden 적용)
- 태그가 잘리면 반드시 "+N개"로 표시되어야 합니다

### 3. 공간 최적화
- "+N개" 텍스트가 **없을 때**는 태그가 표시되는 높이만큼만 사용 (불필요한 하단 여백 최소화)
- "+N개" 텍스트가 **있을 때**만 하단 여백을 확보하여 "+N개" 표시 공간 확보

## 관련 파일

### 핵심 파일
1. **`src/components/calendar/WeekRow.tsx`**
   - 각 날짜별로 표시 가능한 태그 계산
   - 태그 overflow 체크 로직
   - hiddenCount 계산 및 전달

2. **`src/components/calendar/DayCell.tsx`**
   - hiddenCount를 받아서 "+N개" 표시
   - overflow-hidden 스타일 적용

3. **`src/components/common/CalendarTag.tsx`**
   - 개별 태그 컴포넌트 (수정 불필요)

### 참고 파일
4. **`src/pages/Dashboard/DashboardPage.tsx`**
   - 캘린더 메인 페이지
   - cellHeights 측정 로직
   - tagHeight, tagSpacing 값 전달

## 주요 로직 설명

### WeekRow.tsx의 핵심 로직

```typescript
// 1. 각 날짜별로 태그가 셀 높이를 벗어나는지 확인
const isTagOverflowingForDate = (segment, dayIdx, bottomPadding) => {
  const cellHeight = cellHeights[dateKey] || 0;
  const tagTop = dateHeaderHeight + segment.rowIndex * (tagHeight + tagSpacing);
  const tagBottom = tagTop + tagHeight;
  // 태그의 하단이 셀 높이에서 하단 여백을 뺀 영역을 넘어가면 overflow
  return tagBottom > (cellHeight - bottomPadding);
};

// 2. 최소 여백으로 최대한 많이 표시
const visibleWithMinPadding = [];
for (const segment of sortedSegments) {
  if (!isTagOverflowingForDate(segment, dayIdx, minBottomPadding)) {
    visibleWithMinPadding.push(segment);
  } else {
    break; // 넘어가면 더 이상 추가하지 않음
  }
}

// 3. bottomPadding을 늘려서 최대한 많이 표시 (+N개 공간 확보)
const visibleWithMaxPadding = [];
for (const segment of sortedSegments) {
  if (!isTagOverflowingForDate(segment, dayIdx, bottomPaddingForHiddenCount)) {
    visibleWithMaxPadding.push(segment);
  } else {
    break;
  }
}

// 4. 숨겨진 태그 개수 계산
const hiddenCount = dayEvents.filter(
  (event) => !visibleEventIds.has(event.id)
).length;
```

### DayCell.tsx의 표시 로직

```typescript
// hiddenCount가 0보다 크면 "+N개" 표시
{hiddenCount > 0 && (
  <div className="absolute inset-x-0 bottom-0 ...">
    <div>+{hiddenCount}개</div>
  </div>
)}
```

## 주요 상수값

- `dateHeaderHeight = 48`: 날짜 헤더 높이
- `bottomPaddingForHiddenCount = 20`: "+N개" 표시 공간 (hiddenCount가 있을 때만 사용)
- `minBottomPadding = 2`: 최소 하단 여백 ("+N개"가 없을 때 사용)
- `tagHeight = 24`: 태그 높이 (DashboardPage에서 전달)
- `tagSpacing = 4`: 태그 간격 (DashboardPage에서 전달)

## 현재 문제점

1. **태그가 셀 밖으로 튀어나감**: overflow-hidden이 제대로 작동하지 않음
2. **"+N개"가 표시되지 않음**: hiddenCount가 제대로 계산되지 않거나 전달되지 않음
3. **최대한 많은 태그를 표시하지 않음**: 로직이 너무 보수적으로 작동

## 해결 방향

1. 각 날짜별로 셀 높이를 정확히 체크
2. 태그가 셀 높이를 벗어나면 반드시 숨기고 hiddenCount 증가
3. hiddenCount > 0이면 반드시 "+N개" 표시
4. WeekRow와 DayCell 모두에 overflow-hidden 적용
5. 셀 높이 내에서 최대한 많은 태그를 표시하되, 넘어가는 태그는 절대 표시하지 않음

## 테스트 시나리오

1. **태그가 2개 보여질 수 있는 경우**
   - 입력: 태그 4개, 셀 높이로 2개 표시 가능
   - 기대: 태그 2개 표시 + "+2개" 표시

2. **태그가 셀 높이를 벗어나는 경우**
   - 입력: 태그가 셀 높이를 조금이라도 벗어남
   - 기대: 해당 태그 숨김 + "+N개" 표시

3. **태그가 모두 들어가는 경우**
   - 입력: 모든 태그가 셀 높이 내에 있음
   - 기대: 모든 태그 표시, "+N개" 없음

