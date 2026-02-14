import { API_BASE_URL } from '../constants/config';
import { User, LoginCredentials, RegisterData } from '../types/user';

const API_URL = `${API_BASE_URL}/api`;

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  async register(data: RegisterData): Promise<User> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        ticket_info: data.ticket_info || {},
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  },

  async logout(userId: number): Promise<void> {
    console.log('authService: logout called for user ID:', userId);
    const url = `${API_URL}/auth/logout/${userId}`;
    console.log('authService: calling URL:', url);

    const response = await fetch(url, {
      method: 'POST',
    });

    console.log('authService: response status:', response.status);

    if (!response.ok) {
      console.error('authService: logout failed with status:', response.status);
      throw new Error('Logout failed');
    }

    console.log('authService: logout successful');
  },

  async getUser(userId: number): Promise<User> {
    const response = await fetch(`${API_URL}/user/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return response.json();
  },
};
