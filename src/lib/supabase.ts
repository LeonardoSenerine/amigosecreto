import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://edecrjpfiwnvrltsibet.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Idszmp2LRgMtwgLxLPMKbw_wbDtzdDW';

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

export const hasSupabaseConfig = supabase !== null;

export function participantEmail(participantId: number) {
  return `participant-${participantId}@amigosecreto.app`;
}
