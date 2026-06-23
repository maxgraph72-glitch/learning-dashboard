import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.')
  }
}

export const getCurrentUser = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  if (session?.user) {
    return session.user
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user
}

export const signInWithEmail = async (email) => {
  ensureSupabase()

  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })

  if (error) {
    throw error
  }
}

export const signOut = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export const subscribeToAuthChanges = (callback) => {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      callback(null)
      return
    }

    callback(session?.user ?? null)
  })

  return () => subscription.unsubscribe()
}
