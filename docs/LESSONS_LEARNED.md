# Lessons Learned - GA-AppLocker Dashboard

**Date:** 2026-01-14
**Context:** Debugging silent failures in AD/machine detection, WinRM GPO deployment, and event monitoring

---

## Executive Summary

Multiple features appeared to "do nothing" when clicked. The root cause was **silent failures in PowerShell execution** that returned empty arrays instead of error information, making debugging nearly impossible from the UI.

---

## Lesson 1: Always Import PowerShell Modules Explicitly

### Problem
PowerShell commands like `Get-ADComputer`, `Get-ADUser`, `New-GPO`, and `Get-GPO` require the `ActiveDirectory` or `GroupPolicy` modules. When running via `child_process.spawn()` from Node.js, these modules are **NOT automatically loaded**.

### Symptom
```javascript
// This returns nothing, no error thrown
const result = spawn('powershell', ['-Command', 'Get-ADComputer -Filter *']);
// stdout: empty, stderr: empty, exitCode: 0
```

### Solution
**Always explicitly import modules at the start of PowerShell commands:**

```powershell
$ErrorActionPreference = 'Stop'
try {
  Import-Module ActiveDirectory -ErrorAction Stop
  # Now Get-ADComputer will work
  Get-ADComputer -Filter * | ConvertTo-Json
} catch {
  # Handle the error
}
```

### Modules Reference
| Operation | Required Module |
|-----------|-----------------|
| `Get-ADComputer`, `Get-ADUser`, `Get-ADGroup` | `ActiveDirectory` |
| `Add-ADGroupMember`, `Remove-ADGroupMember` | `ActiveDirectory` |
| `Get-ADDomain`, `Get-ADOrganizationalUnit` | `ActiveDirectory` |
| `New-GPO`, `Get-GPO`, `Set-GPRegistryValue` | `GroupPolicy` |
| `New-GPLink`, `Get-GPInheritance` | `GroupPolicy` |

---

## Lesson 2: Never Silently Return Empty Arrays on Errors

### Problem
The original error handling pattern hid all errors:

```javascript
// BAD PATTERN - hides errors
ipcMain.handle('machine:getAll', async () => {
  try {
    const result = await executePowerShell('Get-ADComputer ...');
    return JSON.parse(result.stdout);
  } catch (error) {
    console.error(error); // Only logs to main process console
    return [];  // UI receives empty array, thinks "no machines found"
  }
});
```

### Symptom
- "Detect Systems" button appears to work but shows no results
- User thinks there are no computers in AD
- Actual error: "The term 'Get-ADComputer' is not recognized..."

### Solution
**Return structured error objects that the UI can display:**

```javascript
// GOOD PATTERN - propagates errors
ipcMain.handle('machine:getAll', async () => {
  try {
    const command = `
      $ErrorActionPreference = 'Stop'
      try {
        Import-Module ActiveDirectory -ErrorAction Stop
        $data = Get-ADComputer -Filter * | Select-Object Name
        @{ success = $true; data = @($data) } | ConvertTo-Json -Compress
      } catch {
        @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
      }
    `;
    const result = await executePowerShell(command);
    const parsed = JSON.parse(result.stdout);

    if (parsed.success === false) {
      return { error: parsed.error, errorType: parsed.errorType };
    }
    return parsed.data;
  } catch (error) {
    return { error: sanitizeErrorMessage(error) };
  }
});
```

---

## Lesson 3: Repositories Must Check for Error Responses

### Problem
Even with structured error responses from IPC, the repository layer was treating everything as valid data:

```typescript
// BAD PATTERN - ignores error objects
async findAll(): Promise<Machine[]> {
  const result = await ipcClient.invoke('machine:getAll');
  return result || [];  // If result is { error: "..." }, this returns it as data!
}
```

### Solution
**Check for error objects before processing:**

```typescript
// GOOD PATTERN - detects and propagates errors
async findAll(): Promise<Machine[]> {
  const result = await ipcClient.invoke<Machine[] | { error: string; errorType?: string }>('machine:getAll');

  // Check if the result is an error response
  if (result && typeof result === 'object' && 'error' in result) {
    const errorMsg = (result as { error: string }).error;
    throw new ExternalServiceError('Active Directory', errorMsg, new Error(errorMsg));
  }

  return (result as Machine[]) || [];
}
```

---

## Lesson 4: GPO Creation Without Linking Does Nothing

### Problem
Creating a GPO with `New-GPO` only creates the policy object. It has **no effect** until linked to an OU or domain.

