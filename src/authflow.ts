// src/auth/authFlow.ts
import { supabase } from '../client'; // keep this import — do NOT replace client.ts

export async function loginAndFetchDocuments(email: string, password: string) {
  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    return { success: false, error: 'Supabase not initialized' };
  }

  // 1️⃣ Log in the user
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    console.error('Login failed:', loginError.message);
    return { success: false, error: loginError.message };
  }

  const userId = loginData.user?.id;
  if (!userId) {
    console.error('User ID not found after login');
    return { success: false, error: 'User ID missing' };
  }

  console.log('Login successful! User:', loginData.user);

  // 2️⃣ Fetch documents for this user
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId);

  if (docError) {
    console.error('Failed to fetch documents:', docError.message);
    return { success: true, user: loginData.user, documents: [], error: docError.message };
  }

  console.log('Documents fetched for user:', documents);

  return { success: true, user: loginData.user, documents };
}
