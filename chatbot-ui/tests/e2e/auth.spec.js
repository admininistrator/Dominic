import { expect, test } from "@playwright/test";
import { createApiState, installApiMocks } from "./support/mockApi";

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