### Symptom
```
User: "Deploy WinRM GPO"
Result: GPO created successfully!
Reality: Nothing happens on any machine because GPO isn't linked
```

### Solution
**Always link GPOs after creation:**

```powershell
# Create GPO
$gpo = New-GPO -Name "Enable-WinRM"

# Configure settings
Set-GPRegistryValue -Name "Enable-WinRM" -Key "HKLM\..." -ValueName "..." -Value 1

# CRITICAL: Link to domain or OU
$domainDN = (Get-ADDomain).DistinguishedName
New-GPLink -Name "Enable-WinRM" -Target $domainDN -LinkEnabled Yes
```

---

## Lesson 5: Error Propagation Chain

### Architecture
Errors must flow through the entire stack to reach the user:

```
PowerShell Script
    ↓ (catch block returns JSON with error)
IPC Handler (ipcHandlers.cjs)
    ↓ (parses JSON, returns error object if failed)
Repository Layer (MachineRepository.ts)
    ↓ (checks for error object, throws ExternalServiceError)
Service Layer (MachineService.ts)
    ↓ (re-throws or wraps error)
UI Component (ScanModule.tsx)
    ↓ (catches error, displays to user via toast/alert)
User sees: "Active Directory: The term 'Get-ADComputer' is not recognized..."
```

### Key Points
1. **PowerShell**: Use `$ErrorActionPreference = 'Stop'` and try/catch
2. **IPC Handler**: Parse response, check `success` field, return error object
3. **Repository**: Check for `'error' in result`, throw typed error
4. **Service**: Let errors bubble up or add context
5. **UI**: Catch errors in async handlers, display meaningful message

---

## Lesson 6: Testing on Real Infrastructure

### Problem
Many features work in development but fail in production because:
- Development machine may not have AD modules installed
- Testing without domain admin privileges
- WinRM not enabled on target machines
- AppLocker not configured (no events to monitor)

### Solution
**Test on actual Windows Server with:**
- [ ] Domain-joined machine
- [ ] Domain Admin account logged in
- [ ] `Get-Module -ListAvailable ActiveDirectory` returns module
- [ ] `Get-Module -ListAvailable GroupPolicy` returns module
- [ ] `winrm quickconfig` completed on target machines
- [ ] AppLocker configured and generating events

---

## Anti-Patterns to Avoid

### 1. Silent Catch-All
```javascript
// DON'T DO THIS
try {
  // complex operation
} catch (e) {
  return [];  // Swallows ALL errors
}
```

### 2. Assuming Modules Are Loaded
```powershell
# DON'T DO THIS
Get-ADComputer -Filter *  # May fail silently

# DO THIS
Import-Module ActiveDirectory -ErrorAction Stop
Get-ADComputer -Filter *
```

### 3. Creating Without Linking
```powershell
# DON'T DO THIS
New-GPO -Name "MyPolicy"  # GPO exists but does nothing

# DO THIS
New-GPO -Name "MyPolicy"
New-GPLink -Name "MyPolicy" -Target $domainDN
```

### 4. Trusting Empty Results
```typescript
// DON'T DO THIS
const machines = await getMachines();
if (machines.length === 0) {
  showMessage("No machines found");  // Could be an error!
}

// DO THIS
const result = await getMachines();
if ('error' in result) {
  showError(result.error);
} else if (result.length === 0) {
  showMessage("No machines found");
}
```

---

## Quick Reference: Error Response Format

### PowerShell Output
```json
// Success
{ "success": true, "data": [...] }

// Failure
{ "success": false, "error": "Error message", "errorType": "ExceptionTypeName" }
```

### IPC Handler Return
```javascript
// Success - return data array directly
return parsedData;

// Failure - return error object
return { error: "Message", errorType: "Type" };
```

### Repository Check
```typescript
if (result && typeof result === 'object' && 'error' in result) {
  throw new ExternalServiceError(serviceName, result.error);
}
```

---

## Files Modified in This Fix

| File | Change |
|------|--------|
| `electron/ipc/ipcHandlers.cjs` | Added Import-Module, structured error responses |
| `src/infrastructure/repositories/MachineRepository.ts` | Error object detection |
| `src/infrastructure/repositories/ADRepository.ts` | Error object detection |
| `src/infrastructure/repositories/EventRepository.ts` | Error object detection |

---

## Conclusion

The key insight: **"Doing nothing" is almost always a silent error, not an empty result.** Build error handling that assumes failures will happen and ensures users see meaningful messages instead of empty screens.
