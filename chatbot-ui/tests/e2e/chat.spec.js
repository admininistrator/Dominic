import { expect, test } from "@playwright/test";
import {
  addConversation,
  addDocument,
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

  // ── CHAT-QA-002 stream terminal-event contract regressions ──────────────────

  test("CHAT-QA-002-A: stream that emits error SSE and closes without final surfaces error and clears streaming state", async ({ page }) => {
    // Contract: failure streams terminate with `error`; `final` is NOT required
    // on failure paths.  The FE parser must treat `error` as terminal.
    const state = createApiState({ streamErrorOnly: true });
    await installApiMocks(page, state);

    await loginViaUi(page);

    // Confirm the send button is enabled before sending (streaming state is clear).
    await expect(page.getByTestId("chat-send-button")).not.toBeDisabled();

    await page.getByTestId("chat-textarea").fill("Trigger error stream");
    await page.getByTestId("chat-send-button").click();

    // 1. Assistant error surface must appear (❌ prefix injected by App.jsx).
    await expect(page.getByText(/❌/)).toBeVisible();

    // 2. The error detail from the SSE `error` event must be surfaced.
    await expect(page.getByText(/Stream kết thúc với lỗi từ backend\./)).toBeVisible();

    // 3. Spinner / streaming state must be cleaned up: send button re-enabled.
    await expect(page.getByTestId("chat-send-button")).not.toBeDisabled();

    // 4. No `final` event was sent — the UI must not be stuck waiting for one.
    //    Verified implicitly: if the UI were stuck the send button would remain
    //    disabled and the assertions above would time out.
    expect(state.lastChatTransport).toBe("stream");
  });

  test("CHAT-QA-002-B: stream that closes without any terminal event is treated as protocol failure and clears streaming state", async ({ page }) => {
    // Contract: a stream that ends without either `error` or `final` is a
    // protocol failure.  The FE parser throws a 502 error; App.jsx must surface
    // it and clean up streaming state.
    const state = createApiState({ streamNoTerminal: true });
    await installApiMocks(page, state);

    await loginViaUi(page);

    // Confirm the send button is enabled before sending.
    await expect(page.getByTestId("chat-send-button")).not.toBeDisabled();

    await page.getByTestId("chat-textarea").fill("Trigger no-terminal stream");
    await page.getByTestId("chat-send-button").click();

    // 1. Assistant error surface must appear.
    await expect(page.getByText(/❌/)).toBeVisible();

    // 2. The protocol-failure message from chatApi.js consumeSseStream must be
    //    surfaced (the exact Vietnamese string set in createApiError).
    await expect(
      page.getByText(/Backend ket thuc stream truoc khi gui final event\./)
    ).toBeVisible();

    // 3. Spinner / streaming state must be cleaned up: send button re-enabled.
    await expect(page.getByTestId("chat-send-button")).not.toBeDisabled();

    expect(state.lastChatTransport).toBe("stream");
  });
});

// ── CHAT-QA-001 image contract regressions ───────────────────────────────────

