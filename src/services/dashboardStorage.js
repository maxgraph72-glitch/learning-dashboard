import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const CATEGORIES_KEY = 'learning_categories'
const SESSIONS_KEY = 'learning_sessions'

export const DEFAULT_CATEGORIES = ['C# и .NET', 'Мат. анализ', 'Общая физика', 'История', 'Другое']
export const STORAGE_ITEM_TYPES = {
  CATEGORY: 'category',
  SESSION: 'session',
}

const getRecentDate = (daysAgo) => {
  const currentDate = new Date()
  currentDate.setDate(currentDate.getDate() - daysAgo)
  return currentDate.toISOString().split('T')[0]
}

export const DEFAULT_SESSIONS = [
  { id: 1, date: getRecentDate(0), category: 'C# и .NET', duration: 120, comment: 'Разработка интерфейса на WinForms' },
  { id: 2, date: getRecentDate(1), category: 'Мат. анализ', duration: 90, comment: 'Решение матриц и пределов' },
  { id: 3, date: getRecentDate(2), category: 'Общая физика', duration: 60, comment: 'Подготовка к семинару по термодинамике' },
  { id: 4, date: getRecentDate(3), category: 'C# и .NET', duration: 150, comment: 'Алгоритм Литтла' },
  { id: 5, date: getRecentDate(4), category: 'История', duration: 45, comment: 'Доклад про северные территории' },
]

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

const readLocalCategories = () => parseJson(localStorage.getItem(CATEGORIES_KEY), DEFAULT_CATEGORIES)
const readLocalSessions = () => parseJson(localStorage.getItem(SESSIONS_KEY), DEFAULT_SESSIONS)

const writeLocalCategories = (categories) => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
}

const writeLocalSessions = (sessions) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

const canUseRemoteStorage = (userId) => Boolean(isSupabaseConfigured && supabase && userId)

const logAndThrow = (message, error) => {
  console.error(message, error)
  throw error
}

const getRemoteUserId = async (candidateUserId) => {
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
    logAndThrow('Не удалось получить пользователя Supabase для операции с хранилищем.', error)
  }

  return user?.id ?? null
}

const mapCategoryToLocalItem = (categoryName) => ({
  id: `category:${categoryName}`,
  user_id: null,
  title: categoryName,
  description: null,
  value: null,
  item_type: STORAGE_ITEM_TYPES.CATEGORY,
  payload: { name: categoryName },
  created_at: null,
  updated_at: null,
})

const mapSessionToLocalItem = (session) => ({
  id: session.id,
  user_id: null,
  title: session.category,
  description: session.comment,
  value: String(session.duration),
  item_type: STORAGE_ITEM_TYPES.SESSION,
  payload: {
    date: session.date,
    category: session.category,
    duration: session.duration,
    comment: session.comment,
  },
  created_at: null,
  updated_at: null,
})

const mapRowToSession = (row) => ({
  id: row.id,
  date: row.payload?.date ?? row.created_at?.split('T')[0] ?? getRecentDate(0),
  category: row.payload?.category ?? row.title,
  duration: Number(row.payload?.duration ?? row.value ?? 0),
  comment: row.payload?.comment ?? row.description ?? 'Без описания',
})

const mapRowToCategory = (row) => row.payload?.name ?? row.title

const mapRemoteItemPayload = (item, userId) => ({
  user_id: userId,
  title: item.title,
  description: item.description ?? null,
  value: item.value ?? null,
  item_type: item.item_type,
  payload: item.payload ?? {},
  updated_at: new Date().toISOString(),
})

const getLocalItems = () => {
  const categories = readLocalCategories().map(mapCategoryToLocalItem)
  const sessions = readLocalSessions().map(mapSessionToLocalItem)
  return [...categories, ...sessions]
}

const updateLocalItemState = (id, updates) => {
  if (updates.item_type === STORAGE_ITEM_TYPES.CATEGORY) {
    const categories = readLocalCategories()
    const currentName = String(id).replace('category:', '')
    const updatedName = updates.title ?? updates.payload?.name ?? currentName
    const nextCategories = categories.map((category) => (category === currentName ? updatedName : category))
    writeLocalCategories(nextCategories)

    const sessions = readLocalSessions().map((session) => (
      session.category === currentName
        ? { ...session, category: updatedName }
        : session
    ))
    writeLocalSessions(sessions)

    return mapCategoryToLocalItem(updatedName)
  }

  const sessions = readLocalSessions()
  const nextSession = sessions.map((session) => {
    if (String(session.id) !== String(id)) {
      return session
    }

    const payload = updates.payload ?? {}

    return {
      ...session,
      date: payload.date ?? session.date,
      category: payload.category ?? updates.title ?? session.category,
      duration: Number(payload.duration ?? updates.value ?? session.duration),
      comment: payload.comment ?? updates.description ?? session.comment,
    }
  })
  writeLocalSessions(nextSession)

  return nextSession.find((session) => String(session.id) === String(id)) ?? null
}

