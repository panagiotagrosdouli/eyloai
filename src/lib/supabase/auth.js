import { requireSupabase } from '@/lib/supabaseClient';
import { createAppError, AppErrorCode, mapSupabaseError } from './errors';

const ok = (data) => ({ ok: true, data });
const fail = (error) => ({ ok: false, error });

export async function getSession() {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) return fail(mapSupabaseError(error));
    return ok(data.session ?? null);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function signIn(email, password) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function signUp(email, password, metadata = {}) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: metadata },
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function signInWithGoogle(redirectTo) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function signOut() {
  try {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function refreshSession() {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.refreshSession();
    if (error) return fail(mapSupabaseError(error));
    return ok(data.session ?? null);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function resetPassword(email, redirectTo) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}

export async function updatePassword(password) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.updateUser({ password });
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (error) {
    return fail(createAppError(AppErrorCode.CONFIGURATION, error));
  }
}
