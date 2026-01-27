// src/loginPage.ts
import { loginAndFetchDocuments } from './auth/authFlow';

const emailInput = prompt('Enter your email:');
const passwordInput = prompt('Enter your password');

loginAndFetchDocuments(emailInput || '', passwordInput || '').then(result => {
  if (result.success) {
    console.log('User info:', result.user);
    console.log('User documents:', result.documents);
  } else {
    console.warn('Error:', result.error);
  }
});