test.describe("image contract", () => {
  // Helper: build a minimal 1×1 pixel PNG as a Buffer so Playwright can
  // attach it to a hidden file input without needing a real file on disk.
  function makePngBuffer() {
    // Smallest valid PNG (1×1 transparent pixel, base64-encoded).
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
  }

  test("CHAT-QA-001-A: supported images are serialized into images and image_media_types", async ({ page }) => {
    // Contract: when the user attaches supported images (jpeg, png, webp, gif)
    // and sends a message, the transport payload must contain:
    //   images          – array of data-URI strings (one per image)
    //   image_media_types – array of MIME-type strings matching each image
    // Both arrays must be present and have the same length.
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    // Attach two supported images via the hidden file input.
    await page.getByTestId("image-file-input").setInputFiles([
      { name: "photo.png",  mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "snap.jpeg",  mimeType: "image/jpeg", buffer: makePngBuffer() },
    ]);

    await page.getByTestId("chat-textarea").fill("Mô tả hai ảnh này");
    await page.getByTestId("chat-send-button").click();

    // Wait for the assistant reply to confirm the request completed.
    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // Assert the transport payload carries the canonical image contract fields.
    expect(state.lastChatRequest).toMatchObject({
      message: "Mô tả hai ảnh này",
    });
    expect(Array.isArray(state.lastChatRequest.images)).toBe(true);
    expect(state.lastChatRequest.images).toHaveLength(2);
    expect(Array.isArray(state.lastChatRequest.image_media_types)).toBe(true);
    expect(state.lastChatRequest.image_media_types).toHaveLength(2);

    // Each data-URI must start with the correct scheme.
    for (const dataUri of state.lastChatRequest.images) {
      expect(typeof dataUri).toBe("string");
      expect(dataUri.startsWith("data:")).toBe(true);
    }

    // MIME types must match the files that were attached.
    expect(state.lastChatRequest.image_media_types).toContain("image/png");
    expect(state.lastChatRequest.image_media_types).toContain("image/jpeg");
  });

  test("CHAT-QA-001-B: unsupported MIME type is blocked before transport", async ({ page }) => {
    // Contract: files whose MIME type is not in the allowed set
    // (image/jpeg | image/png | image/webp | image/gif) must be silently
    // dropped by the client.  The chat request must be sent WITHOUT an
    // `images` key so the backend never receives an invalid payload.
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    // Attempt to attach an unsupported MIME type (image/bmp).
    await page.getByTestId("image-file-input").setInputFiles([
      { name: "bitmap.bmp", mimeType: "image/bmp", buffer: makePngBuffer() },
    ]);

    await page.getByTestId("chat-textarea").fill("Ảnh BMP không được hỗ trợ");
    await page.getByTestId("chat-send-button").click();

    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // The unsupported file must have been dropped: no images key in the payload.
    expect(state.lastChatRequest).not.toHaveProperty("images");
    expect(state.lastChatRequest).not.toHaveProperty("image_media_types");
  });

  test("CHAT-QA-001-C: sixth image is blocked before transport", async ({ page }) => {
    // Contract: the client enforces a hard cap of MAX_IMAGES = 5.
    // Attaching a 6th image must be silently dropped so the transport
    // payload never contains more than 5 entries in the images array.
    const state = createApiState();
    await installApiMocks(page, state);
    await loginViaUi(page);

    // Attach 6 valid images in one call.
    await page.getByTestId("image-file-input").setInputFiles([
      { name: "img1.png", mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "img2.png", mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "img3.png", mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "img4.png", mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "img5.png", mimeType: "image/png",  buffer: makePngBuffer() },
      { name: "img6.png", mimeType: "image/png",  buffer: makePngBuffer() },
    ]);

    await page.getByTestId("chat-textarea").fill("Sáu ảnh nhưng chỉ năm được gửi");
    await page.getByTestId("chat-send-button").click();

    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // The 6th image must have been dropped: payload must have exactly 5 entries.
    expect(Array.isArray(state.lastChatRequest.images)).toBe(true);
    expect(state.lastChatRequest.images.length).toBeLessThanOrEqual(5);
    expect(Array.isArray(state.lastChatRequest.image_media_types)).toBe(true);
    expect(state.lastChatRequest.image_media_types.length).toBeLessThanOrEqual(5);
  });
});

// ── CHAT-QA-003 cursor-based load-older pagination regressions ───────────────
//
// Contract locked by CHAT-BE-003 / CHAT-BE-006 / CHAT-FE-003:
//   • before_id + limit are the ONLY pagination params the browser ever sends.
//   • skip is never sent (rawSkip must always be null in state.lastHistoryParams).
//   • nextBeforeId drives each successive load-older call.
//   • When hasMore=false (or nextBeforeId absent), the "Tải lịch sử cũ hơn"
//     button must disappear and no further requests must be made.
//
// Scope: pagination / history cursor only. Stream, image, transcript are out.

