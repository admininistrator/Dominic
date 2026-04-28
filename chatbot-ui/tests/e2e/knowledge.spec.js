import { expect, test } from "@playwright/test";
import {
  addDocument,
  createApiState,
  createSearchResult,
  createSessionRecord,
  installApiMocks,
  loginViaUi,
} from "./support/mockApi";

test.describe("Dominic knowledge smoke", () => {
  test("uses a selected global document only when the active chat has no session-scoped docs", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
    });
    addDocument(state, {
      sessionId: knowledgeSession.id,
      title: "session-handbook.md",
      sourceUri: "session-handbook.md",
    });
    const globalDocument = addDocument(state, {
      sessionId: null,
      title: "global-handbook.md",
      sourceUri: "global-handbook.md",
    });
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toContainText("session-handbook.md");

    await page.getByTestId("nav-knowledge-button").click();
    await page.getByTestId(`knowledge-document-${globalDocument.id}`).click();
    await page.getByTestId("nav-chat-button").click();

    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toContainText("session-handbook.md");
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).not.toContainText("global-handbook.md");

    await page.getByTestId("chat-textarea").fill("Trong tài liệu nào đang được ưu tiên?");
    await page.getByTestId("chat-send-button").click();
    await page.getByTestId("toggle-sources-button").click();
    await expect(page.getByTestId("sources-section")).toContainText("session-handbook.md");

    await page.getByTestId("new-chat-button").click();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toContainText("global-handbook.md");

    await page.getByTestId("chat-textarea").fill("Bây giờ tài liệu nào được dùng?");
    await page.getByTestId("chat-send-button").click();
    await page.getByTestId("toggle-sources-button").click();
    await expect(page.getByTestId("sources-section")).toContainText("global-handbook.md");
    await expect(page.getByTestId("sources-section")).not.toContainText("session-handbook.md");
  });

  test("knowledge search shows zero-result feedback without stale cards", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
    });
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await page.getByTestId("nav-knowledge-button").click();

    await page.getByTestId("knowledge-search-input").fill("khong ton tai");
    await page.getByTestId("knowledge-search-button").click();

    await expect(page.getByText("Search hoàn tất. Tìm thấy 0 chunks phù hợp.")).toBeVisible();
    await expect(page.getByTestId("knowledge-search-result")).toHaveCount(0);
  });

  test("knowledge search surfaces backend errors without leaving stale results", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
      searchFailure: {
        status: 503,
        detail: "Qdrant tạm thời không phản hồi.",
      },
    });
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await page.getByTestId("nav-knowledge-button").click();

    await page.getByTestId("knowledge-search-input").fill("hoàn tiền");
    await page.getByTestId("knowledge-search-button").click();

    await expect(page.getByText("[503] Qdrant tạm thời không phản hồi.")).toBeVisible();
    await expect(page.getByTestId("knowledge-search-result")).toHaveCount(0);
  });

  test("knowledge panel supports search, reindex, and delete", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
    });
    const document = addDocument(state, {
      sessionId: knowledgeSession.id,
      title: "refund-handbook.md",
      sourceUri: "refund-handbook.md",
      chunks: [
        "Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
        "Người dùng có thể nộp thêm minh chứng trong vòng 48 giờ.",
      ],
    });
    state.searchResults = [
      createSearchResult({
        document,
        snippet: "Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
      }),
    ];
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await page.getByTestId("nav-knowledge-button").click();

    await page.getByTestId("knowledge-search-input").fill("hoàn tiền");
    await page.getByTestId("knowledge-search-button").click();
    await expect(page.getByText("Search hoàn tất. Tìm thấy 1 chunks phù hợp.")).toBeVisible();
    await expect(page.getByTestId("knowledge-search-result")).toHaveCount(1);

    await page.getByTestId(`knowledge-session-${knowledgeSession.id}`).click();
    await page.getByTestId(`knowledge-document-${document.id}`).click();

    await page.getByTestId("knowledge-reindex-button").click();
    await expect(page.getByText("Reindex thành công. 2 chunks đang được đồng bộ lại.")).toBeVisible();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId("knowledge-delete-button").click();

    await page.getByTestId("nav-knowledge-button").click();
    await expect(page.getByText("Chưa có tài liệu nào. Bấm nút")).toBeVisible();
    await expect(page.getByTestId(`knowledge-document-${document.id}`)).toHaveCount(0);
  });

  test("knowledge reindex surfaces backend errors without leaving the detail view", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
      reindexFailure: {
        status: 502,
        detail: "Qdrant chưa sẵn sàng để reindex.",
      },
    });
    const document = addDocument(state, {
      sessionId: knowledgeSession.id,
      title: "refund-handbook.md",
      sourceUri: "refund-handbook.md",
    });
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await page.getByTestId("nav-knowledge-button").click();
    await page.getByTestId(`knowledge-session-${knowledgeSession.id}`).click();
    await page.getByTestId(`knowledge-document-${document.id}`).click();

    await page.getByTestId("knowledge-reindex-button").click();

    await expect(page.getByText("[502] Qdrant chưa sẵn sàng để reindex.")).toBeVisible();
    await expect(page.getByText("Chi tiết tài liệu")).toBeVisible();
    await expect(page.getByTestId(`knowledge-document-${document.id}`)).toHaveCount(0);
  });

  test("knowledge delete surfaces backend errors and keeps the document available", async ({ page }) => {
    const knowledgeSession = createSessionRecord({ id: 101, title: "Refund research room" });
    const state = createApiState({
      sessions: [knowledgeSession],
      user: {
        username: "knowledge_user",
        role: "user",
      },
      deleteFailure: {
        status: 409,
        detail: "Tài liệu đang được khóa bởi một job nền.",
      },
    });
    const document = addDocument(state, {
      sessionId: knowledgeSession.id,
      title: "refund-handbook.md",
      sourceUri: "refund-handbook.md",
    });
    await installApiMocks(page, state);

    await loginViaUi(page, { username: "knowledge_user" });
    await page.getByTestId("nav-knowledge-button").click();
    await page.getByTestId(`knowledge-session-${knowledgeSession.id}`).click();
    await page.getByTestId(`knowledge-document-${document.id}`).click();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId("knowledge-delete-button").click();

    await expect(page.getByText("[409] Tài liệu đang được khóa bởi một job nền.")).toBeVisible();
    await expect(page.getByText("Chi tiết tài liệu")).toBeVisible();
    await expect(page.getByText("refund-handbook.md").first()).toBeVisible();
  });
});