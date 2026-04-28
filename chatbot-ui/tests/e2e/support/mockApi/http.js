export async function fulfillJson(route, payload, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
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