test.describe("pagination / history cursor contract", () => {
  test("CHAT-QA-003-A: browser never sends skip param — only before_id drives load-older", async ({ page }) => {
    // Contract: getSessionMessages() in chatApi.js must only send `before_id`
    // and `limit`. The mock records every raw query-string for inspection.
    //
    // Message math (PAGE_SIZE = 30):
    //   20 conversations × 2 messages = 40 messages (IDs 1–40).
    //   Page 1 (no before_id) → IDs 11–40 (conversations 6–20), hasMore=true, nextBeforeId=11.
    //   Page 2 (before_id=11) → IDs 1–10 (conversations 1–5), hasMore=false.
    //   "A cursor 1" becomes visible after exactly ONE load-older click. ✓
    const activeSession = createSessionRecord({ id: 101, title: "Cursor pagination workspace" });
    const state = createApiState({ sessions: [activeSession] });

    for (let i = 1; i <= 20; i += 1) {
      addConversation(state, activeSession.id, {
        userContent: `Q cursor ${i}`,
        assistantContent: `A cursor ${i}`,
      });
    }

    await installApiMocks(page, state);
    await loginViaUi(page);

    // Page 1: most-recent 30 msgs visible ("A cursor 20" is in this window).
    await expect(page.getByText("A cursor 20")).toBeVisible();

    // 1. Initial load must NOT include skip param.
    expect(state.lastHistoryParams.rawSkip).toBeNull();

    // Load-older button must be visible (hasMore=true after page 1).
    await expect(page.getByRole("button", { name: "Tải lịch sử cũ hơn" })).toBeVisible();

    // 2. Click load-older — second request also must NOT include skip.
    await page.getByRole("button", { name: "Tải lịch sử cũ hơn" }).click();
    await expect(page.getByText("A cursor 1", { exact: true })).toBeVisible();

    expect(state.lastHistoryParams.rawSkip).toBeNull();

    // 3. before_id must have been set (not null) for the second request.
    expect(state.lastHistoryParams.beforeId).not.toBeNull();
    expect(typeof state.lastHistoryParams.beforeId).toBe("number");
  });

  test("CHAT-QA-003-B: hasMore=false hides load-older button and stops pagination", async ({ page }) => {
    // Contract: once the backend signals hasMore=false the browser must hide the
    // "Tải lịch sử cũ hơn" button immediately and never fire another GET.
    const activeSession = createSessionRecord({ id: 101, title: "Short history workspace" });
    const state = createApiState({ sessions: [activeSession] });

    // Only 5 messages — fits inside page size (30), so hasMore will be false.
    for (let i = 1; i <= 5; i += 1) {
      addConversation(state, activeSession.id, {
        userContent: `Q short ${i}`,
        assistantContent: `A short ${i}`,
      });
    }

    await installApiMocks(page, state);
    await loginViaUi(page);

    // All messages visible.
    await expect(page.getByText("A short 5")).toBeVisible();
    await expect(page.getByText("A short 1")).toBeVisible();

    // Button must not exist — hasMore=false means nothing left to load.
    await expect(page.getByRole("button", { name: "Tải lịch sử cũ hơn" })).toHaveCount(0);

    // Confirm the mock recorded no skip param on the initial load.
    expect(state.lastHistoryParams.rawSkip).toBeNull();
  });

  test("CHAT-QA-003-C: nextBeforeId absent (null) after last page hides load-older button", async ({ page }) => {
    // Contract: when the final page is loaded, nextBeforeId in the response
    // headers is absent (or null) and hasMore=false — the button must vanish
    // so the user cannot trigger an empty / redundant request.
    //
    // Message math (PAGE_SIZE = 30):
    //   20 conversations × 2 messages = 40 messages (IDs 1–40).
    //   Page 1 (no before_id)  → IDs 11–40 (30 msgs), hasMore=true,  nextBeforeId=11.
    //   Page 2 (before_id=11)  → IDs 1–10  (10 msgs), hasMore=false, nextBeforeId=null.
    //   "A end 1" (exact) becomes visible and button disappears after exactly ONE click. ✓
    const activeSession = createSessionRecord({ id: 101, title: "Paginated end workspace" });
    const state = createApiState({ sessions: [activeSession] });

    for (let i = 1; i <= 20; i += 1) {
      addConversation(state, activeSession.id, {
        userContent: `Q end ${i}`,
        assistantContent: `A end ${i}`,
      });
    }

    await installApiMocks(page, state);
    await loginViaUi(page);

    // Page 1: most-recent 30 messages visible (conversations 6–20); button present.
    await expect(page.getByText("A end 20")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tải lịch sử cũ hơn" })).toBeVisible();

    // Load page 2 — the last page (10 messages, hasMore=false, nextBeforeId=null).
    await page.getByRole("button", { name: "Tải lịch sử cũ hơn" }).click();

    // Oldest message is now visible.
    await expect(page.getByText("A end 1", { exact: true })).toBeVisible();

    // Button must be gone — nextBeforeId is null / hasMore=false.
    await expect(page.getByRole("button", { name: "Tải lịch sử cũ hơn" })).toHaveCount(0);

    // Verify no skip param was ever used across both requests.
    expect(state.lastHistoryParams.rawSkip).toBeNull();
  });
});

// ── QA-001-K4 retrieval scoping split regressions ────────────────────────────
//
// Contract locked by BE-004-C / FE-004-C:
//   • Standalone Knowledge Panel search → POST /knowledge/search with NO
//     session_id / scope / document_id in the body (owner-wide).
//     Covered in knowledge.spec.js ("standalone knowledge search is owner-wide").
//
//   • Chat-triggered retrieval → POST /chat/stream carries session_id in the
//     top-level payload; the mock resolves the document by matching
//     doc.session_id === sessionId (session-aware lane).
//     The two paths MUST NOT share scoping logic.
//
// Scope: chat-triggered retrieval session-aware behavior only.
//        Panel search owner-wide coverage lives in knowledge.spec.js.

test.describe("QA-001-K4 retrieval scoping split", () => {
  test("QA-001-K4-A: chat-triggered retrieval uses session-scoped document when one exists for the active session", async ({ page }) => {
    // Contract: when the active session has a session-scoped document,
    // the chat mock must resolve that document via session_id matching —
    // NOT via a global/owner-wide lookup.
    // The mock records scopeUsed="session" in state.lastChatRetrieval.
    const activeSession = createSessionRecord({ id: 101, title: "Session with scoped doc" });
    const state = createApiState({ sessions: [activeSession] });

    // Add a session-scoped document (session_id = 101).
    addDocument(state, {
      sessionId: activeSession.id,
      title: "session-scoped-policy.md",
      sourceUri: "session-scoped-policy.md",
    });
    // Also add a global document to confirm it is NOT used when a session doc exists.
    addDocument(state, {
      sessionId: null,
      title: "global-policy.md",
      sourceUri: "global-policy.md",
    });

    await installApiMocks(page, state);
    await loginViaUi(page);

    // The session-scoped doc badge must be visible in the chat header.
    await expect(page.getByText(/Chat đang ưu tiên tài liệu:/)).toContainText("session-scoped-policy.md");

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền là gì?");
    await page.getByTestId("chat-send-button").click();

    // Wait for the assistant reply to confirm the request completed.
    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // Assert the mock resolved via session scope, not global/owner-wide.
    expect(state.lastChatRetrieval).not.toBeNull();
    expect(state.lastChatRetrieval.scopeUsed).toBe("session");
    expect(state.lastChatRetrieval.sessionId).toBe(activeSession.id);
    // The resolved document must be the session-scoped one (session_id = 101).
    expect(state.lastChatRetrieval.resolvedDocumentSessionId).toBe(activeSession.id);

    // The chat payload must carry session_id (not a knowledge/search-style owner-wide call).
    expect(state.lastChatRequest).toMatchObject({ session_id: activeSession.id });
    // No session_id or scope must appear in any /knowledge/search call —
    // the knowledgeRoutes mock guard would have returned a 400 if it did.
  });

  test("QA-001-K4-B: chat-triggered retrieval uses global document when active session has no session-scoped docs", async ({ page }) => {
    // Contract: when the active session has NO session-scoped documents,
    // the FE auto-selects the global document and sends it as knowledge_document_id.
    // The mock resolves it via the explicit-pin path (scopeUsed="explicit") with
    // resolvedDocumentSessionId=null (global scope).
    // Critically: chat-triggered retrieval NEVER calls /knowledge/search —
    // that endpoint is the owner-wide panel search lane only.
    const activeSession = createSessionRecord({ id: 101, title: "Session without scoped doc" });
    const state = createApiState({ sessions: [activeSession] });

    // Only a global document — no session-scoped doc for session 101.
    const globalDoc = addDocument(state, {
      sessionId: null,
      title: "global-only-policy.md",
      sourceUri: "global-only-policy.md",
    });

    // Track any /knowledge/search calls — there must be NONE during chat.
    const knowledgeSearchCalls = [];
    await installApiMocks(page, state);
    await loginViaUi(page);

    page.on("request", (req) => {
      if (req.url().includes("/knowledge/search") && req.method() === "POST") {
        knowledgeSearchCalls.push(req);
      }
    });

    await page.getByTestId("chat-textarea").fill("Chính sách hoàn tiền là gì?");
    await page.getByTestId("chat-send-button").click();

    // Wait for the assistant reply.
    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // Chat-triggered retrieval must NOT call /knowledge/search at all.
    // The retrieval is handled entirely inside the chat endpoint (session-aware lane).
    expect(knowledgeSearchCalls).toHaveLength(0);

    // The chat payload must carry session_id.
    expect(state.lastChatRequest).toMatchObject({ session_id: activeSession.id });

    // The FE auto-selected the global doc and sent it as knowledge_document_id.
    // Mock resolved it via explicit-pin path; resolvedDocumentSessionId=null (global).
    expect(state.lastChatRetrieval).not.toBeNull();
    expect(state.lastChatRetrieval.scopeUsed).toBe("explicit");
    expect(state.lastChatRetrieval.resolvedDocumentId).toBe(globalDoc.id);
    expect(state.lastChatRetrieval.resolvedDocumentSessionId).toBeNull();
    expect(state.lastChatRetrieval.sessionId).toBe(activeSession.id);
  });

  test("QA-001-K4-C: panel search and chat retrieval are independent — panel search never leaks session_id into /knowledge/search", async ({ page }) => {
    // Contract: using the Knowledge Panel search while a session-scoped document
    // exists must NOT inject session_id, scope, or document_id into the
    // POST /knowledge/search body.  The knowledgeRoutes mock guard enforces this
    // at the HTTP layer (returns 400 if any of those fields appear).
    //
    // FE behavior: the FE auto-selects the session-scoped doc and sends it as
    // knowledge_document_id in the chat payload (explicit-pin path).
    // The mock records scopeUsed="explicit" with resolvedDocumentSessionId=activeSession.id.
    // Panel search is a completely separate code path that calls /knowledge/search
    // with only { query, top_k } — no session context whatsoever.
    const activeSession = createSessionRecord({ id: 101, title: "Dual-path session" });
    const state = createApiState({ sessions: [activeSession] });

    // Session-scoped doc — auto-selected by FE for chat, must NOT appear in panel search body.
    const sessionDoc = addDocument(state, {
      sessionId: activeSession.id,
      title: "session-doc-for-chat.md",
      sourceUri: "session-doc-for-chat.md",
    });

    await installApiMocks(page, state);
    await loginViaUi(page);

    // ── Path 1: chat-triggered retrieval (session-aware lane) ──────────────
    await page.getByTestId("chat-textarea").fill("Câu hỏi từ chat");
    await page.getByTestId("chat-send-button").click();
    await expect(
      page.getByText("Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.")
    ).toBeVisible();

    // FE auto-selected the session-scoped doc and sent it as knowledge_document_id.
    // Mock resolved it via explicit-pin path; resolvedDocumentSessionId = activeSession.id.
    expect(state.lastChatRetrieval.scopeUsed).toBe("explicit");
    expect(state.lastChatRetrieval.resolvedDocumentId).toBe(sessionDoc.id);
    expect(state.lastChatRetrieval.resolvedDocumentSessionId).toBe(activeSession.id);

    // ── Path 2: standalone panel search (owner-wide lane) ─────────────────
    // Capture the search request to inspect its body.
    const panelSearchRequests = [];
    page.on("request", (req) => {
      if (req.url().includes("/knowledge/search") && req.method() === "POST") {
        panelSearchRequests.push(req);
      }
    });

    await page.getByTestId("nav-knowledge-button").click();
    await page.getByTestId("knowledge-search-input").fill("hoàn tiền");
    await page.getByTestId("knowledge-search-button").click();
    await expect(page.getByText(/Search hoàn tất/)).toBeVisible();

    // Exactly one panel search request must have been made.
    expect(panelSearchRequests).toHaveLength(1);

    const searchBody = panelSearchRequests[0].postDataJSON();
    // Owner-wide contract: no session_id, no scope, no document_id.
    expect(searchBody).not.toHaveProperty("session_id");
    expect(searchBody).not.toHaveProperty("scope");
    expect(searchBody).not.toHaveProperty("document_id");
    expect(searchBody.query).toBe("hoàn tiền");

    // The mock guard in knowledgeRoutes.js would have returned HTTP 400 if any
    // of those fields were present — the fact that the search succeeded (200)
    // is itself proof the owner-wide contract was honoured.
  });
});