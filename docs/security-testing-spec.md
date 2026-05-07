# Security Testing Specification

**Standard:** OWASP Top 10 (2021), OWASP Mobile Top 10, OWASP ASVS Level 2, OWASP Electron Security  
**Scope:** All test files in this project must include the relevant sections for their platform.

---

## Quick Reference — Platform Coverage

| Section | API | Web | iOS | Android | Desktop (Electron) |
|---------|-----|-----|-----|---------|-------------------|
| 1. Test naming | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2. Authentication | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3. Authorization / IDOR | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4. Input validation / Injection | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5. Sensitive data exposure | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6. Token storage | — | ✓ | ✓ | ✓ | ✓ |
| 7. Transport security | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8. Platform-specific | — | ✓ | ✓ | ✓ | ✓ |
| 9. Business logic | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10. DoS / rate limiting | ✓ | ✓ | — | — | — |

---

## 1. Test Naming Convention (All Platforms)

Prefix security test descriptions with `security:` so they are grep-able and auditable:

```
security: rejects request with no Authorization header
security: user A cannot read user B's resource
security: token is not stored in plaintext localStorage
security: renderer cannot access Node.js APIs directly
```

---

## 2. Authentication (All Platforms — OWASP A07)

Every protected endpoint/screen must test:

| # | Test | Expected |
|---|------|----------|
| A1 | No `Authorization` header / no token | 401 or redirect to sign-in |
| A2 | Malformed token (`Bearer not-a-jwt`) | 401 |
| A3 | Expired token | 401 or silent refresh |
| A4 | Token signed with wrong key | 401 |
| A5 | Valid token → access granted | 2xx / screen renders |
| A6 | Sign-out clears all stored tokens | no token remains in storage |
| A7 | Sign-out redirects to sign-in screen | correct navigation |

---

## 3. Authorization / Broken Access Control (All Platforms — OWASP A01)

The most critical category. Return **404** (not 403) for cross-user access — never confirm existence.

| # | Test | Expected |
|---|------|----------|
| B1 | User A reads User B's resource (IDOR) | 404 |
| B2 | User A updates User B's resource | 404 |
| B3 | User A deletes User B's resource | 404 |
| B4 | Unauthenticated request to protected route | 401 |
| B5 | User can read/write their own resource | 2xx |

```ts
it("security: user A cannot read user B's todo", async () => {
  const res = await getRequest("/todos/user-b-id", { token: userAToken });
  expect(res.status).toBe(404);
});
```

---

## 4. Input Validation / Injection (All Platforms — OWASP A03)

Test all user-controlled string fields:

| # | Payload | Threat |
|---|---------|--------|
| C1 | `""` | Empty input bypass |
| C2 | `"   "` | Whitespace-only bypass |
| C3 | `"a".repeat(201)` | Oversized input |
| C4 | `"<script>alert(1)</script>"` | XSS |
| C5 | `"'; DROP TABLE todos; --"` | SQL/NoSQL injection |
| C6 | `"{{7*7}}"` | Template injection |
| C7 | `"../../../etc/passwd"` | Path traversal |
| C8 | `"\x00null\x00byte"` | Null byte injection |
| C9 | `"😀".repeat(100)` | Unicode edge case |

For enum fields: wrong type, out-of-range, unexpected values (`priority: "critical"`).  
For date fields: invalid format, invalid calendar date, far-future date.

```ts
const injectionPayloads = [
  "<script>alert(1)</script>",
  "'; DROP TABLE todos; --",
  "../../../etc/passwd",
  "{{7*7}}",
];
for (const payload of injectionPayloads) {
  it(`security: safely handles injection payload: ${payload}`, async () => {
    const res = await createTodo({ title: payload });
    expect([200, 201, 400]).toContain(res.status);
    if (res.status === 201) expect(res.body.title).toBe(payload); // stored verbatim
  });
}
```

---

## 5. Sensitive Data Exposure (All Platforms — OWASP A02)

| # | Test | Expected |
|---|------|----------|
| D1 | API response does not include `userId` | absent |
| D2 | API response does not include internal keys (`_id`, `pk`) | absent |
| D3 | Error response does not include stack trace | no `stack` field |
| D4 | Error response does not include file paths or DB query details | absent |
| D5 | Console/logs do not print tokens or passwords | not logged |

```ts
it("security: error response does not leak stack trace", async () => {
  repoMock.list.mockRejectedValueOnce(new Error("db exploded"));
  const body = JSON.parse((await listTodos(event())).body ?? "{}");
  expect(body.stack).toBeUndefined();
  expect(body.message).not.toMatch(/db exploded/);
});
```

