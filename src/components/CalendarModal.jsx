import { DayPicker } from 'react-day-picker'
import { X } from 'lucide-react'
import { ru } from 'date-fns/locale'
import { getLocalTimeZone } from '../lib/dateUtils'
import './calendar.css'

const timeZone = getLocalTimeZone()

export default function CalendarModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Календарь задач</h2>
            <p className="mt-1 text-sm text-slate-400">
              Выбери дату, чтобы открыть задачи и голосовые заметки на этот день.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-700/60 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Закрыть календарь"
          >
            <X size={20} />
          </button>
        </div>

        <div className="calendar-shell rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <DayPicker
            animate
            locale={ru}
            mode="single"
            navLayout="around"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onSelectDate(date)
              }
            }}
            defaultMonth={selectedDate}
            showOutsideDays
            fixedWeeks
            timeZone={timeZone}
          />
        </div>
      </div>
    </div>
  )
}
