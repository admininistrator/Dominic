import { expect, test } from "@playwright/test";
import {
  createApiState,
  installApiMocks,
  loginViaUi,
} from "./support/mockApi";

test.describe("MCP artifact rendering", () => {
  test("P07-T02-A: message with artifacts renders artifact cards", async ({ page }) => {
    // Contract: when the SSE final event includes `artifacts` and `tool_results`,
    // the frontend must render artifact cards below the markdown content.
    const state = createApiState({ includeArtifacts: true });
    await installApiMocks(page, state);

    await loginViaUi(page);

    // Send a chat message that triggers MCP artifact response.
    await page.getByTestId("chat-textarea").fill("Vẽ sơ đồ kiến trúc");
    await page.getByTestId("chat-send-button").click();

    // Wait for the assistant reply to complete.
    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // Excalidraw artifact card should be visible.
    await expect(page.getByText("Architecture Diagram")).toBeVisible();

    // Link artifact card should be visible.
    await expect(page.getByText("Reference Link")).toBeVisible();

    // The tool_results include excalidraw — confirm at least one artifact-related
    // action button is present (e.g. "Open" button on the Excalidraw card).
    await expect(page.getByRole("button", { name: /Open/i }).first()).toBeVisible();
  });

  test("P07-T02-B: message without artifacts renders normally (regression)", async ({ page }) => {
    // Contract: when the SSE final event has no `artifacts` or `tool_results`,
    // the frontend renders identically to the pre-MCP baseline.
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền là gì?");
    await page.getByTestId("chat-send-button").click();

    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // No artifact cards should appear — the string "Architecture Diagram" is the
    // Excalidraw artifact title from the mock and should not be present.
    await expect(page.getByText("Architecture Diagram")).toHaveCount(0);

    // Normal message rendering is intact: the text content renders via ReactMarkdown.
    await expect(page.getByText(/yêu cầu hoàn tiền/)).toBeVisible();
  });

  test("renders inline Excalidraw JSON artifact preview", async ({ page }) => {
    const state = createApiState({
      includeArtifacts: true,
      includeInlineExcalidraw: true,
    });
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-textarea").fill("Váº½ sÆ¡ Ä‘á»“ use case");
    await page.getByTestId("chat-send-button").click();

    await expect(page.getByText("Inline Excalidraw Scene")).toBeVisible();
    await expect(page.getByRole("img", { name: "Excalidraw preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Inline Excalidraw Scene/i })).toBeVisible();
  });
});