---

## 6. Token Storage (Frontend Platforms)

Tokens must be stored in the **most secure storage** the platform provides.

### Web
| # | Test | Expected |
|---|------|----------|
| W-S1 | JWT is NOT stored in `localStorage` or `sessionStorage` | absent from both |
| W-S2 | JWT is stored in an HttpOnly cookie OR in-memory only | correct storage used |
| W-S3 | After sign-out, token removed from all storage | no token remains |

> **Current implementation note:** `amazon-cognito-identity-js` uses `localStorage` by default on web. This is acceptable for this app's threat model but should be noted. For higher security, configure Cognito to use cookies with `HttpOnly`.

### iOS
| # | Test | Expected |
|---|------|----------|
| I-S1 | Tokens stored in iOS Keychain, not `AsyncStorage` | Keychain used |
| I-S2 | AsyncStorage does not contain raw JWT tokens | absent |
| I-S3 | Keychain items use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | correct accessibility |

> **Current implementation note:** This app uses AsyncStorage via the Cognito SDK's memory cache. For production, replace with `react-native-keychain` for token persistence.

### Android
| # | Test | Expected |
|---|------|----------|
| A-S1 | Tokens stored in Android Keystore, not `SharedPreferences` | Keystore used |
| A-S2 | AsyncStorage (backed by SQLite) does not contain raw JWT | absent |
| A-S3 | `android:allowBackup="false"` in manifest | backups disabled |

> **Current implementation note:** Same as iOS — AsyncStorage is used currently. For production, use `react-native-keychain`.

### Desktop (Electron)
| # | Test | Expected |
|---|------|----------|
| E-S1 | Tokens NOT stored in `localStorage` in the renderer | absent |
| E-S2 | Tokens stored in OS keychain via `safeStorage` or `keytar` | correct storage |
| E-S3 | After sign-out, token removed from OS keychain | absent |

> **Current implementation note:** This app uses `localStorage` (default Cognito SDK behavior in Electron). For production, store tokens via Electron's `safeStorage` API through IPC.

---

## 7. Transport Security (All Platforms — OWASP A02)

| # | Test | Expected |
|---|------|----------|
| T1 | All API calls use HTTPS in production | `https://` URLs only |
| T2 | HTTP requests are rejected or redirected to HTTPS | no HTTP fallback |
| T3 | TLS certificate errors are not silently ignored | error thrown |

### iOS — App Transport Security (ATS)
| # | Test | Expected |
|---|------|----------|
| T-I1 | `NSAllowsArbitraryLoads` is NOT set to `true` in `Info.plist` | absent or false |
| T-I2 | All domains in `NSExceptionDomains` have `NSExceptionAllowsInsecureHTTPLoads: false` | false |

### Android — Network Security Config
| # | Test | Expected |
|---|------|----------|
| T-A1 | `network_security_config.xml` does not allow cleartext traffic in release | absent |
| T-A2 | `android:usesCleartextTraffic="false"` in manifest for release | false |

### Desktop (Electron)
| # | Test | Expected |
|---|------|----------|
| T-E1 | `webSecurity: true` in `BrowserWindow` options | true (default) |
| T-E2 | `allowRunningInsecureContent: false` | false |

---

## 8. Platform-Specific Security

### 8a. Web (OWASP A05 / CSP)

| # | Test | Expected |
|---|------|----------|
| W1 | `Content-Security-Policy` header present | set |
| W2 | CSP disallows `unsafe-inline` scripts | absent from CSP |
| W3 | `X-Frame-Options: DENY` or `frame-ancestors 'none'` | clickjacking prevented |
| W4 | `X-Content-Type-Options: nosniff` | set |
| W5 | CSRF token required for state-changing requests (if using cookies) | enforced |
| W6 | No sensitive data in URL query params (tokens, IDs) | absent from URL |
| W7 | `Referrer-Policy` set to `strict-origin-when-cross-origin` | set |

### 8b. iOS (OWASP Mobile M1–M10)

| # | Test | Expected |
|---|------|----------|
| I1 | App does not log sensitive data to NSLog/console in release builds | absent |
| I2 | Sensitive screens (auth) prevent screenshots (`FLAG_SECURE` equivalent) | enforced |
| I3 | No hardcoded credentials or API keys in source | absent |
| I4 | Biometric / Face ID gate before accessing sensitive data (if applicable) | enforced |
| I5 | App does not cache sensitive HTTP responses to disk | cache disabled |
| I6 | Pasteboard does not retain sensitive data after app backgrounding | cleared |
| I7 | Deep link / URL scheme inputs are validated before use | validated |
| I8 | Jailbreak detection warns user or restricts access | detected |

