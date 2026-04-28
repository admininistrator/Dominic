import { expect } from "@playwright/test";
import { handleAuthRoute } from "./mockApi/authRoutes";
import { handleChatRoute } from "./mockApi/chatRoutes";
import { handleKnowledgeRoute } from "./mockApi/knowledgeRoutes";
import {
  addConversation,
  addDocument,
  createApiState,
  createSearchResult,
  createSessionRecord,
  isoNow,
} from "./mockApi/state";

export {
  addConversation,
  addDocument,
  createApiState,
  createSearchResult,
  createSessionRecord,
  isoNow,
};

export async function installApiMocks(page, state) {
  const routeHandlers = [handleAuthRoute, handleChatRoute, handleKnowledgeRoute];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    for (const handler of routeHandlers) {
      const handled = await handler({ route, request, url, path, method, state });
      if (handled) {
        return;
      }
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: `Unhandled mock route: ${method} ${path}` }),
    });
  });
}

export async function loginViaUi(page, { username = "test_user", password = "StrongPass1!" } = {}) {
  await page.goto("/");
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("auth-submit-button").click();
  await expect(page.getByTestId("chat-textarea")).toBeVisible();
}