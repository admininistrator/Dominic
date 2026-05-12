import { expect, test } from "@playwright/test";
import { createApiState, installApiMocks, loginViaUi } from "./support/mockApi";

// localStorage key constants mirror apiClient.js
const AUTH_TOKEN_KEY = "dominic.authToken";
const REFRESH_TOKEN_KEY = "dominic.refreshToken";

/**
 * Seed both localStorage keys before the page JS runs so the app's
 * bootstrap `useEffect` picks them up on the first render.
 */
async function seedLocalStorage(page, { accessToken, refreshToken }) {
  await page.addInitScript(
    ({ atKey, rtKey, at, rt }) => {
      window.localStorage.setItem(atKey, at);
      window.localStorage.setItem(rtKey, rt);
    },
    {
      atKey: AUTH_TOKEN_KEY,
      rtKey: REFRESH_TOKEN_KEY,
      at: accessToken,
      rt: refreshToken,
    }
  );
}

test.describe("Dominic auth smoke", () => {
  test("login flow renders chat workspace", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await page.goto("/");
    await expect(page.getByText("Cùng một không gian, cùng một nhịp với màn hình chat.")).toBeVisible();

    await page.getByTestId("username-input").fill("test_user");
    await page.getByTestId("password-input").fill("StrongPass1!");
    await page.getByTestId("auth-submit-button").click();

    await expect(page.getByText("Bắt đầu một cuộc trò chuyện mới")).toBeVisible();
    await expect(page.getByTestId("account-menu-button")).toBeVisible();
  });

  test("register flow renders chat workspace", async ({ page }) => {
    const state = createApiState({
      user: {
        username: "new_member",
        role: "user",
      },
    });
    await installApiMocks(page, state);

    await page.goto("/");
    await page.getByTestId("register-mode-button").click();
    await page.getByTestId("username-input").fill("new_member");
    await page.getByTestId("password-input").fill("RegisterStrong2@");
    await page.getByTestId("confirm-password-input").fill("RegisterStrong2@");
    await page.getByTestId("auth-submit-button").click();

    await expect(page.getByText("Bắt đầu một cuộc trò chuyện mới")).toBeVisible();
    await expect(page.getByText("new_member")).toBeVisible();
  });

  test("forgot password flow uses a dedicated screen", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await page.goto("/");
    await page.getByTestId("forgot-password-link").click();
    await expect(page.getByRole("heading", { name: "Quên mật khẩu" })).toBeVisible();

    await page.getByTestId("username-input").fill("test_user");
    await page.getByTestId("reset-token-input").fill("reset-token-123");
    await page.getByTestId("password-input").fill("ResetStrong3#");
    await page.getByTestId("confirm-password-input").fill("ResetStrong3#");
    await page.getByTestId("auth-submit-button").click();

    await expect(page.getByText("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.")).toBeVisible();
    await expect(page.getByTestId("login-mode-button")).toBeVisible();
    await expect.poll(() => state.resetCalls.length).toBe(1);
  });
});

