import { useState } from 'react';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) return { token, username };
    return null;
  });

  function saveUser(token: string, username: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    setUser({ token, username });
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  }

  return { user, saveUser, logout };
}
