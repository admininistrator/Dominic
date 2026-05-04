export async function fulfillJson(route, payload, status = 200, headers = {}) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function fulfillText(route, body, status = 200, contentType = "text/plain", headers = {}) {
  await route.fulfill({
    status,
    contentType,
    headers,
    body,
  });
}

export async function fulfillNoContent(route) {
  await route.fulfill({
    status: 204,
    body: "",
  });
}

export async function fulfillError(route, status, detail) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ detail }),
  });
}