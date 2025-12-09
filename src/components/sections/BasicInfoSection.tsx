import SectionCard from '../ui/SectionCard';
import TextInput from '../ui/TextInput';
import Select from '../ui/Select';
import Chip from '../ui/Chip';
import { useWorkReportStore, ORDER_PERSONS, LOCATIONS, VEHICLES } from '../../store/workReportStore';

export default function BasicInfoSection() {
  const {
    author, setAuthor,
    vessel, setVessel,
    engine, setEngine,
    orderGroup, setOrderGroup,
    orderPerson, setOrderPerson,
    location, setLocation,
    locationCustom, setLocationCustom,
    vehicles, toggleVehicle,
    subject, setSubject,
  } = useWorkReportStore();

  // 참관 감독 그룹 옵션
  const orderGroupOptions = [
    { value: 'ELU', label: 'Everllence-ELU' },
    { value: 'PRIME', label: 'Everllence-Prime' },
    { value: 'OTHER', label: '기타(직접입력)' },
  ];

  // 그룹에 따른 인원 옵션
  const orderPersonOptions = orderGroup && orderGroup !== 'OTHER'
    ? (ORDER_PERSONS[orderGroup] || []).map(name => ({ value: name, label: name }))
    : [];

  // 출장지 옵션
  const locationOptions = [
    ...LOCATIONS.map(loc => ({ value: loc, label: loc })),
    { value: 'OTHER', label: '기타(직접입력)' },
  ];

  return (
    <SectionCard title="기본 정보">
      <div className="flex flex-col gap-5 md:gap-7">
        {/* 작성자 */}
        <TextInput 
          label="작성자" 
          placeholder="이름을 입력해 주세요" 
          required
          value={author}
          onChange={setAuthor}
        />

        {/* 참관감독 선택 */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <Select 
            label="참관감독" 
            placeholder="그룹 선택" 
            className="flex-1"
            options={orderGroupOptions}
            value={orderGroup}
            onChange={setOrderGroup}
          />
          {orderGroup === 'OTHER' ? (
            <TextInput
              placeholder="직급 없이 이름만 기입해 주세요"
              className="flex-1"
              value={orderPerson}
              onChange={setOrderPerson}
            />
          ) : orderGroup ? (
            <Select 
              placeholder="감독 선택" 
              className="flex-1"
              options={orderPersonOptions}
              value={orderPerson}
              onChange={setOrderPerson}
            />
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* 운행차량 */}
        <div className="flex flex-col gap-2">
          <label className="font-medium text-[14px] md:text-[15px] text-[#101828] leading-[1.467]">
            운행차량 (다중 선택 가능)
          </label>
          <div className="flex flex-wrap gap-2">
            {VEHICLES.map((vehicle) => (
              <Chip 
                key={vehicle}
                variant={vehicles.includes(vehicle) ? 'selected' : 'default'}
                onClick={() => toggleVehicle(vehicle)}
              >
                {vehicle}
              </Chip>
            ))}
          </div>
          {vehicles.length > 0 && (
            <p className="text-sm text-[#6a7282]">
              선택됨: {vehicles.join(', ')}
            </p>
          )}
        </div>

        {/* 출장지, 호선명 */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1 flex flex-col gap-2">
            <Select 
              label="출장지" 
              placeholder="출장지 선택" 
              required 
              options={locationOptions}
              value={location}
              onChange={setLocation}
            />
            {location === 'OTHER' && (
              <TextInput
                placeholder="출장지를 직접 입력"
                value={locationCustom}
                onChange={setLocationCustom}
              />
            )}
          </div>
          <TextInput 
            label="호선명" 
            placeholder="예) 한국호" 
            className="flex-1"
            value={vessel}
            onChange={setVessel}
          />
        </div>

        {/* 출장목적 */}
        <TextInput 
          label="출장목적" 
          placeholder="선박 점검 및 정비" 
          required
          value={subject}
          onChange={setSubject}
        />

        {/* 엔진타입 */}
        <TextInput 
          label="엔진타입" 
          placeholder="엔진 타입을 입력해 주세요"
          value={engine}
          onChange={setEngine}
          uppercase
        />
      </div>
    </SectionCard>
  );
}
