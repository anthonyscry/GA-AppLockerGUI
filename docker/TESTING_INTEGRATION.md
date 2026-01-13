# Docker Integration Testing Guide

## Overview

This guide explains how to use Docker Desktop for functional testing of the GA-AppLocker Dashboard.

## Quick Start

### 1. Start Docker Environment

```bash
# From project root
npm run docker:up
```

This starts:
- **ga-applocker-app** - Node.js application container
- **ga-applocker-dc** - Simulated Domain Controller (Samba)
- **ga-applocker-client** - Windows client simulator

### 2. Run All Docker Tests

```bash
# Comprehensive test suite
cd docker
.\run-integration-tests.ps1
```

Or run individual test suites:

```bash
# Unit tests only
npm run test

# Docker environment tests
npm run test:docker

# Functional tests (PowerShell, policy generation)
npm run test:docker:functional
```

### 3. Stop Containers

```bash
npm run docker:down
```

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start all containers |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | View container logs |
| `npm run docker:shell` | Open shell in app container |
| `npm run docker:test` | Run Docker test suite (PowerShell) |
| `npm run test:docker` | Run Docker integration tests (Jest) |
| `npm run test:docker:functional` | Run functional tests (Jest) |

## Test Categories

### Unit Tests (`npm run test`)
- Run in isolation (no Docker required)
- Test individual services and repositories
- Fast execution (~2 seconds)

### Docker Integration Tests (`npm run test:docker`)
- Verify Docker environment is set up correctly
- Check containers are running
- Test Node.js/PowerShell availability

### Functional Tests (`npm run test:docker:functional`)
- Test PowerShell script execution
- Verify policy XML generation
- Test hash computation
- Test rule generation
- Test policy merging

## Test Files

```
tests/
├── unit/                        # Unit tests (no Docker)
│   └── application/services/
│       ├── PolicyService.test.ts
│       ├── MachineService.test.ts
│       └── ...
├── integration/                 # Docker integration tests
│   ├── docker.test.ts          # Environment verification
│   └── docker-functional.test.ts  # Functional tests
└── e2e/                        # End-to-end tests (Playwright)
```

## Manual Testing in Container

```bash
# Open shell in app container
npm run docker:shell

# Inside container:
cd /app
npm test                    # Run unit tests
npm run build              # Test production build
pwsh scripts/Test-RuleHealth.ps1  # Test PowerShell scripts
```

## Troubleshooting

### Docker Not Found
```bash
# Install Docker Desktop from:
# https://www.docker.com/products/docker-desktop

# Ensure Docker is running (check system tray)
docker --version
docker info
```

### Containers Won't Start
```bash
# Check Docker resources (Settings > Resources)
# Ensure at least 4GB RAM allocated

# View logs
npm run docker:logs

# Restart containers
npm run docker:down
npm run docker:up
```

### Tests Fail
```bash
# Ensure containers are running
docker ps | grep ga-applocker

# Check container logs
docker logs ga-applocker-app

# Manually verify inside container
npm run docker:shell
```

## CI/CD Integration

For GitHub Actions or other CI/CD:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker
        uses: docker/setup-buildx-action@v3
      
      - name: Start containers
        run: npm run docker:up
        
      - name: Wait for containers
        run: sleep 60
        
      - name: Run unit tests
        run: npm run test
        
      - name: Run Docker tests
        run: npm run test:docker
        
      - name: Run functional tests
        run: npm run test:docker:functional
        
      - name: Stop containers
        run: npm run docker:down
```

## What Gets Tested

### PowerShell Scripts
- ✅ Syntax validation (all .ps1 files)
- ✅ Module loading (GA-AppLocker.psm1)
- ✅ Policy XML generation
- ✅ Hash computation
- ✅ Rule generation (Publisher, Hash)
- ✅ Policy merging

### Application Code
- ✅ Unit tests (35 tests)
- ✅ Production build
- ✅ TypeScript compilation

### Environment
- ✅ Node.js availability
- ✅ npm availability
- ✅ PowerShell availability
- ✅ Container connectivity

## Best Practices

1. **Always run unit tests first** - They're fast and catch most issues
2. **Use Docker for integration tests** - Ensures consistent environment
3. **Check container logs on failure** - Usually reveals the issue
4. **Keep containers running during development** - Faster iteration

---

**Version:** 1.2.7  
**Last Updated:** 2026-01-13
