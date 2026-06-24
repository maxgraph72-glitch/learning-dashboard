import { CheckCircle2, ListTodo, Mic, Plus, X } from 'lucide-react'
import { formatLongLocalDate } from '../lib/dateUtils'
import { CALENDAR_ITEM_TYPES } from '../services/calendarService'

const itemTypeLabel = {
  [CALENDAR_ITEM_TYPES.TEXT]: 'Текстовая задача',
  [CALENDAR_ITEM_TYPES.VOICE]: 'Голосовая заметка',
}

export default function CalendarTasksModal({
  isOpen,
  selectedDate,
  items,
  isLoading,
  errorMessage,
  isSaving,
  onClose,
  onBack,
  onAddTask,
  onCompleteItem,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{formatLongLocalDate(selectedDate)}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Отмечай выполненные задачи чекбоксом: элемент сразу исчезнет из активного списка.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-700/60 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Закрыть задачи на дату"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Назад к календарю
          </button>
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Добавить задачу
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
              Загружаем задачи на выбранную дату...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-400">
              На этот день задач пока нет
            </div>
          ) : (
            items.filter(Boolean).map((item) => (
              <label
                key={item.id}
                className="flex gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 transition hover:border-slate-600"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500"
                  disabled={isSaving}
                  onChange={() => onCompleteItem(item.id)}
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                      {item.item_type === CALENDAR_ITEM_TYPES.TEXT ? <ListTodo size={12} /> : <Mic size={12} />}
                      {itemTypeLabel[item.item_type]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'без времени'}
                    </span>
                  </div>

                  {item.item_type === CALENDAR_ITEM_TYPES.TEXT ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
                      {item.text_content}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">
                        Голосовая заметка
                        {item.audio_duration_seconds
                          ? ` • ${item.audio_duration_seconds} сек.`
                          : ''}
                      </p>
                      {item.audioUrl ? (
                        <audio
                          controls
                          preload="metadata"
                          className="w-full"
                          src={item.audioUrl}
                        >
                          Ваш браузер не поддерживает воспроизведение аудио.
                        </audio>
                      ) : (
                        <p className="text-sm text-amber-300">
                          Аудио загружено, но ссылка для воспроизведения недоступна.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>

        {items.length > 0 && !isLoading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={14} />
            Выполненные элементы скрываются из активного списка через `completed_at`.
          </div>
        )}
      </div>
    </div>
  )
}
