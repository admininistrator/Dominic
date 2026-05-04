import { expect, test } from "@playwright/test";
import {
  addConversation,
  createApiState,
  createSessionRecord,
  installApiMocks,
  loginViaUi,
} from "./support/mockApi";

test.describe("Dominic chat smoke", () => {
  test("deletes the last remaining session and recreates Chat 1", async ({ page }) => {
    const onlySession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const state = createApiState({
      sessions: [onlySession],
    });
    addConversation(state, onlySession.id, {
      userContent: "Điều kiện hoàn tiền là gì?",
      assistantContent: "Session duy nhất sẽ bị xóa và tạo lại Chat 1.",
    });
    await installApiMocks(page, state);

    await loginViaUi(page);
    await expect(page.getByText("Session duy nhất sẽ bị xóa và tạo lại Chat 1.")).toBeVisible();

    await page.getByTestId(`sidebar-session-${onlySession.id}`).hover();
    await page.getByTestId(`delete-session-button-${onlySession.id}`).click({ force: true });

    await expect(page.getByText("Session duy nhất sẽ bị xóa và tạo lại Chat 1.")).toHaveCount(0);
    await expect(page.getByText("Bắt đầu một cuộc trò chuyện mới")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chat 1" })).toBeVisible();
  });

  test("uploads multiple knowledge file types into the active session", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("knowledge-file-input").setInputFiles({
      name: "policy.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Refund policy\n\nRequests are reviewed within five business days."),
    });
    await expect(page.getByText(/Upload thành công\. Document #1 đã tạo 2 chunks\./)).toBeVisible();
    await expect(page.getByText("policy.md").first()).toBeVisible();

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("knowledge-file-input").setInputFiles({
      name: "guide.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 smoke pdf"),
    });
    await expect(page.getByText(/Upload thành công\. Document #2 đã tạo 2 chunks\./)).toBeVisible();
    await expect(page.getByText("guide.pdf").first()).toBeVisible();

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("knowledge-file-input").setInputFiles({
      name: "faq.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK smoke docx"),
    });
    await expect(page.getByText(/Upload thành công\. Document #3 đã tạo 2 chunks\./)).toBeVisible();
    await expect(page.getByText("faq.docx").first()).toBeVisible();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toBeVisible();
  });

  test("shows upload errors inline without creating a session document badge", async ({ page }) => {
    const state = createApiState({
      uploadFailure: {
        status: 422,
        detail: "File PDF vượt quá giới hạn cho phép.",
      },
    });
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("knowledge-file-input").setInputFiles({
      name: "oversize.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 oversize mock"),
    });

    await expect(page.getByText("[422] File PDF vượt quá giới hạn cho phép.")).toBeVisible();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toHaveCount(0);
    await expect(page.getByText("oversize.pdf")).toHaveCount(0);
  });

  test("shows ingest errors inline without creating session-scoped knowledge", async ({ page }) => {
    const state = createApiState({
      ingestFailure: {
        status: 422,
        detail: "Nội dung ingest quá ngắn để tạo chunk.",
      },
    });
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("ingest-text-button").click();
    await page.getByTestId("ingest-title-input").fill("short-note");
    await page.getByTestId("ingest-textarea").fill("ngan");
    await page.getByTestId("ingest-submit-button").click();

    await expect(page.getByText("[422] Nội dung ingest quá ngắn để tạo chunk.")).toBeVisible();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toHaveCount(0);
    await expect(page.getByText("short-note")).toHaveCount(0);
  });

  test("filters conversations with sidebar search", async ({ page }) => {
    const refundSession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const escalationSession = createSessionRecord({ id: 102, title: "Escalation queue" });
    const invoiceSession = createSessionRecord({ id: 103, title: "Invoice support" });
    const state = createApiState({
      sessions: [refundSession, escalationSession, invoiceSession],
    });
    addConversation(state, refundSession.id, {
      userContent: "Điều kiện hoàn tiền là gì?",
      assistantContent: "Lịch sử session hoàn tiền đang được hiển thị.",
    });
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTitle("Tìm kiếm").click();
    await page.getByPlaceholder("Tìm hội thoại...").fill("invoice");

    await expect(page.getByTestId(`sidebar-session-${invoiceSession.id}`)).toBeVisible();
    await expect(page.getByTestId(`sidebar-session-${refundSession.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`sidebar-session-${escalationSession.id}`)).toHaveCount(0);

    await page.getByPlaceholder("Tìm hội thoại...").fill("missing-session");
    await expect(page.getByText("Không có hội thoại.")).toBeVisible();
  });

  test("creates a new chat and clears the previous session history", async ({ page }) => {
    const activeSession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const secondSession = createSessionRecord({ id: 102, title: "Escalation queue" });
    const state = createApiState({
      sessions: [activeSession, secondSession],
    });
    addConversation(state, activeSession.id, {
      userContent: "Điều kiện hoàn tiền là gì?",
      assistantContent: "Lịch sử cũ sẽ biến mất khi tạo chat mới.",
    });
    await installApiMocks(page, state);

    await loginViaUi(page);
    await expect(page.getByText("Lịch sử cũ sẽ biến mất khi tạo chat mới.")).toBeVisible();

    await page.getByTestId("new-chat-button").click();

    await expect(page.getByText("Lịch sử cũ sẽ biến mất khi tạo chat mới.")).toHaveCount(0);
    await expect(page.getByText("Bắt đầu một cuộc trò chuyện mới")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chat 3" })).toBeVisible();
  });

  test("sends the selected 9router model with web search enabled", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-model-select").click();
    await expect(page.getByTestId("chat-model-menu")).toBeVisible();
    await page.getByTestId("chat-model-option-claude-sonnet-4.6").click();
    await page.getByTestId("web-search-toggle").click();
    await page.getByTestId("chat-textarea").fill("Tin moi nhat ve PostgreSQL la gi?");
    await page.getByTestId("chat-send-button").click();

    await expect(page.getByText("Theo Tavily, tôi đang trả lời bằng claude-sonnet-4.6.")).toBeVisible();
    expect(state.lastChatRequest).toMatchObject({
      model: "claude-sonnet-4.6",
      use_web_search: true,
    });
    expect(state.lastChatTransport).toBe("stream");
  });

  test("stores and sends thinking effort for the selected GPT model", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-model-select").click();
    await expect(page.getByTestId("chat-model-menu")).toBeVisible();
    await page.getByTestId("chat-model-option-gpt-5.4-mini").click();
    await page.getByTestId("chat-thinking-effort-select").click();
    await expect(page.getByTestId("chat-thinking-effort-menu")).toBeVisible();
    await expect(page.getByTestId("chat-thinking-effort-xhigh")).toBeDisabled();
    await page.getByTestId("chat-thinking-effort-high").click();
    await page.getByTestId("chat-textarea").fill("Kiem tra thinking effort theo model");
    await page.getByTestId("chat-send-button").click();
    await expect(page.getByText("GPT-5.4 Mini High")).toBeVisible();

    expect(state.lastChatRequest).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning_effort: "high",
    });
  });

  test("shows limited thinking effort options for Claude Sonnet and hides them for Claude Haiku and Gemini", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-model-select").click();
    await page.getByTestId("chat-model-option-claude-sonnet-4.6").click();
    await expect(page.getByTestId("chat-thinking-effort-select")).toBeVisible();
    await page.getByTestId("chat-thinking-effort-select").click();
    await expect(page.getByTestId("chat-thinking-effort-low")).toBeVisible();
    await expect(page.getByTestId("chat-thinking-effort-medium")).toBeVisible();
    await expect(page.getByTestId("chat-thinking-effort-high")).toBeVisible();
    await expect(page.getByTestId("chat-thinking-effort-xhigh")).toHaveCount(0);
    await page.mouse.click(10, 10);

    await page.getByTestId("chat-model-select").click();
    await page.getByTestId("chat-model-option-claude-haiku-4.5").click();
    await expect(page.getByTestId("chat-thinking-effort-select")).toHaveCount(0);

    await page.getByTestId("chat-model-select").click();
    await page.getByTestId("chat-model-option-gemini-3.1-pro-preview").click();
    await expect(page.getByTestId("chat-thinking-effort-select")).toHaveCount(0);
  });

  test("expands web search label when toggled on", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await expect(page.getByTestId("web-search-toggle")).toContainText("Web search");
    await page.getByTestId("web-search-toggle").click();
    await expect(page.getByTestId("web-search-toggle")).toContainText("Web search đang bật");
  });

  test("shows the delete action for the active session on hover", async ({ page }) => {
    const activeSession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const secondSession = createSessionRecord({ id: 102, title: "Escalation queue" });
    const state = createApiState({
      sessions: [activeSession, secondSession],
    });
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId(`sidebar-session-${activeSession.id}`).hover();
    await expect(page.getByTestId(`delete-session-button-${activeSession.id}`)).toBeVisible();
  });

  test("deletes a session and falls back to the remaining history", async ({ page }) => {
    const activeSession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const fallbackSession = createSessionRecord({ id: 102, title: "Escalation queue" });
    const state = createApiState({
      sessions: [activeSession, fallbackSession],
    });
    addConversation(state, activeSession.id, {
      userContent: "Điều kiện hoàn tiền là gì?",
      assistantContent: "Lịch sử session hoàn tiền đang được hiển thị.",
    });
    addConversation(state, fallbackSession.id, {
      userContent: "Escalation queue hoạt động ra sao?",
      assistantContent: "Lịch sử fallback session được tải khi session đầu bị xóa.",
    });
    await installApiMocks(page, state);

    await loginViaUi(page);
    await expect(page.getByText("Lịch sử session hoàn tiền đang được hiển thị.")).toBeVisible();

    await page.getByTestId(`sidebar-session-${activeSession.id}`).hover();
    await page.getByTestId(`delete-session-button-${activeSession.id}`).click({ force: true });
    await expect(page.getByTestId(`sidebar-session-${activeSession.id}`)).toHaveCount(0);
    await expect(page.getByText("Lịch sử fallback session được tải khi session đầu bị xóa.")).toBeVisible();
  });

  test("switches between chat sessions and loads the right history", async ({ page }) => {
    const policySession = createSessionRecord({ id: 101, title: "Refund policy workspace" });
    const escalationSession = createSessionRecord({ id: 102, title: "Escalation queue" });
    const state = createApiState({
      sessions: [policySession, escalationSession],
    });
    addConversation(state, policySession.id, {
      userContent: "Điều kiện hoàn tiền là gì?",
      assistantContent: "Phiên hoàn tiền đang hiển thị lịch sử của session đầu tiên.",
    });
    addConversation(state, escalationSession.id, {
      userContent: "Escalation queue hoạt động ra sao?",
      assistantContent: "Phiên escalation hiển thị lịch sử khác với session hoàn tiền.",
    });
    await installApiMocks(page, state);

    await loginViaUi(page);
    await expect(page.getByText("Phiên hoàn tiền đang hiển thị lịch sử của session đầu tiên.")).toBeVisible();

    await page.getByTestId(`sidebar-session-${escalationSession.id}`).click();
    await expect(page.getByText("Phiên escalation hiển thị lịch sử khác với session hoàn tiền.")).toBeVisible();
    await expect(page.getByText("Phiên hoàn tiền đang hiển thị lịch sử của session đầu tiên.")).toHaveCount(0);
  });

  test("loads older messages from paginated session history", async ({ page }) => {
    const activeSession = createSessionRecord({ id: 101, title: "Paginated history workspace" });
    const state = createApiState({
      sessions: [activeSession],
    });

    for (let index = 1; index <= 40; index += 1) {
      addConversation(state, activeSession.id, {
        userContent: `Câu hỏi lịch sử ${index}`,
        assistantContent: `Câu trả lời lịch sử ${index}`,
      });
    }

    await installApiMocks(page, state);

    await loginViaUi(page);

  await expect(page.getByText("Câu trả lời lịch sử 40")).toBeVisible();
  await expect(page.getByText("Câu trả lời lịch sử 26")).toBeVisible();
  await expect(page.getByText(/^Câu trả lời lịch sử 10$/)).toHaveCount(0);

    await page.getByRole("button", { name: "Tải lịch sử cũ hơn" }).click();

  await expect(page.getByText(/^Câu trả lời lịch sử 11$/)).toBeVisible();
  await expect(page.getByText(/^Câu trả lời lịch sử 1$/)).toHaveCount(0);

    await page.getByRole("button", { name: "Tải lịch sử cũ hơn" }).click();

    await expect(page.getByText(/^Câu trả lời lịch sử 1$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tải lịch sử cũ hơn" })).toHaveCount(0);
  });

  test("ingests raw text into the active session without leaking sources to a new chat", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-import-button").click();
    await page.getByTestId("ingest-text-button").click();
    await page.getByTestId("ingest-title-input").fill("refund-policy-note");
    await page.getByTestId("ingest-textarea").fill("Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.");
    await page.getByTestId("ingest-submit-button").click();

    await expect(page.getByText(/Ingest thành công\. Document #1 đã tạo 1 chunks\./)).toBeVisible();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toBeVisible();

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền xử lý trong bao lâu?");
    await page.getByTestId("chat-send-button").click();
    await expect(page.getByTestId("toggle-sources-button")).toBeVisible();

    await page.getByTestId("new-chat-button").click();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toHaveCount(0);

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền xử lý trong bao lâu?");
    await page.getByTestId("chat-send-button").click();
    await expect(page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")).toBeVisible();
    await expect(page.getByTestId("toggle-sources-button")).toHaveCount(0);
  });

  test("upload document, ask grounded chat, view sources, and confirm logout", async ({ page }) => {
    const state = createApiState();
    await installApiMocks(page, state);

    await loginViaUi(page);

    await page.getByTestId("chat-import-button").click();
    await expect(page.getByText("Import Source")).toBeVisible();
    await page.getByTestId("knowledge-file-input").setInputFiles({
      name: "smoke-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Refund policy: requests are reviewed within 5 business days."),
    });

    await expect(page.getByText(/Upload thành công\. Document #1 đã tạo 2 chunks\./)).toBeVisible();
    await expect(page.getByText("smoke-upload.txt").first()).toBeVisible();
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toBeVisible();

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền xử lý trong bao lâu?");
    await page.getByTestId("chat-send-button").click();

    await expect(page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")).toBeVisible();
    await page.getByTestId("toggle-sources-button").click();
    await expect(page.getByTestId("sources-section")).toBeVisible();
    await expect(page.getByTestId("source-card")).toHaveCount(1);

    await page.getByTestId("account-menu-button").click();
    await page.getByTestId("account-settings-tab").click();
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("logout-confirm-panel")).toBeVisible();
    await page.getByTestId("logout-confirm-button").click();

    await expect(page.getByTestId("auth-submit-button")).toBeVisible();
    await expect(page.getByText("Cùng một không gian, cùng một nhịp với màn hình chat.")).toBeVisible();
  });
});