import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse, DepartmentDto } from "./types";

export type AuthUserDto = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string;
  department: DepartmentDto | null;
  roles: string[];
  /** The account still uses a temporary or default password. */
  mustChangePassword?: boolean;
  /** The system is open to the network, so the change cannot be postponed. */
  passwordChangeRequired?: boolean;
};

export type LoginResponseDto = {
  accessToken: string;
  user: AuthUserDto;
};

export function login(username: string, password: string) {
  return apiFetch<ApiResponse<LoginResponseDto>>(endpoints.login, {
    method: "POST",
    body: {
      username,
      password
    }
  });
}

export function changePassword(currentPassword: string, newPassword: string, token: string) {
  return apiFetch<ApiResponse<AuthUserDto>>(endpoints.changePassword, {
    method: "POST",
    authToken: token,
    body: {
      currentPassword,
      newPassword
    }
  });
}

export function getMe(token: string) {
  return apiFetch<ApiResponse<AuthUserDto>>(endpoints.me, {
    authToken: token
  });
}
