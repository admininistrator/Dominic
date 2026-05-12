import { fulfillJson, fulfillError } from "./http";
import { rotateTokens } from "./state";

/**
 * Extract the raw token from an Authorization header value.
 * Returns the token string when the scheme is "Bearer" (case-insensitive),
 * or null if the header is absent / uses a different scheme.
 *
 * @param {string|null|undefined} authHeader
 * @returns {string|null}
 */
function extractBearer(authHeader) {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Validate that the request carries a Bearer token matching the current
 * state.token.  Fulfills the route with 401 and returns false on failure.
 *
 * @param {import('@playwright/test').Route} route
 * @param {import('@playwright/test').Request} request
 * @param {ReturnType<import('./state').createApiState>} state
 * @returns {Promise<boolean>} true when the token is valid
 */
async function assertBearer(route, request, state) {
  const token = extractBearer(request.headers()["authorization"]);
  if (!token || token !== state.token) {
    await fulfillError(route, 401, "Not authenticated");
    return false;
  }
  return true;
}

export async function handleAuthRoute({ route, request, path, method, state }) {
  // ── POST /api/v1/auth/login ──────────────────────────────────────────────
  if (path === "/api/v1/auth/login" && method === "POST") {
    const payload = request.postDataJSON();
    state.user.username = payload.username;
    state.usage.username = payload.username;
    await fulfillJson(route, {
      success: true,
      access_token: state.token,
      refresh_token: state.refreshToken,
      token_type: "bearer",
      username: state.user.username,
      role: state.user.role,
    });
    return true;
  }

  // ── POST /api/v1/auth/register ───────────────────────────────────────────
  if (path === "/api/v1/auth/register" && method === "POST") {
    const payload = request.postDataJSON();
    state.user.username = payload.username;
    state.usage.username = payload.username;
    await fulfillJson(
      route,
      {
        success: true,
        access_token: state.token,
        refresh_token: state.refreshToken,
        token_type: "bearer",
        username: state.user.username,
        role: state.user.role,
      },
      201
    );
    return true;
  }

  // ── POST /api/v1/auth/refresh ────────────────────────────────────────────
  // Reads refresh_token from request body, validates it, rotates both tokens.
  if (path === "/api/v1/auth/refresh" && method === "POST") {
    let body;
    try {
      body = request.postDataJSON();
    } catch {
      body = {};
    }

    const sentRefreshToken = body?.refresh_token;

    if (!sentRefreshToken) {
      await fulfillError(route, 400, "refresh_token is required");
      return true;
    }

    if (sentRefreshToken !== state.refreshToken) {
      await fulfillError(route, 401, "Invalid or expired refresh token");
      return true;
    }

    // Rotate both tokens so every successful refresh produces new credentials.
    const { token: newAccessToken, refreshToken: newRefreshToken } = rotateTokens(state);

    await fulfillJson(route, {
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: "bearer",
      username: state.user.username,
      role: state.user.role,
    });
    return true;
  }

  // ── GET /api/v1/auth/me ──────────────────────────────────────────────────
  // Requires a valid Bearer token matching the current state.token.
  if (path === "/api/v1/auth/me" && method === "GET") {
    const valid = await assertBearer(route, request, state);
    if (!valid) return true;

    await fulfillJson(route, state.user);
    return true;
  }

  // ── POST /api/v1/auth/logout ─────────────────────────────────────────────
  // Requires a valid Bearer token. Records the call in state.logoutCalls.
  // When state.rejectNextLogoutWith401 is true the handler returns 401 once
  // (simulating a stale access token) and resets the flag so subsequent
  // calls succeed normally.
  if (path === "/api/v1/auth/logout" && method === "POST") {
    if (state.rejectNextLogoutWith401) {
      state.rejectNextLogoutWith401 = false;
      await fulfillError(route, 401, "Not authenticated");
      return true;
    }

    const valid = await assertBearer(route, request, state);
    if (!valid) return true;

    state.logoutCalls.push({ timestamp: new Date().toISOString() });
    await fulfillJson(route, { success: true });
    return true;
  }

  // ── POST /api/v1/auth/reset-password ────────────────────────────────────
  if (path === "/api/v1/auth/reset-password" && method === "POST") {
    const payload = request.postDataJSON();
    state.resetCalls.push(payload);
    await fulfillJson(route, {
      success: true,
      message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.",
    });
    return true;
  }

  // ── POST /api/v1/auth/change-password ────────────────────────────────────
  // Requires a valid Bearer token.  Records the call in state.changePasswordCalls.
  // When state.rejectNextChangePasswordWith is set the handler returns that
  // error once (simulating wrong current password, policy violation, etc.)
  // and resets the flag so subsequent calls succeed normally.
  if (path === "/api/v1/auth/change-password" && method === "POST") {
    const valid = await assertBearer(route, request, state);
    if (!valid) return true;

    if (state.rejectNextChangePasswordWith) {
      const { status, message } = state.rejectNextChangePasswordWith;
      state.rejectNextChangePasswordWith = null;
      await fulfillError(route, status ?? 400, message ?? "Đổi mật khẩu thất bại.");
      return true;
    }

    const payload = request.postDataJSON();
    state.changePasswordCalls.push(payload);
    await fulfillJson(route, {
      success: true,
      message: "Mật khẩu đã được đổi. Vui lòng đăng nhập lại.",
    });
    return true;
  }

  return false;
}
