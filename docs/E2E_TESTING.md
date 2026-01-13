# E2E Testing Guide

## Overview

End-to-end (E2E) tests are implemented using **Playwright** to test critical user flows and ensure the application works correctly from a user's perspective.

## Setup

### Installation

Playwright is already configured in `package.json`. To install:

```bash
npm install
npx playwright install
```

### Configuration

**File**: `playwright.config.ts`

- **Test Directory**: `./tests/e2e`
- **Base URL**: `http://localhost:3000`
- **Browser**: Chromium (Desktop Chrome)
- **Reporter**: HTML report

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test tests/e2e/example.spec.ts
```

## Test Structure

### Example Test
```typescript
import { test, expect } from '@playwright/test';

test('should load dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h2').first()).toBeVisible();
});
```

## Writing Tests

### Basic Test Pattern

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.locator('button');
    
    // Act
    await button.click();
    
    // Assert
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### Common Patterns

**Wait for element**:
```typescript
await page.waitForSelector('.element', { timeout: 10000 });
```

**Click button**:
```typescript
await page.locator('text=Button Text').click();
```

**Fill form**:
```typescript
await page.fill('input[name="field"]', 'value');
```

**Check visibility**:
```typescript
await expect(page.locator('.element')).toBeVisible();
```

## Test Coverage

### Critical Flows to Test

1. **Dashboard Loading**
   - App loads successfully
   - Dashboard displays correctly
   - Navigation works

2. **Policy Lab**
   - Rule generator opens
   - Templates load
   - Rule creation works

3. **Machine Scanning**
   - Scan module loads
   - Scan starts successfully
   - Results display

4. **Event Monitoring**
   - Events load
   - Filtering works
   - Export functions

5. **AD Management**
   - Users load
   - Drag and drop works
   - Group assignment

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging

### Debug Mode
```bash
npx playwright test --debug
```

### Screenshots
Screenshots are automatically taken on failure (configured in `playwright.config.ts`).

### Trace Viewer
```bash
npx playwright show-trace trace.zip
```

## Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Wait for elements** instead of fixed timeouts
3. **Test user flows**, not implementation details
4. **Keep tests independent** - each test should be able to run alone
5. **Clean up** - reset state between tests

## Troubleshooting

### Tests fail in CI but pass locally
- Check timeout settings
- Verify environment variables
- Ensure all dependencies are installed

### Element not found
- Increase timeout
- Check selector accuracy
- Verify element is actually rendered

### Flaky tests
- Add explicit waits
- Use `waitForSelector` instead of `waitForTimeout`
- Check for race conditions

---

*Last Updated: 2024*
