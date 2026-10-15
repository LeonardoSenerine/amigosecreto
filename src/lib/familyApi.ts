import type { User } from '@supabase/supabase-js';
import { participantEmail, supabase } from './supabase';

export type Participant = {
  id: number;
  name: string;
  is_claimed: boolean;
  avatar_path: string | null;
};

export type ParticipantProfile = {
  id: number;
  name: string;
  avatar_path: string;
  userId: string;
};

export type WishRow = { id: string; item: string };

export type ParticipantState = {
  recipientId: number | null;
  recipientName: string | null;
  wishes: WishRow[];
  recipientWishes: WishRow[];
  photos: Record<string, string>;
};

function requireSupabase() {
  if (!supabase) throw new Error('A conexão com o Supabase não está configurada.');
  return supabase;
}

function firstRow<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value as T;
}

export async function getParticipants() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_participants');
  if (error) throw error;
  return (data ?? []) as Participant[];
}

export async function getCurrentParticipant(): Promise<ParticipantProfile | null> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data, error } = await client.rpc('get_my_participant');
  if (error) throw error;
  const profile = firstRow(data as Omit<ParticipantProfile, 'userId'>[] | null);
  if (!profile) {
    await client.auth.signOut();
    return null;
  }
  return { ...profile, userId: sessionData.session.user.id };
}

export async function authenticateParticipant(
  participant: Participant,
  password: string,
  confirmation: string,
) {
  const client = requireSupabase();
  const email = participantEmail(participant.id);
  let user: User | null = null;

  if (participant.is_claimed) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Essa senha não confere. Tente novamente.');
    user = data.user;
  } else {
    if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
    if (password !== confirmation) throw new Error('As senhas não são iguais.');

    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw new Error(error.message.includes('already registered')
      ? 'Este nome já possui cadastro. Tente entrar com a senha.'
      : error.message);
    if (!data.session || !data.user) {
      throw new Error('O Supabase não abriu uma sessão. Confira se a confirmação de e-mail está desativada.');
    }
    user = data.user;
  }

  if (!user) throw new Error('Não foi possível validar sua conta.');
  const { data: claimed, error: claimError } = await client.rpc('claim_participant', { participant_id: participant.id });
  if (claimError || !claimed) {
    await client.auth.signOut();
    throw new Error('Esse nome já está vinculado a outra conta. Peça ajuda ao organizador.');
  }

  return { id: participant.id, name: participant.name, userId: user.id, avatar_path: `${user.id}/avatar.jpg` };
}

async function signedAvatar(path: string | null) {
  if (!path) return null;
  const client = requireSupabase();
  const { data, error } = await client.storage.from('avatars').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function loadParticipantState(profile: ParticipantProfile, participants: Participant[]): Promise<ParticipantState> {
  const client = requireSupabase();
  const { data: ownWishes, error: ownWishesError } = await client
    .from('wish_items')
    .select('id, item')
    .eq('owner_id', profile.id)
    .order('created_at');
  if (ownWishesError) throw ownWishesError;

  const { data: assignment, error: assignmentError } = await client
    .from('assignments')
    .select('recipient_id')
    .eq('giver_id', profile.id)
    .maybeSingle();
  if (assignmentError) throw assignmentError;

  const recipientId = assignment?.recipient_id ?? null;
  const recipient = recipientId === null ? null : participants.find((participant) => participant.id === recipientId) ?? null;
  let recipientWishes: WishRow[] = [];
  if (recipientId !== null) {
    const { data, error } = await client
      .from('wish_items')
      .select('id, item')
      .eq('owner_id', recipientId)
      .order('created_at');
    if (error) throw error;
    recipientWishes = (data ?? []) as WishRow[];
  }

  const photos: Record<string, string> = {};
  const ownAvatar = await signedAvatar(profile.avatar_path);
  if (ownAvatar) photos[profile.name] = ownAvatar;
  if (recipient?.avatar_path) {
    const recipientAvatar = await signedAvatar(recipient.avatar_path);
    if (recipientAvatar) photos[recipient.name] = recipientAvatar;
  }

  return {
    recipientId,
    recipientName: recipient?.name ?? null,
    wishes: (ownWishes ?? []) as WishRow[],
    recipientWishes,
    photos,
  };
}

export async function addWish(participantId: number, item: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('wish_items')
    .insert({ owner_id: participantId, item })
    .select('id, item')
    .single();
  if (error) throw error;
  return data as WishRow;
}

export async function removeWish(wishId: string) {
  const client = requireSupabase();
  const { error } = await client.from('wish_items').delete().eq('id', wishId);
  if (error) throw error;
}

export async function uploadAvatar(userId: string, file: Blob) {
  const client = requireSupabase();
  const path = `${userId}/avatar.jpg`;
  const { error } = await client.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw error;
  const { data, error: urlError } = await client.storage.from('avatars').createSignedUrl(path, 3600);
  if (urlError) throw urlError;
  return data.signedUrl;
}

export async function drawOnce() {
  const client = requireSupabase();
  const { error } = await client.rpc('draw_once');
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
