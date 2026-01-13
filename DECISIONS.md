# GA-AppLockerGUI - Architectural Decisions

**Version:** 1.2.9
**Date:** 2026-01-13
**Decision Authority:** Development Team (Full)

---

## Decision Log

### DEC-001: Use Environment Variables for Credential Passing

**Context:**
Passwords were being passed as command-line arguments to PowerShell scripts, making them visible in process listings.

**Decision:**
Pass credentials via environment variables with random names, then immediately clear after reading.

**Rationale:**
- Environment variables are not visible in `Get-Process` or `wmic process` output
- Random variable names prevent prediction attacks
- Immediate clearing minimizes exposure window

**Alternatives Considered:**
1. Windows Credential Manager - More complex, requires additional setup
2. Named pipes - Overkill for single-use credentials
3. Encrypted config file - Still requires decryption key management

**Trade-offs:**
- (+) Simple implementation
- (+) No additional dependencies
- (-) Still in memory briefly
- (-) Requires script modifications

---

### DEC-002: Whitelist Validation for PowerShell Parameters

**Context:**
User-controlled parameters were being interpolated into PowerShell commands, enabling injection attacks.

**Decision:**
Implement strict whitelist validation for all PowerShell parameters.

**Rationale:**
- Whitelists are more secure than blacklists
- Fail-closed approach rejects unknown values
- Easier to audit and maintain

**Implementation:**
```javascript
const ALLOWED_ENFORCEMENT_MODES = ['AuditOnly', 'Enabled', 'NotConfigured'];
const ALLOWED_RULE_ACTIONS = ['Allow', 'Deny'];
const ALLOWED_COLLECTION_TYPES = ['Exe', 'Msi', 'Script', 'Dll', 'Appx'];
```

---

### DEC-003: Path Whitelist for File Operations

**Context:**
The `fs:writeFile` IPC handler accepted arbitrary paths, enabling path traversal attacks.

**Decision:**
Implement path validation against a whitelist of allowed directories.

**Allowed Directories:**
- Current working directory
- System temp directory
- User home directory
- User Documents
- User AppData
- `C:\AppLockerBackups`
- `C:\AppLocker`

**Rationale:**
- Covers legitimate use cases
- Prevents writing to system directories
- Prevents overwriting application files

**Trade-offs:**
- (+) Strong security boundary
- (-) May require adjustment for edge cases
- (-) Users cannot save to arbitrary locations

---

### DEC-004: Use crypto.randomUUID() for Rule IDs

**Context:**
Rule IDs were being generated with `Math.random()`, which is predictable.

**Decision:**
Use `crypto.randomUUID()` for all rule ID generation.

**Rationale:**
- Cryptographically secure random number generation
- UUID format is standard and well-understood
- 122 bits of entropy (vs ~53 for Math.random)

**Fallback Chain:**
1. Web Crypto API (`crypto.randomUUID()`)
2. Node.js crypto module
3. `crypto.getRandomValues()` with manual formatting
4. Timestamp + Math.random (warning logged)

---

### DEC-005: XML Escaping for Policy Generation

**Context:**
Policy XML was being generated with string interpolation, enabling XML injection.

**Decision:**
Implement proper XML entity escaping for all user-controlled values.

**Escaped Characters:**
- `&` -> `&amp;`
- `<` -> `&lt;`
- `>` -> `&gt;`
- `"` -> `&quot;`
- `'` -> `&#39;`

**Alternative Considered:**
Using a full XML library (e.g., `xmlbuilder2`). Decided against to avoid adding dependencies for simple escaping needs.

---

### DEC-006: Object.create(null) for CSV Parsing

**Context:**
CSV parsing was vulnerable to prototype pollution via malicious header names.

**Decision:**
Create event objects with `Object.create(null)` to eliminate prototype chain.

**Rationale:**
- Eliminates prototype pollution attack surface
- Headers like `__proto__` become harmless string keys
- No functional impact on legitimate data

**Additional Measures:**
- Block known dangerous headers explicitly
- Sanitize headers to alphanumeric only