test.describe("session recovery", () => {
  test("bootstrap with valid stored token bypasses login and shows workspace", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    // Seed the canonical seed tokens so /auth/me immediately resolves 200.
    await seedLocalStorage(page, {
      accessToken: state.token,         // "smoke-token"
      refreshToken: state.refreshToken, // "smoke-refresh-token"
    });

    await page.goto("/");

    // Workspace should be shown without ever touching the login form.
    await expect(page.getByTestId("chat-textarea")).toBeVisible();
    // No rotation: refresh was not needed.
    expect(state.tokenGeneration).toBe(0);
  });

  test("stale access token triggers refresh, rotated token replays /auth/me, session is recovered", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    // Stale access token won't match state.token → /auth/me returns 401.
    // Valid refresh token matches state.refreshToken → refresh succeeds, tokens rotate.
    await seedLocalStorage(page, {
      accessToken: "stale-access-token",
      refreshToken: state.refreshToken, // "smoke-refresh-token" — still valid
    });

    await page.goto("/");

    // Workspace must appear: the 401 → refresh → replay chain recovered the session.
    await expect(page.getByTestId("chat-textarea")).toBeVisible();
    // Exactly one refresh cycle occurred.
    await expect.poll(() => state.tokenGeneration).toBe(1);
  });

  test("stale access token with valid refresh token shows workspace and never shows login screen", async ({ page }) => {
    const state = createApiState({ user: { username: "returning_user", role: "user" } });
    await installApiMocks(page, state);

    await seedLocalStorage(page, {
      accessToken: "stale-access-token",
      refreshToken: state.refreshToken,
    });

    await page.goto("/");

    // The login form must not appear — user never had to re-authenticate.
    await expect(page.getByTestId("username-input")).not.toBeVisible();
    // Workspace is shown and the correct identity is reflected in the UI.
    await expect(page.getByTestId("chat-textarea")).toBeVisible();
    await expect(page.getByText("returning_user")).toBeVisible();
  });

  test("expired refresh token causes app to fall back to login screen", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    // Stale access token → 401 on /auth/me.
    // Invalid refresh token → 401 on /auth/refresh → clearAuthSession → login screen.
    await seedLocalStorage(page, {
      accessToken: "stale-access-token",
      refreshToken: "expired-refresh-token",
    });

    await page.goto("/");

    // App must surface the login form; the workspace must not be visible.
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("chat-textarea")).not.toBeVisible();
    // Tokens were not rotated — refresh was rejected before rotation.
    expect(state.tokenGeneration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helper: open the account menu and trigger the logout confirmation flow.
// ---------------------------------------------------------------------------
async function triggerLogout(page) {
  await page.getByTestId("account-menu-button").click();
  await page.getByTestId("account-settings-tab").click();
  await page.getByTestId("logout-button").click();
  await page.getByTestId("logout-confirm-button").click();
}

test.describe("logout", () => {
  test("normal logout calls /auth/logout once and returns to login screen", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    await triggerLogout(page);

    // The login form must appear — the workspace session was torn down.
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("chat-textarea")).not.toBeVisible();
    // Backend was notified exactly once.
    await expect.poll(() => state.logoutCalls.length).toBe(1);
    // No token rotation: the access token was still fresh.
    expect(state.tokenGeneration).toBe(0);
  });

  test("stale access token + valid refresh → refresh once, logout retry once, local state cleared", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    // Simulate an expired access token exactly at logout time.
    // The refresh token stored in the browser still matches state.refreshToken,
    // so the refresh succeeds and tokens are rotated.
    state.rejectNextLogoutWith401 = true;

    await triggerLogout(page);

    // App must return to login screen regardless of the extra round-trip.
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("chat-textarea")).not.toBeVisible();
    // The retry logout reached the server exactly once.
    await expect.poll(() => state.logoutCalls.length).toBe(1);
    // Exactly one refresh cycle occurred.
    expect(state.tokenGeneration).toBe(1);
  });

  test("stale access token + invalid refresh → no retry loop, local state still cleared, app returns to login", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    // First logout attempt will be rejected with 401.
    // The refresh token the server expects has also been invalidated, so the
    // refresh call will fail → logout retry never fires.
    state.rejectNextLogoutWith401 = true;
    state.refreshToken = "invalidated-refresh-token"; // browser still holds old token

    await triggerLogout(page);

    // The app must still return to login — local state is always cleared in finally.
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("chat-textarea")).not.toBeVisible();
    // Logout retry never reached the server; refresh was rejected first.
    await expect.poll(() => state.logoutCalls.length).toBe(0);
    // No token rotation — refresh was rejected.
    expect(state.tokenGeneration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helper: open account menu → Settings tab → "Đổi mật khẩu" accordion.
// Returns after the password form is visible.
// ---------------------------------------------------------------------------
async function openChangePasswordForm(page) {
  await page.getByTestId("account-menu-button").click();
  await page.getByTestId("account-settings-tab").click();
  // The accordion toggle button contains the text "Đổi mật khẩu".
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  // Wait for the form to animate in — the submit button is the stable anchor.
  await expect(page.getByRole("button", { name: "Lưu mật khẩu mới" })).toBeVisible();
}

test.describe("change-password", () => {
  test("success → local auth state cleared, app returns to login screen", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    await openChangePasswordForm(page);

    // Fill the three password fields by placeholder text.
    // Use exact:true on the new-password field to avoid matching the confirm field.
    await page.getByPlaceholder("Mật khẩu hiện tại").fill("OldPass1!");
    await page.getByPlaceholder("Mật khẩu mới (8-16 ký tự)", { exact: true }).fill("NewPass2@");
    await page.getByPlaceholder("Xác nhận mật khẩu mới (8-16 ký tự)").fill("NewPass2@");
    await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();

    // App must return to the login screen — auth state was cleared.
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("chat-textarea")).not.toBeVisible();

    // The backend received exactly one change-password call.
    await expect.poll(() => state.changePasswordCalls.length).toBe(1);
    expect(state.changePasswordCalls[0]).toMatchObject({
      old_password: "OldPass1!",
      new_password: "NewPass2@",
      confirm_new_password: "NewPass2@",
    });

    // localStorage tokens must have been cleared.
    const storedToken = await page.evaluate(() => localStorage.getItem("dominic.authToken"));
    expect(storedToken).toBeNull();
  });

  test("failure → account settings surface stays open, inline error feedback is shown", async ({ page }) => {
    const state = createApiState();
    // Pre-configure the mock to reject the next change-password attempt.
    state.rejectNextChangePasswordWith = {
      status: 400,
      message: "Mật khẩu hiện tại không đúng.",
    };
    await installApiMocks(page, state);
    await loginViaUi(page);

    await openChangePasswordForm(page);

    await page.getByPlaceholder("Mật khẩu hiện tại").fill("WrongOld1!");
    await page.getByPlaceholder("Mật khẩu mới (8-16 ký tự)", { exact: true }).fill("NewPass2@");
    await page.getByPlaceholder("Xác nhận mật khẩu mới (8-16 ký tự)").fill("NewPass2@");
    await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();

    // Inline error feedback must appear inside the still-open settings surface.
    await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();

    // The workspace must still be shown — the user was NOT logged out.
    await expect(page.getByTestId("chat-textarea")).toBeVisible();
    await expect(page.getByTestId("username-input")).not.toBeVisible();

    // The submit button must still be present (form not torn down).
    await expect(page.getByRole("button", { name: "Lưu mật khẩu mới" })).toBeVisible();

    // No successful change-password call was recorded.
    expect(state.changePasswordCalls.length).toBe(0);
  });
});