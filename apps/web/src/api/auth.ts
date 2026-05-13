import { LoginResponse, type LoginRequest, type UserDto } from '@physio-portal/contracts';
import { apiClient } from './client';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login', body);
  return LoginResponse.parse(data);
}

export async function me(): Promise<UserDto> {
  const { data } = await apiClient.get('/auth/me');
  return data as UserDto;
}
