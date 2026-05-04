import apiClient, { API_PREFIX } from "./apiClient";

export async function register({ username, password, confirm_password }) {
  const response = await apiClient.post(`${API_PREFIX}/auth/register`, {
    username,
    password,
    confirm_password,
  });
  return response.data;
}

export async function login({ username, password }) {
  const response = await apiClient.post(`${API_PREFIX}/auth/login`, {
    username,
    password,
  });
  return response.data;
}

export async function refreshSession({ refresh_token }) {
  const response = await apiClient.post(`${API_PREFIX}/auth/refresh`, {
    refresh_token,
  });
  return response.data;
}

export async function logout() {
  const response = await apiClient.post(`${API_PREFIX}/auth/logout`);
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get(`${API_PREFIX}/auth/me`);
  return response.data;
}

export async function changePassword({
  old_password,
  new_password,
  confirm_new_password,
}) {
  const response = await apiClient.post(`${API_PREFIX}/auth/change-password`, {
    old_password,
    new_password,
    confirm_new_password,
  });
  return response.data;
}

export async function resetPassword({
  username,
  reset_token,
  new_password,
  confirm_new_password,
}) {
  const response = await apiClient.post(`${API_PREFIX}/auth/reset-password`, {
    username,
    reset_token,
    new_password,
    confirm_new_password,
  });
  return response.data;
}

export async function adminResetPassword({ username, expire_minutes = 30 }) {
  const response = await apiClient.post(`${API_PREFIX}/auth/admin/reset-password`, {
    username,
    expire_minutes,
  });
  return response.data;
}

export async function listUsers({ skip = 0, limit = 100 } = {}) {
  const response = await apiClient.get(`${API_PREFIX}/auth/admin/users`, {
    params: { skip, limit },
  });
  return response.data;
}

export async function setUserRole({ username, role }) {
  const response = await apiClient.post(`${API_PREFIX}/auth/admin/set-role`, {
    username,
    role,
  });
  return response.data;
}

