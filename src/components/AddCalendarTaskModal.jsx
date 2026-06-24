import { useState } from 'react'
import { Mic, Save, X } from 'lucide-react'
import { formatLongLocalDate } from '../lib/dateUtils'
import VoiceRecorder from './VoiceRecorder'

export default function AddCalendarTaskModal({
  selectedDate,
  isSaving,
  onClose,
  onSave,
}) {
  const [text, setText] = useState('')
  const [voiceNote, setVoiceNote] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedText = text.trim()

    if (!trimmedText && !voiceNote) {
      setErrorMessage('Добавь текст задачи или запиши голосовое сообщение.')
      return
    }

    setErrorMessage('')

    try {
      await onSave({
        text: trimmedText,
        voiceNote,
      })

      setText('')
      setVoiceNote(null)
    } catch (error) {
      console.error('Ошибка сохранения календарной задачи.', error)
      setErrorMessage(error.message || 'Не удалось сохранить задачу на выбранную дату.')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Добавить задачу</h2>
            <p className="mt-1 text-sm text-slate-400">
              {formatLongLocalDate(selectedDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-700/60 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Закрыть форму добавления задачи"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Текстовая задача</label>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300">
                <Mic size={14} />
                Ниже можно добавить голосовую заметку к этой же дате
              </div>
              <textarea
                rows="4"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Например: решить задачи по матанализу и повторить конспект"
                className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Голосовое сообщение</label>
            <VoiceRecorder value={voiceNote} onChange={setVoiceNote} disabled={isSaving} />
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              <Save size={16} />
              {isSaving ? 'Сохраняем...' : 'Сохранить задачу'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
