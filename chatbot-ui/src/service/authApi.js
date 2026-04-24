import apiClient from "./apiClient";

export async function register({ username, password, confirm_password }) {
  const response = await apiClient.post("/api/auth/register", {
    username,
    password,
    confirm_password,
  });
  return response.data;
}

export async function login({ username, password }) {
  const response = await apiClient.post("/api/auth/login", {
    username,
    password,
  });
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get("/api/auth/me");
  return response.data;
}

export async function changePassword({
  old_password,
  new_password,
  confirm_new_password,
}) {
  const response = await apiClient.post("/api/auth/change-password", {
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
  const response = await apiClient.post("/api/auth/reset-password", {
    username,
    reset_token,
    new_password,
    confirm_new_password,
  });
  return response.data;
}

export async function adminResetPassword({ username, expire_minutes = 30 }) {
  const response = await apiClient.post("/api/auth/admin/reset-password", {
    username,
    expire_minutes,
  });
  return response.data;
}

export async function listUsers({ skip = 0, limit = 100 } = {}) {
  const response = await apiClient.get("/api/auth/admin/users", {
    params: { skip, limit },
  });
  return response.data;
}

export async function setUserRole({ username, role }) {
  const response = await apiClient.post("/api/auth/admin/set-role", {
    username,
    role,
  });
  return response.data;
}

