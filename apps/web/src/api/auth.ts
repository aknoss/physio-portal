import {
  LoginResponse,
  type LoginRequest,
  type UpdateProfileRequest,
  type UserDto,
} from '@physio-portal/contracts';
import { apiClient } from './client';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login', body);
  return LoginResponse.parse(data);
}

export async function me(): Promise<UserDto> {
  const { data } = await apiClient.get('/auth/me');
  return data as UserDto;
}

export async function updateProfile(body: UpdateProfileRequest): Promise<UserDto> {
  const { data } = await apiClient.patch('/auth/me', body);
  return data as UserDto;
}

export async function uploadSignature(file: File): Promise<UserDto> {
  const form = new FormData();
  form.append('signature', file);
  const { data } = await apiClient.post('/auth/me/signature', form);
  return data as UserDto;
}
