export const DEMO_EMAIL_DOMAIN = 'paisa-practice-demo.com';

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${DEMO_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const idx = email.indexOf('@');
  if (idx < 0) return email;
  return email.slice(0, idx);
}
