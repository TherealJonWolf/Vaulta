async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    console.error('Sign-up failed:', error.message)
  } else {
    console.log('Sign-up successful! Check your email to confirm:', data.user)
  }
}