### 8c. Android (OWASP Mobile M1–M10)

| # | Test | Expected |
|---|------|----------|
| A1 | `android:debuggable="false"` in release manifest | false |
| A2 | `android:allowBackup="false"` | false |
| A3 | No exported Activities/Services/Receivers without explicit permission | not exported |
| A4 | App does not log sensitive data via `Log.d` in release builds | absent |
| A5 | Sensitive screens set `FLAG_SECURE` to prevent screenshots | set |
| A6 | No hardcoded credentials or API keys in source | absent |
| A7 | Intent data validated before use (prevent intent injection) | validated |
| A8 | Root detection warns user or restricts access | detected |
| A9 | ProGuard/R8 enabled in release build | enabled |

### 8d. Desktop / Electron (Electron Security Checklist)

| # | Test | Expected |
|---|------|----------|
| D1 | `contextIsolation: true` in all `BrowserWindow` options | true |
| D2 | `nodeIntegration: false` in all `BrowserWindow` options | false |
| D3 | `sandbox: true` in all `BrowserWindow` options | true |
| D4 | `webSecurity: true` (never disabled) | true |
| D5 | Preload script uses `contextBridge.exposeInMainWorld` — no direct Node API exposure | contextBridge used |
| D6 | IPC handlers validate all input from renderer | validated |
| D7 | `Content-Security-Policy` set in renderer HTML | set |
| D8 | `will-navigate` event handler prevents navigation to unexpected origins | enforced |
| D9 | `new-window` / `setWindowOpenHandler` prevents opening arbitrary URLs | enforced |
| D10 | Auto-updater verifies code signature before applying update | verified |
| D11 | No `eval()` or dynamic code execution in renderer | absent |

```ts
// Example: Electron main process test
it("security: BrowserWindow has contextIsolation enabled", () => {
  const win = createMainWindow();
  expect(win.webContents.getWebPreferences().contextIsolation).toBe(true);
  expect(win.webContents.getWebPreferences().nodeIntegration).toBe(false);
  expect(win.webContents.getWebPreferences().sandbox).toBe(true);
});
```

---

## 9. Business Logic (All Platforms)

| # | Test | Expected |
|---|------|----------|
| F1 | Cannot create a resource with empty/whitespace-only title | 400 |
| F2 | Cannot update a resource to an invalid state | 400 |
| F3 | Mass assignment — extra fields in request body are ignored | absent from response |
| F4 | userId in request body is ignored (taken from JWT only) | JWT sub used |

```ts
it("security: ignores userId in request body (mass assignment)", async () => {
  const res = await createTodo({ title: "x", userId: "hacker-id" });
  expect(res.body.userId).toBeUndefined();       // not in response
  // verify it was stored under the real JWT sub, not "hacker-id"
});
```

---

## 10. DoS / Rate Limiting (API + Web — OWASP A04)

| # | Test | Expected |
|---|------|----------|
| G1 | Handler does not crash on >1MB request body | 400 or 413 |
| G2 | Handler does not crash on deeply nested JSON | 400 |
| G3 | Repeated failed auth attempts trigger rate limiting | 429 |

---

## 11. Per-File Checklist

Before submitting any test file, verify:

```
[ ] Happy path (baseline)
[ ] Missing/invalid auth → 401
[ ] Cross-user resource access → 404
[ ] Missing required fields → 400
[ ] Oversized/injection input → 400 or stored verbatim
[ ] userId absent from API response bodies
[ ] Stack traces absent from error responses
[ ] Unexpected request fields ignored (no mass assignment)
[ ] Token storage uses platform-secure mechanism (Keychain/Keystore/safeStorage)
[ ] Platform-specific checks for the target platform (sections 8a–8d)
```

---

## 12. Severity Classification

| Severity | Examples |
|----------|---------|
| **Critical** | Auth bypass, IDOR, token forgery, RCE via Electron nodeIntegration |
| **High** | Injection, sensitive data in response, mass assignment, plaintext token storage |
| **Medium** | Missing rate limiting, verbose errors, missing CSP, HTTP fallback |
| **Low** | Missing security headers, overly permissive input validation |
| **Info** | Outdated dependency (no known CVE), cosmetic issues |

---

## 13. References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [OWASP Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Cheat Sheet: REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Cheat Sheet: JWT](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Apple iOS Security Guide](https://support.apple.com/guide/security/welcome/web)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)
