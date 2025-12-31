import React from 'react'
import { useNavigate } from 'react-router-dom'
import EventForm from './EventForm'
import { IconCalendar, IconUpload } from './icons/Icons'

interface Props {
  onClose?: () => void
  style?: React.CSSProperties
  selectedDate?: string | null
}

export default function CalendarMenu({ onClose, style, selectedDate }: Props) {
  const navigate = useNavigate()
  const [active, setActive] = React.useState<string | null>(null)
  const [panelTop, setPanelTop] = React.useState<number>(0)
  const [panelLeft, setPanelLeft] = React.useState<number | null>(null)
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const openPanel = (label: string) => {
    const el = refs.current[label]
    const top = el ? el.offsetTop : 0
    setPanelTop(top)
    setActive(label)
  }

  // compute small panel position so it stays within viewport
  React.useLayoutEffect(() => {
    if (!active) {
      setPanelLeft(null)
      return
    }
    const panelWidth = 320
    const panelHeight = 260
    const root = rootRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()

    // desired to the right of menu (+8px)
    const desiredLeft = rootRect.width + 8

    // compute absolute top of panel and clamp within viewport
    const absTop = rootRect.top + panelTop
    const maxAbsTop = window.innerHeight - panelHeight - 8
    const clampedAbsTop = Math.max(8, Math.min(absTop, maxAbsTop))
    const relativeTop = clampedAbsTop - rootRect.top
    setPanelTop(Math.max(0, Math.round(relativeTop)))

    // decide left: try right, else place to left of menu
    const spaceRight = window.innerWidth - rootRect.right
    let finalLeft = desiredLeft
    if (spaceRight < panelWidth + 8) {
      // place to left of menu
      finalLeft = -panelWidth - 8
      // ensure doesn't overflow left edge of viewport
      const absLeft = rootRect.left + finalLeft
      if (absLeft < 8) {
        finalLeft = 8 - rootRect.left
      }
    }
    setPanelLeft(Math.round(finalLeft))

    const onResize = () => {
      // recalc on resize
      const r = root.getBoundingClientRect()
      const spaceR = window.innerWidth - r.right
      let fLeft = desiredLeft
      if (spaceR < panelWidth + 8) {
        fLeft = -panelWidth - 8
        const absLeft = r.left + fLeft
        if (absLeft < 8) fLeft = 8 - r.left
      }
      setPanelLeft(Math.round(fLeft))
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize)
    }
  }, [active, panelTop])

  return (
    <div
      ref={rootRef}
      className="bg-white border border-gray-100 flex flex-col gap-1 p-2 relative rounded-md"
      style={{
        width: 160,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
      data-node-id="995:12291"
    >
      <MenuItem ref={(el)=> (refs.current['일정 추가']=el)} icon={<IconCalendar className="w-5 h-5" />} label="일정 추가" onClick={() => openPanel('일정 추가')} />
      <MenuItem
        ref={(el) => (refs.current['휴가 등록'] = el)}
        icon={<IconUpload className="w-5 h-5" />}
        label="휴가 등록"
        onClick={() => {
          const q = selectedDate ? `?date=${encodeURIComponent(selectedDate)}&open=1` : '?open=1'
          navigate(`/vacation${q}`)
          onClose && onClose()
        }}
      />
      <MenuItem
        ref={(el)=> (refs.current['개인 지출']=el)}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" fill="#374151" />
          </svg>
        }
        label="개인 지출"
        onClick={() => {
          const q = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ''
          navigate(`/expense${q}`)
          onClose && onClose()
        }}
      />

      {active && (
        <div
          className="absolute z-50 bg-white border border-gray-100 rounded-md shadow p-3"
          style={{
            left: panelLeft != null ? panelLeft : (rootRef.current ? (rootRef.current.clientWidth + 8) : 168),
            top: panelTop,
            width: 320,
            maxWidth: 'calc(100vw - 16px)'
          }}
        >
          <SmallPanel label={active} onClose={() => setActive(null)} />
        </div>
      )}
    </div>
  )
}

const MenuItem = React.forwardRef(function MenuItem(
  { imgSrc, label, onClick, icon }: { imgSrc?: string; icon?: React.ReactNode; label: string; onClick?: () => void },
  ref: React.Ref<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-sm text-left w-full"
      style={{ alignItems: 'center' }}
    >
      <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon ? icon : imgSrc ? <img src={imgSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }} /> : null}
      </div>
      <span style={{ fontSize: 15, fontWeight: 500, color: '#1e2939' }}>{label}</span>
    </button>
  )
})

function SmallPanel({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">{label}</div>
        <button onClick={onClose} className="text-gray-400">✕</button>
      </div>
      <div>
        {/* Render the same form as the modal but compact inside the panel */}
        <EventForm onClose={onClose} />
      </div>
    </div>
  )
}




