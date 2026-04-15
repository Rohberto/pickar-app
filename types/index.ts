
export type UserType = 'user' | 'driver';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: UserType;
  avatar?: string;
}

export interface OnboardingSlide {
  id: number;
  title: string;
  description: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
