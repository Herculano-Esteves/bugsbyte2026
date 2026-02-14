import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, LoginCredentials, RegisterData } from '../types/user';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = '@user';
const GUEST_MODE_KEY = '@guest_mode';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const [storedUser, guestMode] = await Promise.all([
        AsyncStorage.getItem(USER_STORAGE_KEY),
        AsyncStorage.getItem(GUEST_MODE_KEY),
      ]);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsGuest(false);
      } else if (guestMode === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      const userData = await authService.login(credentials);
      setUser(userData);
      setIsGuest(false);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
    } catch (error) {
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const userData = await authService.register(data);
      setUser(userData);
      setIsGuest(false);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    console.log('AuthContext: logout called');
    console.log('AuthContext: current user:', user);

    try {
      if (user) {
        console.log('AuthContext: calling API logout for user ID:', user.id);
        await authService.logout(user.id);
        console.log('AuthContext: API logout successful');
      } else {
        console.log('AuthContext: no user to logout from API');
      }

      console.log('AuthContext: clearing local state');
      setUser(null);
      setIsGuest(false);

      console.log('AuthContext: removing AsyncStorage items');
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      console.log('AuthContext: logout complete');
    } catch (error) {
      console.error('AuthContext: Logout error:', error);
      // Even if API call fails, clear local state
      console.log('AuthContext: clearing local state despite error');
      setUser(null);
      setIsGuest(false);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      console.log('AuthContext: local cleanup complete');
    }
  };

  const continueAsGuest = async () => {
    setIsGuest(true);
    setUser(null);
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest,
        isLoading,
        login,
        register,
        logout,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
