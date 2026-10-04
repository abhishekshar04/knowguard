/**
 * What the sign-in scenes show, written by form events (see AuthVisual) and read every frame.
 * Only whether the email and password are filled in is kept, never the password itself. The name
 * and organization name are shown back to the person typing them, in their own browser only.
 */
export const authState = {
  email: false,
  password: false,
  name: '',
  organization: '',
  /** checking: the form was submitted; denied: it came back with an error. */
  status: 'idle' as 'idle' | 'checking' | 'denied',
};

export type AuthSceneMode = 'vault' | 'found' | 'join' | 'refused';
