import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }

  const supportedMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  return supportedMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
}

export default function VoiceRecorder({
  value,
  onChange,
  disabled = false,
}) {
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(null)
  const previewUrlRef = useRef('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
  }, [])

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const handleStartRecording = async () => {
    if (disabled || isRecording) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Браузер не поддерживает доступ к микрофону.')
      return
    }

    if (typeof MediaRecorder === 'undefined') {
      setErrorMessage('В этом браузере недоступна запись голоса через MediaRecorder.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      streamRef.current = stream
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      setErrorMessage('')

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = (event) => {
        console.error('Ошибка MediaRecorder.', event.error)
        setErrorMessage(event.error?.message || 'Не удалось записать голосовое сообщение.')
      }

      recorder.onstop = () => {
        const nextMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: nextMimeType })
        const durationSeconds = startedAtRef.current
          ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
          : null
        const nextPreviewUrl = URL.createObjectURL(blob)

        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
        }

        previewUrlRef.current = nextPreviewUrl
        setPreviewUrl(nextPreviewUrl)

        onChange({
          blob,
          mimeType: nextMimeType,
          durationSeconds,
        })

        chunksRef.current = []
        startedAtRef.current = null
        mediaRecorderRef.current = null
        setIsRecording(false)
        stopStream()
      }

      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Ошибка доступа к микрофону.', error)
      setErrorMessage(error.message || 'Не удалось получить доступ к микрофону.')
      stopStream()
    }
  }

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return
    }

    mediaRecorderRef.current.stop()
  }

  const handleClearRecording = () => {
    mediaRecorderRef.current = null

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }

    setPreviewUrl('')
    onChange(null)
    setErrorMessage('')
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-600/15 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-600/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic size={16} />
            Записать голос
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopRecording}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            <Square size={16} />
            Стоп
          </button>
        )}

        <span className="text-sm text-slate-400">
          {isRecording
            ? 'Идет запись... говори в микрофон и нажми «Стоп»'
            : value?.blob
              ? 'Голосовая заметка готова к сохранению'
              : 'Можно сохранить задачу только голосом, без текста'}
        </span>
      </div>

      {previewUrl && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
          <audio controls preload="metadata" className="w-full" src={previewUrl}>
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {value?.durationSeconds ? `Длительность: ${value.durationSeconds} сек.` : 'Длительность не определена'}
            </span>
            <button
              type="button"
              onClick={handleClearRecording}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Trash2 size={14} />
              Удалить запись
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
