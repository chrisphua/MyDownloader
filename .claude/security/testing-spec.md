# Security Testing Specification

**Standard:** OWASP Top 10 (2021), OWASP Testing Guide v4.2, ASVS Level 2  
**Scope:** All test files in this project must include the relevant sections below.

---

## 1. Test Naming Convention

Prefix security test descriptions with `security:` so they are grep-able and auditable:

```
security: rejects request with no Authorization header
security: user A cannot read user B's resource
security: rejects title longer than 200 characters
security: error response does not leak stack trace
```

---

## 2. Authentication (OWASP A07)

Every protected endpoint **must** have tests for:

| # | Test | Expected |
|---|------|----------|
| A1 | No `Authorization` header | 401 / 400 |
| A2 | Malformed token (`Bearer not-a-jwt`) | 401 / 400 |
| A3 | Expired token | 401 |
| A4 | Token signed with wrong key | 401 |
| A5 | Valid token → access granted | 2xx |

```ts
// Example pattern
it("security: rejects request with no Authorization header", async () => {
  const res = await request(app).get("/todos");
  expect(res.status).toBe(401);
});
```

---

## 3. Authorization / Broken Access Control (OWASP A01)

The most critical category. Every resource endpoint must test:

| # | Test | Expected |
|---|------|----------|
| B1 | User A reads User B's resource (IDOR) | 404 (not 403 — do not confirm existence) |
| B2 | User A updates User B's resource | 404 |
| B3 | User A deletes User B's resource | 404 |
| B4 | Unauthenticated request to protected route | 401 |
| B5 | User can read/write their own resource | 2xx |

Return **404** (not 403) for cross-user access — never confirm the resource exists.

```ts
it("security: user A cannot read user B's todo", async () => {
  const res = await getRequest("/todos/user-b-todo-id", { token: userAToken });
  expect(res.status).toBe(404);
});
```

---

## 4. Input Validation / Injection (OWASP A03)

Test all user-controlled string fields with:

| # | Payload | Threat |
|---|---------|--------|
| C1 | `""` (empty string) | Empty input bypass |
| C2 | `" "` (whitespace only) | Whitespace bypass |
| C3 | `"a".repeat(201)` | Oversized input / buffer issues |
| C4 | `"<script>alert(1)</script>"` | XSS (stored/reflected) |
| C5 | `"'; DROP TABLE todos; --"` | SQL injection |
| C6 | `"{{7*7}}"` | Server-Side Template Injection |
| C7 | `"../../../etc/passwd"` | Path traversal |
| C8 | `"\x00null\x00byte"` | Null byte injection |
| C9 | `"😀".repeat(100)` | Unicode / encoding edge case |

For numeric/enum fields:
- Wrong type (e.g. `done: "yes"` instead of boolean)
- Out-of-range values
- Unexpected enum values (`priority: "critical"`)

For date fields:
- Invalid format (`"not-a-date"`)
- Invalid calendar date (`"2024-13-45"`)
- Far-future date (`"9999-12-31"`)

```ts
const injectionPayloads = [
  "<script>alert(1)</script>",
  "'; DROP TABLE todos; --",
  "../../../etc/passwd",
  "{{7*7}}",
];

for (const payload of injectionPayloads) {
  it(`security: safely handles injection payload in title: ${payload}`, async () => {
    const res = await createTodo({ title: payload });
    // Must either store it safely or reject it — never execute it
    expect([200, 201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.title).toBe(payload); // stored verbatim, not executed
    }
  });
}
```

---

## 5. Sensitive Data Exposure (OWASP A02)

| # | Test | Expected |
|---|------|----------|
| D1 | Response body does not include `userId` | `userId` absent |
| D2 | Response body does not include internal keys (`_id`, `pk`) | absent |
| D3 | Error response does not include stack trace | no `stack` field |
| D4 | Error response does not include file paths | no absolute paths |
| D5 | Error response does not include DB query details | no query strings |

```ts
it("security: error response does not leak stack trace", async () => {
  // force a 500
  repoMock.list.mockRejectedValueOnce(new Error("db exploded"));
  const res = await listTodos(event());
  const body = JSON.parse(res.body ?? "{}");
  expect(body.stack).toBeUndefined();
  expect(body.message).not.toMatch(/db exploded/); // internal message not leaked
});

it("security: response does not expose userId", async () => {
  const res = await listTodos(event());
  const todos = JSON.parse(res.body ?? "[]");
  for (const todo of todos) {
    expect(todo.userId).toBeUndefined();
  }
});
```

---

## 6. Security Misconfiguration (OWASP A05)

| # | Test | Expected |
|---|------|----------|
| E1 | CORS `Access-Control-Allow-Origin` present | header set |
| E2 | Content-Type is `application/json` on all JSON responses | header set |
| E3 | Disallowed HTTP methods return 405 | 405 |

---

## 7. Business Logic

| # | Test | Expected |
|---|------|----------|
| F1 | Cannot create a todo with an empty title after trimming | 400 |
| F2 | Cannot update a todo to an invalid state | 400 |
| F3 | Pagination/limit params cannot be manipulated to dump all data | bounded result |
| F4 | Mass assignment — extra fields in request body are ignored | no extra fields in response |

```ts
it("security: ignores unexpected fields in request body (mass assignment)", async () => {
  const res = await createTodo({ title: "x", isAdmin: true, userId: "hacker" });
  expect(res.body.isAdmin).toBeUndefined();
  expect(res.body.userId).toBeUndefined();
});
```

---

## 8. Rate Limiting & Denial of Service (OWASP A04)

For unit/integration tests — verify the handler does not crash on:

| # | Test |
|---|------|
| G1 | Very large request body (>1MB string) |
| G2 | Deeply nested JSON object |
| G3 | Array with thousands of items |

---

## 9. Cryptography & Token Security (OWASP A02)

| # | Test |
|---|------|
| H1 | JWT `sub` claim is used as userId, not a user-supplied field |
| H2 | Token from one environment cannot be used in another |
| H3 | Two successive tokens are not identical (no replay via static token) |

---

## 10. Checklist — Per Test File

When writing **any** test file, verify these are covered:

```
[ ] Happy path (baseline functionality)
[ ] Missing auth → 401
[ ] Wrong user's resource → 404
[ ] Missing required fields → 400
[ ] Oversized input → 400
[ ] XSS payload stored safely or rejected
[ ] SQL/NoSQL injection payload rejected or stored verbatim
[ ] userId absent from response bodies
[ ] Stack trace absent from error responses
[ ] Unexpected request fields ignored
```

---

## 11. Severity Classification

Use this when logging security findings:

| Severity | Examples |
|----------|---------|
| **Critical** | Auth bypass, horizontal privilege escalation, token forgery |
| **High** | Injection vulnerabilities, sensitive data in response, mass assignment |
| **Medium** | Missing rate limiting, verbose errors, CORS misconfiguration |
| **Low** | Missing security headers, overly permissive input validation |
| **Info** | Outdated dependency (no known exploit), cosmetic issues |

---

## 12. References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Cheat Sheet: REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Cheat Sheet: JWT](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
