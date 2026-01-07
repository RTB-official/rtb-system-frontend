import React from 'react'
import EventForm from './EventForm'
import BaseModal from './ui/BaseModal'
import Button from './common/Button'
import { CalendarEvent } from '../types'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  initialDate?: string
  initialEndDate?: string
  editingEvent?: CalendarEvent | null
  onSave?: (data: {
    title: string
    startDate: string
    startTime?: string
    endDate: string
    endTime?: string
    allDay: boolean
  }) => void
}

export default function EventModal({ isOpen, onClose, initialDate, initialEndDate, editingEvent, onSave }: EventModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEvent ? "일정 수정" : "일정 추가"}
      maxWidth="max-w-[640px]"
    >
      <EventForm onClose={onClose} initialDate={initialDate} initialEndDate={initialEndDate} editingEvent={editingEvent} onSave={onSave} />
    </BaseModal>
  )
}


