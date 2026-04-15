
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export interface SignupData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  userType: 'user' | 'driver';
  // Driver specific
  idDocument?: string;
  proofOfAddress?: string;
}

export interface LoginData {
  email: string;
  password: string;
  userType: 'user' | 'driver';
}

export interface VerifyOTPData {
  email: string;
  otp: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      userType: 'user' | 'driver';
      isVerified: boolean;
      isApproved?: boolean;
    };
    token: string;
  };
}

class AuthService {
  // Register new user
  async signupUser(data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/signup', {
        ...data,
        userType: 'user',
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Register new driver with documents
  async signupDriver(data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    idDocument: string;
    proofOfAddress: string;
  }): Promise<AuthResponse> {
    try {
      const formData = new FormData();

      formData.append('fullName', data.fullName);
      formData.append('email', data.email);
      formData.append('phone', data.phone);
      formData.append('password', data.password);
      formData.append('userType', 'driver');

      // Add documents
      if (data.idDocument) {
        const idDocUri = data.idDocument;
        const idDocName = idDocUri.split('/').pop() || 'id-document.jpg';
        const idDocType = idDocName.split('.').pop();
        
        formData.append('idDocument', {
          uri: idDocUri,
          type: `image/${idDocType}`,
          name: idDocName,
        } as any);
      }

      if (data.proofOfAddress) {
        const proofUri = data.proofOfAddress;
        const proofName = proofUri.split('/').pop() || 'proof-of-address.jpg';
        const proofType = proofName.split('.').pop();
        
        formData.append('proofOfAddress', {
          uri: proofUri,
          type: `image/${proofType}`,
          name: proofName,
        } as any);
      }

      const response = await api.post('/auth/signup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Login user or driver
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', data);

      // Store token and user data
      if (response.data.success && response.data.data) {
        await AsyncStorage.setItem('authToken', response.data.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));
      }

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Verify OTP
  async verifyOTP(data: VerifyOTPData): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/verify-otp', data);

      // Store token and user data after verification
      if (response.data.success && response.data.data) {
        await AsyncStorage.setItem('authToken', response.data.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));
      }

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Resend OTP
  async resendOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/auth/resend-otp', { email });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      await AsyncStorage.multiRemove(['authToken', 'user', 'isAuthenticated', 'userType']);
    }
  }

  // Get current user
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Error handler
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.message || 'An error occurred';
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      return new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  }
}

export default new AuthService();