export const getItems = async ({ userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    return getLocalItems()
  }

  const { data, error } = await supabase
    .from('dashboard_items')
    .select('*')
    .eq('user_id', remoteUserId)
    .order('created_at', { ascending: false })

  if (error) {
    logAndThrow('Не удалось загрузить элементы дашборда из Supabase.', error)
  }

  return data ?? []
}

export const createItem = async (item, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    if (item.item_type === STORAGE_ITEM_TYPES.CATEGORY) {
      const categories = readLocalCategories()
      const nextCategories = [...categories, item.title]
      writeLocalCategories(nextCategories)
      return mapCategoryToLocalItem(item.title)
    }

    const payload = item.payload ?? {}
    const nextSession = {
      id: item.id ?? Date.now(),
      date: payload.date ?? getRecentDate(0),
      category: payload.category ?? item.title,
      duration: Number(payload.duration ?? item.value ?? 0),
      comment: payload.comment ?? item.description ?? 'Без описания',
    }
    const sessions = [nextSession, ...readLocalSessions()]
    writeLocalSessions(sessions)
    return nextSession
  }

  const { data, error } = await supabase
    .from('dashboard_items')
    .insert(mapRemoteItemPayload(item, remoteUserId))
    .select()
    .single()

  if (error) {
    logAndThrow('Не удалось добавить элемент в Supabase.', error)
  }

  return data
}

export const updateItem = async (id, updates, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    return updateLocalItemState(id, updates)
  }

  const { data, error } = await supabase
    .from('dashboard_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', remoteUserId)
    .select()
    .single()

  if (error) {
    logAndThrow('Не удалось обновить элемент в Supabase.', error)
  }

  return data
}

export const deleteItem = async (id, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    const categoryId = String(id)

    if (categoryId.startsWith('category:')) {
      const categoryName = categoryId.replace('category:', '')
      const nextCategories = readLocalCategories().filter((category) => category !== categoryName)
      writeLocalCategories(nextCategories)
      return
    }

    const nextSessions = readLocalSessions().filter((session) => String(session.id) !== String(id))
    writeLocalSessions(nextSessions)
    return
  }

  const { error } = await supabase
    .from('dashboard_items')
    .delete()
    .eq('id', id)
    .eq('user_id', remoteUserId)

  if (error) {
    logAndThrow('Не удалось удалить элемент из Supabase.', error)
  }
}

export const getDashboardData = async ({ userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)
  const items = await getItems({ userId: remoteUserId })
  const categories = items
    .filter((item) => item.item_type === STORAGE_ITEM_TYPES.CATEGORY)
    .map(mapRowToCategory)

  const sessions = items
    .filter((item) => item.item_type === STORAGE_ITEM_TYPES.SESSION)
    .map(mapRowToSession)
    .sort((left, right) => new Date(right.date) - new Date(left.date))

  const categoriesFromSessions = [...new Set(sessions.map((session) => session.category))]

  if (canUseRemoteStorage(remoteUserId)) {
    return {
      categories: categories.length > 0 ? categories : categoriesFromSessions,
      sessions,
    }
  }

  return {
    categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
    sessions: sessions.length > 0 ? sessions : DEFAULT_SESSIONS,
  }
}

export const createCategory = async (categoryName, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)
  const created = await createItem({
    title: categoryName,
    description: null,
    value: null,
    item_type: STORAGE_ITEM_TYPES.CATEGORY,
    payload: { name: categoryName },
  }, { userId: remoteUserId })

  return canUseRemoteStorage(remoteUserId) ? mapRowToCategory(created) : created.title
}

export const deleteCategory = async (categoryName, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)

  if (!canUseRemoteStorage(remoteUserId)) {
    await deleteItem(`category:${categoryName}`)
    return
  }

  const { error } = await supabase
    .from('dashboard_items')
    .delete()
    .eq('user_id', remoteUserId)
    .eq('item_type', STORAGE_ITEM_TYPES.CATEGORY)
    .eq('title', categoryName)

  if (error) {
    logAndThrow('Не удалось удалить категорию из Supabase.', error)
  }
}

export const createSession = async (session, { userId } = {}) => {
  const remoteUserId = await getRemoteUserId(userId)
  const created = await createItem({
    title: session.category,
    description: session.comment,
    value: String(session.duration),
    item_type: STORAGE_ITEM_TYPES.SESSION,
    payload: {
      date: session.date,
      category: session.category,
      duration: session.duration,
      comment: session.comment,
    },
  }, { userId: remoteUserId })

  return canUseRemoteStorage(remoteUserId) ? mapRowToSession(created) : created
}

export const deleteSession = async (sessionId, { userId } = {}) => {
  await deleteItem(sessionId, { userId })
}