---

### DEC-007: Retain ExecutionPolicy Bypass with Warning

**Context:**
PowerShell scripts run with `-ExecutionPolicy Bypass`, which disables security controls.

**Decision:**
Keep bypass but document the security implications.

**Rationale:**
- Required for unsigned scripts in development
- Production environments should use signed scripts
- Removing bypass would break core functionality

**Recommendation:**
In production deployments:
1. Sign all PowerShell scripts with code signing certificate
2. Change to `RemoteSigned` or `AllSigned` policy
3. Document in deployment guide

---

### DEC-008: Secure Temporary File Naming

**Context:**
Temporary files used predictable names based on `Date.now()`, enabling race conditions.

**Decision:**
Use `crypto.randomBytes(16).toString('hex')` for temp file names.

**Example:**
- Before: `batch-inventory-1705150000000.json`
- After: `batch-inventory-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.json`

**Rationale:**
- 128 bits of entropy makes prediction infeasible
- Prevents symlink attacks
- Prevents race conditions

---

### DEC-009: Error Message Sanitization

**Context:**
Full error messages including file paths were being returned to the client.

**Decision:**
Sanitize error messages before returning to client, keep full messages in server logs.

**Implementation:**
```javascript
function sanitizeErrorMessage(error) {
  return message.replace(/[A-Z]:\\[^:]+/gi, '[PATH]')
                .replace(/\/[^:]+\/[^:]+/g, '[PATH]');
}
```

**Rationale:**
- Prevents path disclosure attacks
- Maintains debugging capability via server logs
- User-friendly error messages

---

### DEC-010: Input Validation Before Processing

**Context:**
Various inputs were processed without validation, enabling injection attacks.

**Decision:**
Validate all inputs at entry points before processing.

**Validation Functions Added:**
- `isValidModuleName()` - PowerShell module names
- `isValidOUPath()` - LDAP distinguished names
- `isValidUsername()` - Username formats
- `isValidDomain()` - Domain name formats
- `isValidRuleInput()` - Policy rule strings

**Pattern:**
```
Input -> Validate -> Process -> Output
         |
         └-> Reject with error if invalid
```

---

## Deferred Decisions

### DEF-001: CI/CD Pipeline Implementation
**Status:** Deferred - out of scope for security fixes
**Recommendation:** Implement GitHub Actions for automated builds and testing

### DEF-002: Rate Limiting on IPC Handlers
**Status:** Deferred - requires architectural changes
**Recommendation:** Add request throttling to prevent DoS

### DEF-003: Role-Based Access Control
**Status:** Deferred - significant architectural change
**Recommendation:** Implement RBAC for IPC channel access

### DEF-004: Comprehensive Audit Logging
**Status:** Deferred - requires logging infrastructure
**Recommendation:** Add file-based audit logging for compliance

---

## Decision Matrix

| ID | Decision | Risk Mitigated | Impact | Reversible |
|----|----------|----------------|--------|------------|
| DEC-001 | Env var credentials | HIGH | LOW | YES |
| DEC-002 | Whitelist validation | CRITICAL | LOW | YES |
| DEC-003 | Path whitelist | CRITICAL | MEDIUM | YES |
| DEC-004 | Secure random IDs | MEDIUM | LOW | YES |
| DEC-005 | XML escaping | CRITICAL | LOW | YES |
| DEC-006 | Null prototype objects | HIGH | LOW | YES |
| DEC-007 | Keep ExecutionPolicy | N/A | N/A | YES |
| DEC-008 | Secure temp files | MEDIUM | LOW | YES |
| DEC-009 | Error sanitization | MEDIUM | LOW | YES |
| DEC-010 | Input validation | CRITICAL | MEDIUM | YES |

---

## Approval

All decisions made under full authority granted by Application Takeover directive.

No escalation required per Decision Authority Matrix:
- Bug fixes: Full authority
- Security patches: Full authority (never escalate)
- Code refactoring: Full authority (no public API changes)

---

*Document generated as part of Application Takeover process.*
