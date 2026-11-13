# Coding Standards — 6. Testing（テスト規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

Vitest 5.1 (unit and API), Supertest 7.3 (HTTP), Playwright 1.65 (E2E) *(manifest)*.

### 6.1 File Layout

```
shared/src/schemas/nodes.test.ts          # schema unit tests, next to the source
backend/src/services/node.service.test.ts # service unit tests (pure logic, mocked or test DB)
backend/tests/nodes.api.test.ts           # API tests: Supertest + test database
backend/tests/helpers/                    # factories (createUser, createTree), login helper, DB reset
frontend/src/features/canvas/layout.test.ts
frontend/tests/e2e/editor.spec.ts         # Playwright
```

### 6.2 Naming

- `describe` = the unit or endpoint (`describe("POST /api/trees/:id/nodes")`). `it` = the behavior in plain English, starting with a verb: `it("returns 409 NODE_LIMIT_REACHED when the tree has 2,000 nodes")`.
- Test IDs from test-perspective documents (e.g. `UT-NODE-03`, `E2E-EDITOR-02`) go at the start of the `it` text so results can be traced.

### 6.3 Patterns

- Arrange / Act / Assert, separated by a blank line. One behavior per test.
- API tests cover, for every endpoint: success, validation (`400` + `details`), `401` for guests, `404` for another user's resource, and every business-rule error in its spec.
- Assert the full error shape (`code`, status), not only the status.
- Test data comes from factories in `tests/helpers/`, not from the seed script. Each test creates what it needs.
- API tests use a separate database (`highdea_test`, see §8). Tables are truncated before each test file. Tests never run against the development database.
- Don't mock Prisma in API tests; mock only external I/O (the link preview HTTP fetch, the clock for Trash purge).
- E2E tests use `data-testid` selectors and Playwright's auto-waiting (`expect(...).toBeVisible()`). No `waitForTimeout`. Run them in a desktop and a mobile viewport *(manifest)*.

❌ Bad
```ts
it("works", async () => {
  const res = await request(app).post(`/api/trees/${treeId}/nodes`).send({ title: "x" });
  expect(res.status).not.toBe(500);
});
```

✅ Good
```ts
describe("POST /api/trees/:id/nodes", () => {
  it("returns 409 NODE_LIMIT_REACHED when the tree already has 2,000 nodes", async () => {
    // Arrange
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTreeWithNodes(user.id, MAX_NODES_PER_TREE);

    // Act
    const res = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({ type: "TEXT", title: "One more idea", parentId: tree.rootId });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "NODE_LIMIT_REACHED", message: expect.any(String) } });
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({ type: "TEXT", title: "Sneaky", parentId: tree.rootId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });
});
```

```ts
// frontend/tests/e2e/editor.spec.ts
test("E2E-EDITOR-01 adds a branch to the center idea", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  await page.goto(`/trees/${treeId}/edit`);

  await page.getByTestId("node-card").first().click();
  await page.getByTestId("add-branch-button").click();
  await page.getByTestId("branch-title-input").fill("Marketing plan");
  await page.getByTestId("branch-submit").click();

  await expect(page.getByTestId("node-card").filter({ hasText: "Marketing plan" })).toBeVisible();
});
```
