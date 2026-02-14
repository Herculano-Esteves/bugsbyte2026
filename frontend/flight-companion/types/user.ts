export interface User {
  id: number;
  name: string;
  email: string;
  address: string;
  ticket_info: any;
  sent_items: number[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  address: string;
  ticket_info?: any;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
