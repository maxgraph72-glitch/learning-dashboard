import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Clock, BookOpen, Trash2, Calendar, Flame, PlusCircle, CheckCircle, X, PieChart as PieIcon, TrendingUp } from 'lucide-react';

const DEFAULT_CATEGORIES = ['C# и .NET', 'Мат. анализ', 'Общая физика', 'История', 'Другое'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];

const getRecentDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const MOCK_DATA = [
  { id: 1, date: getRecentDate(0), category: 'C# и .NET', duration: 120, comment: 'Разработка интерфейса на WinForms' },
  { id: 2, date: getRecentDate(1), category: 'Мат. анализ', duration: 90, comment: 'Решение матриц и пределов' },
  { id: 3, date: getRecentDate(2), category: 'Общая физика', duration: 60, comment: 'Подготовка к семинару по термодинамике' },
  { id: 4, date: getRecentDate(3), category: 'C# и .NET', duration: 150, comment: 'Алгоритм Литтла' },
  { id: 5, date: getRecentDate(4), category: 'История', duration: 45, comment: 'Доклад про северные территории' },
];

export default function App() {
  // --- Данные: Предметы ---
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('learning_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- Данные: Сессии ---
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('learning_sessions');
    return saved ? JSON.parse(saved) : MOCK_DATA;
  });

  // --- Состояния формы и модальных окон ---
  const [category, setCategory] = useState(categories[0] || '');
  const [duration, setDuration] = useState('');
  const [comment, setComment] = useState('');
  
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // Сохранение в localStorage при изменениях
  useEffect(() => {
    localStorage.setItem('learning_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('learning_categories', JSON.stringify(categories));
    // Если удалили выбранную категорию в форме, переключаем на первую доступную
    if (!categories.includes(category) && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories]);

  // --- Хэндлеры для предметов ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setNewCategoryName('');
      if (categories.length === 0) setCategory(trimmed);
    }
  };

  const handleDeleteCategory = (catToDelete, e) => {
    e.stopPropagation(); // Чтобы не открывалось модальное окно статистики
    const confirmed = window.confirm(`Удалить предмет "${catToDelete}"? История занятий по нему сохранится, но добавлять новые будет нельзя.`);
    if (confirmed) {
      setCategories(categories.filter(c => c !== catToDelete));
      if (selectedSubject === catToDelete) setSelectedSubject(null);
    }
  };

  // --- Хэндлеры для сессий ---
  const handleAddSession = (e) => {
    e.preventDefault();
    if (!duration || duration <= 0 || !category) return;
    const newSession = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      category,
      duration: parseInt(duration),
      comment: comment.trim() || 'Без описания'
    };
    setSessions([newSession, ...sessions]);
    setDuration('');
    setComment('');
  };

  const handleDeleteSession = (id) => setSessions(sessions.filter(s => s.id !== id));

  // --- Базовая статистика ---
  const totalHours = useMemo(() => (sessions.reduce((acc, curr) => acc + curr.duration, 0) / 60).toFixed(1), [sessions]);
  const todayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter(s => s.date === today).reduce((acc, curr) => acc + curr.duration, 0);
  }, [sessions]);
  const favoriteCategory = useMemo(() => {
    if (sessions.length === 0) return 'Нет данных';
    const totals = {};
    sessions.forEach(s => totals[s.category] = (totals[s.category] || 0) + s.duration);
    return Object.keys(totals).reduce((a, b) => totals[a] > totals[b] ? a : b);
  }, [sessions]);

  const barChartData = useMemo(() => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const result = days.map(day => ({ name: day, 'Минуты': 0 }));
    sessions.forEach(s => {
      const dayIndex = new Date(s.date).getDay();
      result[dayIndex]['Минуты'] += s.duration;
    });
    const monday = result.shift();
    result.push(monday);
    return result;
  }, [sessions]);

  // --- Логика модальных окон ---
  const getFilteredSessions = () => {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    let days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    const cutoff = new Date(now.getTime() - days * msPerDay).toISOString().split('T')[0];
    return sessions.filter(s => s.date >= cutoff);
  };

  const subjectStats = useMemo(() => {
    if (!selectedSubject) return null;
    const filtered = getFilteredSessions().filter(s => s.category === selectedSubject);
    
    const chartDataMap = {};
    filtered.forEach(s => chartDataMap[s.date] = (chartDataMap[s.date] || 0) + s.duration);
    const chartData = Object.keys(chartDataMap).sort().map(date => ({ date, 'Минуты': chartDataMap[date] }));

    const durations = filtered.map(s => s.duration);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const max = durations.length ? Math.max(...durations) : 0;
    const min = durations.length ? Math.min(...durations) : 0;

    return { chartData, avg, max, min, total: filtered.length };
  }, [selectedSubject, timeRange, sessions]);

  const contributionData = useMemo(() => {
    const filtered = getFilteredSessions();
    const totals = {};
    filtered.forEach(s => totals[s.category] = (totals[s.category] || 0) + s.duration);
    return Object.keys(totals).map(cat => ({ name: cat, value: totals[cat] }));
  }, [timeRange, sessions]);

  const getColor = (catName) => {
    const index = categories.indexOf(catName);
    return index !== -1 ? COLORS[index % COLORS.length] : COLORS[COLORS.length - 1];
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-6 flex flex-col gap-6">
      
      {/* ШАПКА */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            My Learning Tracker
          </h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
            <Calendar size={16} /> Статистика и учет времени
          </p>
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
          <button onClick={() => setIsContributionOpen(true)} className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-600/30 transition">
            <PieIcon size={18} /> Вклад занятий
          </button>
          <div className="flex items-center gap-3 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-700">
            <Flame className="text-orange-500 fill-orange-500" size={20} />
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold">Стрик</div>
              <div className="text-sm font-bold text-orange-400">6 дней</div>
            </div>
          </div>
        </div>
      </header>

      {/* ОСНОВНАЯ СЕТКА */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* ЛЕВАЯ ЧАСТЬ: Боковое меню предметов */}
        <div className="w-full lg:w-64 shrink-0 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Мои предметы</h3>
          
          <div className="space-y-1">
            {categories.length === 0 && (
              <p className="text-xs text-slate-500 px-2 italic">Список предметов пуст</p>
            )}
            {categories.map((cat) => (
              <div key={cat} className="group relative flex items-center bg-slate-800 hover:bg-slate-700/50 rounded-xl transition">
                <button onClick={() => setSelectedSubject(cat)} className="flex-1 flex items-center gap-3 p-3 text-left overflow-hidden">
                  <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: getColor(cat) }}></span>
                  <span className="font-medium text-slate-200 group-hover:text-white transition truncate">{cat}</span>
                </button>
                <button 
                  onClick={(e) => handleDeleteCategory(cat, e)} 
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Удалить предмет"
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
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none" 
            />
            <button type="submit" className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white p-2 rounded-xl border border-indigo-500/30 transition">
              <PlusCircle size={18} />
            </button>
          </form>
        </div>

        {/* ПРАВАЯ ЧАСТЬ: Дашборд */}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><PlusCircle className="text-indigo-400" size={18} /> Добавить</h3>
              <form onSubmit={handleAddSession} className="space-y-4">
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  disabled={categories.length === 0}
                >
                  {categories.length === 0 && <option value="">Создайте предмет слева</option>}
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <input type="number" placeholder="Минуты (напр. 45)" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none" />
                <textarea rows="2" placeholder="Что сделано..." value={comment} onChange={(e) => setComment(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none resize-none" />
                <button type="submit" disabled={categories.length === 0} className="w-full bg-indigo-600 disabled:bg-slate-700 hover:bg-indigo-500 text-white font-medium py-2 rounded-xl text-sm transition">Сохранить</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <h3 className="text-base font-semibold mb-4 text-slate-300">Активность (Пн-Вс)</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#334155'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px' }} />
                    <Bar dataKey="Минуты" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 overflow-hidden">
            <h3 className="text-base font-semibold mb-3 text-slate-300">История</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase">
                    <th className="py-2 px-3">Дата</th><th className="py-2 px-3">Предмет</th><th className="py-2 px-3">Время</th><th className="py-2 px-3">Комментарий</th><th className="py-2 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-slate-400">{s.date}</td>
                      <td className="py-2 px-3 font-medium" style={{ color: getColor(s.category) }}>{s.category}</td>
                      <td className="py-2 px-3">{s.duration} мин</td>
                      <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{s.comment}</td>
                      <td className="py-2 px-3 text-right"><button onClick={() => handleDeleteSession(s.id)} className="text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНЫЕ ОКНА */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="text-indigo-400" /> {selectedSubject}</h2>
              <button onClick={() => setSelectedSubject(null)} className="text-slate-400 hover:text-white bg-slate-700/50 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-xl w-max">
              {['week', 'month', 'year'].map(range => (
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
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(str) => str.slice(5)} />
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
              {['week', 'month', 'year'].map(range => (
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
    </div>
  );
}