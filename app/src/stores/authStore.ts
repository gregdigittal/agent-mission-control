import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  session: null,
  loading: false,
  initialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, initialized: true }),

  setProfile: (profile) => set({ profile }),

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signInWithGitHub: async () => {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, profile: null, session: null });
  },
}));

// Initialize auth listener
export function initAuth(): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    useAuthStore.getState().setSession(null);
    return () => {};
  }

  // onAuthStateChange fires INITIAL_SESSION (or SIGNED_IN after OAuth redirect)
  // on setup — getSession() is redundant and causes a double setSession() call
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      useAuthStore.getState().setSession(session);
    },
  );

  return () => subscription.unsubscribe();
}
