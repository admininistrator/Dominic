import { fulfillJson } from "./http";

export async function handleAuthRoute({ route, request, path, method, state }) {
  const normalizedPath = path.replace(/^\/api\/v1(?=\/)/, "/api");

  if (normalizedPath === "/api/auth/login" && method === "POST") {
    const payload = request.postDataJSON();
    state.user.username = payload.username;
    state.usage.username = payload.username;
    await fulfillJson(route, { access_token: state.token, ...state.user });
    return true;
  }

  if (normalizedPath === "/api/auth/register" && method === "POST") {
    const payload = request.postDataJSON();
    state.user.username = payload.username;
    state.usage.username = payload.username;
    await fulfillJson(route, { access_token: state.token, ...state.user }, 201);
    return true;
  }

  if (normalizedPath === "/api/auth/me" && method === "GET") {
    await fulfillJson(route, state.user);
    return true;
  }

  if (normalizedPath === "/api/auth/reset-password" && method === "POST") {
    const payload = request.postDataJSON();
    state.resetCalls.push(payload);
    await fulfillJson(route, {
      success: true,
      message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.",
    });
    return true;
  }

  return false;
}