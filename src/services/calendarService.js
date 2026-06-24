import { formatLocalDate } from '../lib/dateUtils'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const CALENDAR_ITEMS_KEY = 'learning_calendar_items'
const AUDIO_BUCKET = 'calendar-voice-notes'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

export const CALENDAR_ITEM_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
}

const canUseRemoteStorage = (userId) => Boolean(isSupabaseConfigured && supabase && userId)

const logAndThrow = (message, error) => {
  console.error(message, error)
  throw error
}

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const readLocalCalendarItems = () => parseJson(localStorage.getItem(CALENDAR_ITEMS_KEY), [])

const writeLocalCalendarItems = (items) => {
  localStorage.setItem(CALENDAR_ITEMS_KEY, JSON.stringify(items))
}

const resolveCurrentUserId = async (candidateUserId) => {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }

  if (candidateUserId) {
    return candidateUserId
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    logAndThrow('Не удалось получить пользователя Supabase для календаря.', error)
  }

  return user?.id ?? null
}

const getAudioExtension = (mimeType) => {
  if (!mimeType) {
    return 'webm'
  }

  if (mimeType.includes('ogg')) {
    return 'ogg'
  }

  if (mimeType.includes('mp4')) {
    return 'mp4'
  }

  if (mimeType.includes('mpeg')) {
    return 'mp3'
  }

  return 'webm'
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()

  reader.onloadend = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать аудиофайл.'))
  reader.readAsDataURL(blob)
})

const sortByCreatedAtDesc = (items) => (
  [...items].sort(
    (left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime(),
  )
)

const mapCalendarItem = async (item, { isRemote }) => {
  if (item.item_type !== CALENDAR_ITEM_TYPES.VOICE || !item.audio_path) {
    return {
      ...item,
      audioUrl: null,
    }
  }

  const audioUrl = isRemote
    ? await getVoiceNoteUrl(item.audio_path)
    : item.audio_path

  return {
    ...item,
    audioUrl,
  }
}

export const getVoiceNoteUrl = async (audioPath) => {
  if (!audioPath) {
    return null
  }

  if (!isSupabaseConfigured || !supabase) {
    return audioPath
  }

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS)

  if (error) {
    logAndThrow('Не удалось получить ссылку на голосовое сообщение.', error)
  }

  return data?.signedUrl ?? null
}

export const getCalendarItemsByDate = async (date, { userId } = {}) => {
  const itemDate = formatLocalDate(date)
  const remoteUserId = await resolveCurrentUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    const localItems = readLocalCalendarItems()
      .filter((item) => item.item_date === itemDate && item.completed_at == null)

    const mapped = await Promise.all(
      localItems.map((item) => mapCalendarItem(item, { isRemote: false })),
    )

    return sortByCreatedAtDesc(mapped)
  }

  const { data, error } = await supabase
    .from('calendar_items')
    .select('*')
    .eq('user_id', remoteUserId)
    .eq('item_date', itemDate)
    .is('completed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    logAndThrow('Не удалось загрузить календарные задачи из Supabase.', error)
  }

  const mapped = await Promise.all(
    (data ?? []).map((item) => mapCalendarItem(item, { isRemote: true })),
  )

  return mapped
}

export const createTextTask = async (date, text, { userId } = {}) => {
  const itemDate = formatLocalDate(date)
  const remoteUserId = await resolveCurrentUserId(userId)
  const trimmedText = text.trim()

  if (!trimmedText) {
    throw new Error('Введите текст задачи перед сохранением.')
  }

  if (!canUseRemoteStorage(remoteUserId)) {
    const nextItem = {
      id: crypto.randomUUID(),
      user_id: null,
      item_date: itemDate,
      item_type: CALENDAR_ITEM_TYPES.TEXT,
      text_content: trimmedText,
      audio_path: null,
      audio_mime_type: null,
      audio_duration_seconds: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    writeLocalCalendarItems([nextItem, ...readLocalCalendarItems()])

    return {
      ...nextItem,
      audioUrl: null,
    }
  }

  const { data, error } = await supabase
    .from('calendar_items')
    .insert({
      user_id: remoteUserId,
      item_date: itemDate,
      item_type: CALENDAR_ITEM_TYPES.TEXT,
      text_content: trimmedText,
    })
    .select()
    .single()

  if (error) {
    logAndThrow('Не удалось сохранить текстовую задачу в Supabase.', error)
  }

  return {
    ...data,
    audioUrl: null,
  }
}

export const createVoiceNote = async (
  date,
  audioBlob,
  { userId, durationSeconds = null, mimeType = null } = {},
) => {
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new Error('Голосовое сообщение пустое. Запишите его заново.')
  }

  const itemDate = formatLocalDate(date)
  const resolvedMimeType = mimeType || audioBlob.type || 'audio/webm'
  const remoteUserId = await resolveCurrentUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    const audioDataUrl = await blobToDataUrl(audioBlob)
    const nextItem = {
      id: crypto.randomUUID(),
      user_id: null,
      item_date: itemDate,
      item_type: CALENDAR_ITEM_TYPES.VOICE,
      text_content: null,
      audio_path: audioDataUrl,
      audio_mime_type: resolvedMimeType,
      audio_duration_seconds: durationSeconds,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    writeLocalCalendarItems([nextItem, ...readLocalCalendarItems()])

    return {
      ...nextItem,
      audioUrl: audioDataUrl,
    }
  }

  const fileExtension = getAudioExtension(resolvedMimeType)
  const filePath = `${remoteUserId}/${itemDate}/${crypto.randomUUID()}.${fileExtension}`

  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filePath, audioBlob, {
      upsert: false,
      contentType: resolvedMimeType,
    })

  if (uploadError) {
    logAndThrow(
      'Не удалось загрузить голосовое сообщение в Supabase Storage. Проверьте bucket calendar-voice-notes и storage policies.',
      uploadError,
    )
  }

  const { data, error } = await supabase
    .from('calendar_items')
    .insert({
      user_id: remoteUserId,
      item_date: itemDate,
      item_type: CALENDAR_ITEM_TYPES.VOICE,
      audio_path: filePath,
      audio_mime_type: resolvedMimeType,
      audio_duration_seconds: durationSeconds,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove([filePath])
    logAndThrow('Не удалось сохранить запись о голосовом сообщении в Supabase.', error)
  }

  return {
    ...data,
    audioUrl: await getVoiceNoteUrl(filePath),
  }
}

export const completeCalendarItem = async (id, { userId } = {}) => {
  const remoteUserId = await resolveCurrentUserId(userId)
  const completedAt = new Date().toISOString()

  if (!canUseRemoteStorage(remoteUserId)) {
    const nextItems = readLocalCalendarItems().map((item) => (
      String(item.id) === String(id)
        ? {
            ...item,
            completed_at: completedAt,
            updated_at: completedAt,
          }
        : item
    ))

    writeLocalCalendarItems(nextItems)
    return
  }

  const { error } = await supabase
    .from('calendar_items')
    .update({
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', id)
    .eq('user_id', remoteUserId)

  if (error) {
    logAndThrow('Не удалось отметить календарную задачу выполненной.', error)
  }
}
