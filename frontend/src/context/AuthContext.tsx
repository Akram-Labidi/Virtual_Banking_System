import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CLIENT' | 'ADVISOR' | 'ADMIN';
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('aurabank_token');
    const savedUser = localStorage.getItem('aurabank_user');
    const savedRefreshToken = localStorage.getItem('aurabank_refresh_token');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser) as User);
      } catch {
        localStorage.removeItem('aurabank_token');
        localStorage.removeItem('aurabank_user');
        localStorage.removeItem('aurabank_refresh_token');
      }
    } else if (savedRefreshToken) {
      localStorage.removeItem('aurabank_refresh_token');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: loggedUser } = res.data;
    localStorage.setItem('aurabank_token', accessToken);
    localStorage.setItem('aurabank_refresh_token', refreshToken);
    localStorage.setItem('aurabank_user', JSON.stringify(loggedUser));
    setToken(accessToken);
    setUser(loggedUser);
  };

  const register = async (data: RegisterData) => {
    const res = await api.post('/auth/register', data);
    const { accessToken, refreshToken, user: registeredUser } = res.data;
    localStorage.setItem('aurabank_token', accessToken);
    localStorage.setItem('aurabank_refresh_token', refreshToken);
    localStorage.setItem('aurabank_user', JSON.stringify(registeredUser));
    setToken(accessToken);
    setUser(registeredUser);
  };

  const logout = () => {
    localStorage.removeItem('aurabank_token');
    localStorage.removeItem('aurabank_refresh_token');
    localStorage.removeItem('aurabank_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
