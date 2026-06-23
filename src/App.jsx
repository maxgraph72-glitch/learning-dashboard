import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Cloud,
  Flame,
  HardDrive,
  LoaderCircle,
  LogOut,
  Mail,
  PieChart as PieIcon,
  Play,
  Timer,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { getCurrentUser, signInWithEmail, signOut, subscribeToAuthChanges } from './services/authService'
import {
  createCategory,
  createSession,
  DEFAULT_CATEGORIES,
  deleteCategory,
  deleteSession,
  getDashboardData,
} from './services/dashboardStorage'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4']

const formatTimer = (totalSeconds) => {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
}

export default function App() {
  const [categories, setCategories] = useState([])
  const [sessions, setSessions] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [isContributionOpen, setIsContributionOpen] = useState(false)
  const [timeRange, setTimeRange] = useState('week')
  const [currentUser, setCurrentUser] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLearningActive, setIsLearningActive] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false)
  const [timerModalStep, setTimerModalStep] = useState('confirmFinish')
  const [timerSubject, setTimerSubject] = useState('')
  const [timerComment, setTimerComment] = useState('')
  const intervalRef = useRef(null)

  const userId = currentUser?.id ?? null
  const storageMode = isSupabaseConfigured && currentUser ? 'supabase' : 'local'

  useEffect(() => {
    let isMounted = true

    const bootstrapAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (isMounted) {
          setCurrentUser(user)
        }
      } catch (error) {
        console.error('Ошибка получения текущего пользователя Supabase.', error)
        if (isMounted) {
          setErrorMessage(error.message || 'Не удалось определить текущего пользователя.')
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false)
        }
      }
    }

    bootstrapAuth()

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) {
        return
      }

      setCurrentUser(user)
      setAuthLoading(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const dashboardData = await getDashboardData({ userId })
        if (!isMounted) {
          return
        }

        setCategories(dashboardData.categories)
        setSessions(dashboardData.sessions)
      } catch (error) {
        console.error('Ошибка загрузки данных дашборда.', error)
        if (isMounted) {
          setErrorMessage(error.message || 'Не удалось загрузить данные дашборда.')
          setCategories(DEFAULT_CATEGORIES)
          setSessions([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (!authLoading) {
      loadDashboardData()
    }

    return () => {
      isMounted = false
    }
  }, [authLoading, userId])

  useEffect(() => {
    if (timerSubject && !categories.includes(timerSubject)) {
      setTimerSubject(categories[0] || '')
    }

    if (selectedSubject && !categories.includes(selectedSubject)) {
      setSelectedSubject(null)
    }
  }, [categories, selectedSubject, timerSubject])

  useEffect(() => {
    if (!isLearningActive || !startedAt) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const updateElapsed = () => {
      const startTimestamp = new Date(startedAt).getTime()
      const nextElapsed = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000))
      setElapsedSeconds(nextElapsed)
    }

    updateElapsed()
    intervalRef.current = window.setInterval(updateElapsed, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isLearningActive, startedAt])

  const totalHours = useMemo(
    () => (sessions.reduce((accumulator, session) => accumulator + session.duration, 0) / 60).toFixed(1),
    [sessions],
  )

  const todayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return sessions
      .filter((session) => session.date === today)
      .reduce((accumulator, session) => accumulator + session.duration, 0)
  }, [sessions])

  const favoriteCategory = useMemo(() => {
    if (sessions.length === 0) {
      return 'Нет данных'
    }

    const totals = {}
    sessions.forEach((session) => {
      totals[session.category] = (totals[session.category] || 0) + session.duration
    })

    return Object.keys(totals).reduce((left, right) => (totals[left] > totals[right] ? left : right))
  }, [sessions])

  const barChartData = useMemo(() => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    const result = days.map((day) => ({ name: day, Минуты: 0 }))

    sessions.forEach((session) => {
      const dayIndex = new Date(session.date).getDay()
      result[dayIndex].Минуты += session.duration
    })

    const sunday = result.shift()
    result.push(sunday)

    return result
  }, [sessions])

  const getFilteredSessions = () => {
    const now = new Date()
    const msPerDay = 24 * 60 * 60 * 1000
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365
    const cutoff = new Date(now.getTime() - days * msPerDay).toISOString().split('T')[0]

    return sessions.filter((session) => session.date >= cutoff)
  }

  const subjectStats = useMemo(() => {
    if (!selectedSubject) {
      return null
    }

    const filtered = getFilteredSessions().filter((session) => session.category === selectedSubject)
    const chartDataMap = {}

    filtered.forEach((session) => {
      chartDataMap[session.date] = (chartDataMap[session.date] || 0) + session.duration
    })

    const chartData = Object.keys(chartDataMap)
      .sort()
      .map((date) => ({ date, Минуты: chartDataMap[date] }))

    const durations = filtered.map((session) => session.duration)
    const average = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0

    return {
      chartData,
      avg: average,
      max: durations.length ? Math.max(...durations) : 0,
      min: durations.length ? Math.min(...durations) : 0,
      total: filtered.length,
    }
  }, [selectedSubject, timeRange, sessions])

  const contributionData = useMemo(() => {
    const filtered = getFilteredSessions()
    const totals = {}

    filtered.forEach((session) => {
      totals[session.category] = (totals[session.category] || 0) + session.duration
    })

    return Object.keys(totals).map((categoryName) => ({ name: categoryName, value: totals[categoryName] }))
  }, [timeRange, sessions])

  const getColor = (categoryName) => {
    const index = categories.indexOf(categoryName)
    return index !== -1 ? COLORS[index % COLORS.length] : COLORS[COLORS.length - 1]
  }

  const resetTimerState = () => {
    setIsLearningActive(false)
    setStartedAt(null)
    setElapsedSeconds(0)
    setIsTimerModalOpen(false)
    setTimerModalStep('confirmFinish')
    setTimerSubject('')
    setTimerComment('')
  }

  const handleStartLearning = () => {
    if (isLearningActive) {
      return
    }

    const availableCategory = categories[0] || ''
    setIsLearningActive(true)
    setStartedAt(new Date().toISOString())
    setElapsedSeconds(0)
    setTimerSubject(availableCategory)
    setTimerComment('')
    setTimerModalStep('confirmFinish')
    setAuthMessage('Сессия обучения запущена. Таймер считает время автоматически.')
    setErrorMessage('')
  }

  const handleOpenTimerModal = () => {
    if (!isLearningActive) {
      return
    }

    setTimerModalStep('confirmFinish')
    setIsTimerModalOpen(true)
  }

  const handleAddCategory = async (event) => {
    event.preventDefault()
    const trimmed = newCategoryName.trim()

    if (!trimmed || categories.includes(trimmed)) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const createdCategory = await createCategory(trimmed, { userId })
      setCategories((currentCategories) => [...currentCategories, createdCategory])
      setNewCategoryName('')

      if (!timerSubject) {
        setTimerSubject(createdCategory)
      }
    } catch (error) {
      console.error('Ошибка добавления категории.', error)
      setErrorMessage(error.message || 'Не удалось добавить предмет.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = async (categoryToDelete, event) => {
    event.stopPropagation()
    const confirmed = window.confirm(`Удалить предмет "${categoryToDelete}"? История занятий по нему сохранится, но добавлять новые будет нельзя.`)

    if (!confirmed) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await deleteCategory(categoryToDelete, { userId })
      setCategories((currentCategories) => currentCategories.filter((currentCategory) => currentCategory !== categoryToDelete))
    } catch (error) {
      console.error('Ошибка удаления категории.', error)
      setErrorMessage(error.message || 'Не удалось удалить предмет.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    setIsSaving(true)
    setErrorMessage('')

    try {
      await deleteSession(sessionId, { userId })
      setSessions((currentSessions) => currentSessions.filter((session) => String(session.id) !== String(sessionId)))
    } catch (error) {
      console.error('Ошибка удаления занятия.', error)
      setErrorMessage(error.message || 'Не удалось удалить занятие.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmFinish = () => {
    setTimerModalStep('saveSession')
    setTimerSubject((currentValue) => currentValue || categories[0] || '')
  }

  const handleSaveTimedSession = async () => {
    const durationMinutes = Math.floor(elapsedSeconds / 60)

    if (durationMinutes <= 0) {
      setErrorMessage('Сессия меньше минуты — нечего сохранять.')
      return
    }

    if (!timerSubject) {
      setErrorMessage('Выбери предмет перед сохранением.')
      return
    }

    const nextSession = {
      date: new Date().toISOString().split('T')[0],
      category: timerSubject,
      duration: durationMinutes,
      comment: timerComment.trim() || 'Без описания',
    }

    setIsSaving(true)
    setErrorMessage('')
    setAuthMessage('')

    try {
      const createdSession = await createSession(nextSession, { userId })
      setSessions((currentSessions) => [createdSession, ...currentSessions])
      resetTimerState()
      setAuthMessage(`Сессия сохранена: ${durationMinutes} мин. по предмету "${nextSession.category}".`)
    } catch (error) {
      console.error('Ошибка сохранения сессии таймера.', error)
      setErrorMessage(error.message || 'Не удалось сохранить завершённую сессию.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMagicLinkSignIn = async (event) => {
    event.preventDefault()

    if (!authEmail.trim()) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setAuthMessage('')

    try {
      await signInWithEmail(authEmail.trim())
      setAuthMessage('Письмо со ссылкой для входа отправлено. После входа данные смогут синхронизироваться между устройствами.')
      setAuthEmail('')
    } catch (error) {
      console.error('Ошибка отправки magic link.', error)
      setErrorMessage(error.message || 'Не удалось отправить magic link.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    setIsSaving(true)
    setErrorMessage('')
    setAuthMessage('')

    try {
      await signOut()
      setCurrentUser(null)
      setAuthMessage('Вы вышли из Supabase-аккаунта. Приложение продолжает работать локально.')
    } catch (error) {
      console.error('Ошибка выхода из Supabase.', error)
      setErrorMessage(error.message || 'Не удалось выйти из аккаунта.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-6 flex flex-col gap-6">
      <header className="flex flex-col gap-4 bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              My Learning Tracker
            </h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
              <Calendar size={16} /> Статистика, учет времени и подготовка к облачному хранению
            </p>
          </div>

          <div className="xl:flex-1 xl:flex xl:justify-center">
            <button
              type="button"
              onClick={handleStartLearning}
              disabled={isLearningActive || categories.length === 0 || isSaving}
              className="w-full xl:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none transition"
            >
              <Play size={18} />
              {isLearningActive ? 'Обучение уже запущено' : 'Начать обучение'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 xl:justify-end">
            <button
              onClick={() => setIsContributionOpen(true)}
              className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-600/30 transition"
            >
              <PieIcon size={18} /> Вклад занятий
            </button>

            {isLearningActive && (
              <button
                type="button"
                onClick={handleOpenTimerModal}
                className="flex items-center gap-2 bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition"
              >
                <Timer size={18} className="text-emerald-400" />
                <span className="font-semibold tabular-nums">{formatTimer(elapsedSeconds)}</span>
              </button>
            )}

            <div className="flex items-center gap-3 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-700">
              <Flame className="text-orange-500 fill-orange-500" size={20} />
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold">Стрик</div>
                <div className="text-sm font-bold text-orange-400">6 дней</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              {storageMode === 'supabase' ? <Cloud size={16} className="text-emerald-400" /> : <HardDrive size={16} className="text-amber-400" />}
              {storageMode === 'supabase' ? 'Режим Supabase' : 'Локальный режим'}
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {storageMode === 'supabase'
                ? 'Данные читаются из Supabase и могут синхронизироваться между устройствами после входа.'
                : isSupabaseConfigured
                  ? 'Supabase настроен, но вход не выполнен. Пока что данные сохраняются в localStorage этого браузера.'
                  : 'Переменные Supabase еще не добавлены, поэтому приложение работает через localStorage как и раньше.'}
            </p>
            {currentUser && (
              <p className="text-xs text-slate-500 mt-3 break-all">
                Вошли как: {currentUser.email}
              </p>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Mail size={16} className="text-indigo-400" />
              Supabase Auth
            </div>

            {isSupabaseConfigured ? (
              currentUser ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Magic link авторизация включена. Можно выйти и вернуться в локальный режим.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition"
                  >
                    <LogOut size={16} /> Выйти
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLinkSignIn} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-700 transition"
                  >
                    <Mail size={16} /> Войти по ссылке
                  </button>
                </form>
              )
            ) : (
              <p className="text-sm text-slate-400">
                Добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`, чтобы включить вход по magic link без хранения секретов во frontend.
              </p>
            )}
          </div>
        </div>

        {(errorMessage || authMessage) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 ${errorMessage ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
            {errorMessage ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle size={18} className="shrink-0 mt-0.5" />}
            <span>{errorMessage || authMessage}</span>
          </div>
        )}
      </header>

      {(loading || authLoading) ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 flex items-center justify-center gap-3 text-slate-300">
          <LoaderCircle className="animate-spin text-indigo-400" size={20} />
          Загружаем данные дашборда...
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-64 shrink-0 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg p-4 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Мои предметы</h3>

            <div className="space-y-1">
              {categories.length === 0 && (
                <p className="text-xs text-slate-500 px-2 italic">Список предметов пуст</p>
              )}

              {categories.map((categoryName) => (
                <div key={categoryName} className="group relative flex items-center bg-slate-800 hover:bg-slate-700/50 rounded-xl transition">
                  <button onClick={() => setSelectedSubject(categoryName)} className="flex-1 flex items-center gap-3 p-3 text-left overflow-hidden">
                    <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: getColor(categoryName) }}></span>
                    <span className="font-medium text-slate-200 group-hover:text-white transition truncate">{categoryName}</span>
                  </button>
                  <button
                    onClick={(event) => handleDeleteCategory(categoryName, event)}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Удалить предмет"
                    disabled={isSaving}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCategory} className="mt-4 border-t border-slate-700/50 pt-4 flex gap-2">
              <input
                type="text"
                placeholder="Новый предмет..."
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white p-2 rounded-xl border border-indigo-500/30 disabled:opacity-60 transition"
              >
                <BookOpen size={18} />
              </button>
            </form>
          </div>

          <div className="flex-1 w-full space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Clock size={24} /></div>
                <div><div className="text-xs text-slate-400 font-medium uppercase">Всего времени</div><div className="text-xl font-bold">{totalHours} ч.</div></div>
              </div>
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><CheckCircle size={24} /></div>
                <div><div className="text-xs text-slate-400 font-medium uppercase">За сегодня</div><div className="text-xl font-bold">{todayMinutes} мин.</div></div>
              </div>
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400"><BookOpen size={24} /></div>
                <div className="overflow-hidden"><div className="text-xs text-slate-400 font-medium uppercase">Фокус недели</div><div className="text-xl font-bold truncate">{favoriteCategory}</div></div>
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-300">Активность (Пн-Вс)</h3>
                {isLearningActive && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
                    <Timer size={16} />
                    <span className="tabular-nums">{formatTimer(elapsedSeconds)}</span>
                  </div>
                )}
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#334155' }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px' }} />
                    <Bar dataKey="Минуты" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 overflow-hidden">
              <h3 className="text-base font-semibold mb-3 text-slate-300">История</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase">
                      <th className="py-2 px-3">Дата</th>
                      <th className="py-2 px-3">Предмет</th>
                      <th className="py-2 px-3">Время</th>
                      <th className="py-2 px-3">Комментарий</th>
                      <th className="py-2 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-700/30">
                        <td className="py-2 px-3 text-slate-400">{session.date}</td>
                        <td className="py-2 px-3 font-medium" style={{ color: getColor(session.category) }}>{session.category}</td>
                        <td className="py-2 px-3">{session.duration} мин</td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{session.comment}</td>
                        <td className="py-2 px-3 text-right">
                          <button onClick={() => handleDeleteSession(session.id)} className="text-slate-500 hover:text-rose-400" disabled={isSaving}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSubject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="text-indigo-400" /> {selectedSubject}</h2>
              <button onClick={() => setSelectedSubject(null)} className="text-slate-400 hover:text-white bg-slate-700/50 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-xl w-max">
              {['week', 'month', 'year'].map((range) => (
                <button key={range} onClick={() => setTimeRange(range)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${timeRange === range ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  {range === 'week' ? 'Неделя' : range === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
            {subjectStats?.total > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-xl text-center"><div className="text-xs text-slate-400">Среднее</div><div className="text-lg font-bold text-indigo-400">{subjectStats.avg} мин</div></div>
                  <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-xl text-center"><div className="text-xs text-slate-400">Максимум</div><div className="text-lg font-bold text-emerald-400">{subjectStats.max} мин</div></div>
                  <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-xl text-center"><div className="text-xs text-slate-400">Минимум</div><div className="text-lg font-bold text-rose-400">{subjectStats.min} мин</div></div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={subjectStats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(value) => value.slice(5)} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="Минуты" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', stroke: '#6366f1', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <div className="py-12 text-center text-slate-500">За выбранный период нет записей по этому предмету.</div>}
          </div>
        </div>
      )}

      {isContributionOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><PieIcon className="text-emerald-400" /> Вклад предметов</h2>
              <button onClick={() => setIsContributionOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/50 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-xl w-max mx-auto">
              {['week', 'month', 'year'].map((range) => (
                <button key={range} onClick={() => setTimeRange(range)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${timeRange === range ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  {range === 'week' ? 'Неделя' : range === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
            {contributionData.length > 0 ? (
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={contributionData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                      {contributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={getColor(entry.name)} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} мин.`} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '12px', color: '#f8fafc' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="py-12 text-center text-slate-500">Нет данных для построения диаграммы.</div>}
          </div>
        </div>
      )}

      {isTimerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Timer className="text-emerald-400" size={20} />
                {timerModalStep === 'confirmFinish' ? 'Активная сессия' : 'Сохранение сессии'}
              </h2>
              <button
                onClick={() => setIsTimerModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-700/50 p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {timerModalStep === 'confirmFinish' ? (
              <div className="space-y-5">
                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
                  <div className="text-sm text-slate-400 mb-2">Текущее время обучения</div>
                  <div className="text-3xl font-bold text-emerald-300 tabular-nums">{formatTimer(elapsedSeconds)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmFinish}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-3 transition"
                  >
                    Завершить обучение
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTimerModalOpen(false)}
                    className="rounded-xl border border-slate-600 bg-slate-900/60 hover:bg-slate-700 text-slate-200 font-medium px-4 py-3 transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
                  <div className="text-sm text-slate-400 mb-2">Итоговое время обучения</div>
                  <div className="text-3xl font-bold text-indigo-300 tabular-nums">{formatTimer(elapsedSeconds)}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    К сохранению пойдет {Math.floor(elapsedSeconds / 60)} мин.
                  </div>
                </div>

                <select
                  value={timerSubject}
                  onChange={(event) => setTimerSubject(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  disabled={categories.length === 0 || isSaving}
                >
                  {categories.length === 0 && <option value="">Создайте предмет слева</option>}
                  {categories.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}
                </select>

                <textarea
                  rows="3"
                  placeholder="Что сделал?"
                  value={timerComment}
                  onChange={(event) => setTimerComment(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none resize-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleSaveTimedSession}
                    disabled={isSaving || categories.length === 0}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-medium px-4 py-3 transition"
                  >
                    {isSaving ? 'Сохраняем...' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerModalStep('confirmFinish')}
                    className="rounded-xl border border-slate-600 bg-slate-900/60 hover:bg-slate-700 text-slate-200 font-medium px-4 py-3 transition"
                  >
                    Назад
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
