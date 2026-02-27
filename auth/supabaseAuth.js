import { getSupabaseClient } from "../services/supabaseClient.js";
import {
  isValidEmail,
  isValidUsername,
  safeUrlOrEmpty,
  sanitizeSingleLine,
} from "../utils/validation.js";

function mapUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email || "",
    username: profile?.username || authUser.email?.split("@")[0] || "Member",
    avatarUrl: profile?.avatar_url || "",
    role: profile?.role || "user",
    createdAt: profile?.created_at || authUser.created_at || new Date().toISOString(),
  };
}

async function getProfile(userId) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, role, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

export async function ensureProfile(authUser, preferredUsername) {
  const supabase = getSupabaseClient();
  if (!supabase || !authUser) return null;

  // TEMP DEBUG: profile sync start
  console.debug("[TEMP DEBUG] profile sync start", { userId: authUser.id });

  const existing = await getProfile(authUser.id);
  const usernameBase = sanitizeSingleLine(preferredUsername || authUser.email?.split("@")[0] || "member", 20);
  const fallbackUsername = usernameBase || `member_${authUser.id.slice(0, 6)}`;

  const upsertPayload = {
    id: authUser.id,
    username: existing?.username || fallbackUsername,
    role: existing?.role || "user",
  };

  if (existing?.avatar_url) {
    upsertPayload.avatar_url = existing.avatar_url;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(upsertPayload, { onConflict: "id" })
    .select("id, username, avatar_url, role, created_at")
    .single();

  if (error) {
    // TEMP DEBUG: sync failure should not block app init
    console.error("[TEMP DEBUG] profile sync failed", {
      userId: authUser.id,
      message: error.message,
    });
    return existing;
  }

  // TEMP DEBUG: profile sync success
  console.debug("[TEMP DEBUG] profile sync success", { userId: authUser.id });
  return data || existing;
}

export async function getCurrentAppUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) return null;

  const authUser = data.session.user;
  let profile = await getProfile(authUser.id);
  if (!profile) {
    profile = await ensureProfile(authUser);
  }

  if (!profile) {
    // TEMP DEBUG: continue with auth user fallback so UI init is not blocked
    console.warn("[TEMP DEBUG] profile unavailable after sync, continuing with auth fallback", {
      userId: authUser.id,
    });
  }

  return mapUser(authUser, profile);
}

export async function signUpWithEmail({ email, password, username }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured. Add runtime config first." };
  }

  const cleanEmail = sanitizeSingleLine(email, 120).toLowerCase();
  const cleanUsername = sanitizeSingleLine(username, 20);

  if (!isValidEmail(cleanEmail)) {
    return { error: "Please enter a valid email." };
  }
  if (!isValidUsername(cleanUsername)) {
    return { error: "Username must be 2-20 chars and use letters, numbers, spaces, dot, dash, or underscore." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { username: cleanUsername },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Unable to create account." };
  }

  await ensureProfile(data.user, cleanUsername);
  const user = await getCurrentAppUser();

  return {
    user,
    needsEmailConfirmation: !data.session,
  };
}

export async function signInWithEmail({ email, password }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured. Add runtime config first." };
  }

  const cleanEmail = sanitizeSingleLine(email, 120).toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return { error: "Please enter a valid email." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const user = await getCurrentAppUser();
  return { user };
}

export async function signOutAuth() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function updateCurrentProfile({ username, avatarUrl }) {
  const supabase = getSupabaseClient();
  const user = await getCurrentAppUser();

  if (!supabase || !user) {
    return { error: "Not signed in." };
  }

  const updates = {};

  if (typeof username === "string") {
    const cleanUsername = sanitizeSingleLine(username, 20);
    if (!isValidUsername(cleanUsername)) {
      return { error: "Username must be 2-20 chars and use letters, numbers, spaces, dot, dash, or underscore." };
    }
    updates.username = cleanUsername;
  }

  if (avatarUrl !== undefined) {
    updates.avatar_url = safeUrlOrEmpty(avatarUrl);
  }

  if (!Object.keys(updates).length) {
    return { user };
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { user: await getCurrentAppUser() };
}

export async function updatePassword({ newPassword }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}

export async function requestPasswordReset(email, redirectTo) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const cleanEmail = sanitizeSingleLine(email, 120).toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return { error: "Please enter a valid email." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export function onSupabaseAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }

    let profile = await getProfile(session.user.id);
    if (!profile) {
      profile = await ensureProfile(session.user);
    }

    if (!profile) {
      // TEMP DEBUG: keep auth flow alive even when profile sync fails
      console.warn("[TEMP DEBUG] auth state profile sync unavailable, using auth fallback", {
        userId: session.user.id,
      });
    }

    callback(mapUser(session.user, profile));
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
