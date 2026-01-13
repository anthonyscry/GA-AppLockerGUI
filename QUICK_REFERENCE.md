# Quick Reference Guide
## Common Patterns & Code Snippets

---

## Error Handling

### Throwing Errors
```typescript
import { ValidationError, NotFoundError } from './src/domain/errors';

// Validation error
throw new ValidationError('Invalid input', 'fieldName');

// Not found error
throw new NotFoundError('Machine', machineId);

// External service error
throw new ExternalServiceError('PowerShell', 'Failed to execute script', error);
```

### Catching Errors
```typescript
try {
  await service.performAction();
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation message to user
    setError(error.getUserMessage());
  } else if (error instanceof NotFoundError) {
    // Show not found message
    setError('Resource not found');
  } else {
    // Log and show generic error
    logger.error('Unexpected error', error);
    setError('An error occurred');
  }
}
```

---

## Logging

### Basic Usage
```typescript
import { logger } from './src/infrastructure/logging';

// Debug (development only)
logger.debug('Processing data', { machineId: '123' });

// Info
logger.info('Operation completed', { count: 10 });

// Warning
logger.warn('Deprecated API used', { endpoint: '/old-api' });

// Error
logger.error('Operation failed', error, { context: 'additional info' });
```

### Child Logger (with context)
```typescript
const serviceLogger = logger.child({ service: 'MachineService' });
serviceLogger.info('Fetching machines'); // Includes service context
```

---

## Service Usage

### In Components
```typescript
import { useAsync } from './hooks/useAsync';
import { container } from './infrastructure/di/Container';
import { MachineService } from './application/services/MachineService';

const Component: React.FC = () => {
  const machineService = container.resolve<MachineService>('MachineService');
  
  const { data, loading, error, refetch } = useAsync(
    () => machineService.getAllMachines()
  );
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return <MachineList machines={data} />;
};
```

### Direct Service Call
```typescript
const machineService = container.resolve<MachineService>('MachineService');

try {
  const machines = await machineService.getAllMachines();
  const filtered = await machineService.filterMachines(machines, {
    status: 'Online',
    searchQuery: 'WKST',
  });
} catch (error) {
  logger.error('Failed to fetch machines', error);
}
```

---

## Validation

### Using Validators
```typescript
import { MachineValidator } from './infrastructure/validation/validators/MachineValidator';

const validator = new MachineValidator();

try {
  validator.validateFilter(filter);
  // Proceed with filtered data
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation error
  }
}
```

---

## IPC Communication

### Invoking IPC (Renderer)
```typescript
import { ipcClient } from './infrastructure/ipc/ipcClient';
import { IPCChannels } from './infrastructure/ipc/channels';

const machines = await ipcClient.invoke<MachineScan[]>(
  IPCChannels.MACHINE.GET_ALL
);
```

### Listening to IPC Events
```typescript
ipcClient.on(IPCChannels.MACHINE.SCAN_COMPLETE, (data) => {
  console.log('Scan completed', data);
});
```

---

## Custom Hooks

### useFiltering
```typescript
import { useFiltering } from './hooks/useFiltering';

const { filteredData, searchQuery, setSearchQuery, clearFilters } = useFiltering({
  data: machines,
  filterFn: (item, filters) => {
    return MachineService.filterMachines([item], filters).length > 0;
  },
  initialFilters: { status: 'All' },
});
```

### useDebounce
```typescript
import { useDebounce } from './hooks/useDebounce';

const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  // Search with debounced query
  performSearch(debouncedQuery);
}, [debouncedQuery]);
```

### useModal
```typescript
import { useModal } from './hooks/useModal';

const { isOpen, open, close, toggle } = useModal();

<Modal isOpen={isOpen} onClose={close}>
  {/* Modal content */}
</Modal>
```

### useAsync
```typescript
import { useAsync } from './hooks/useAsync';

const { data, loading, error, refetch } = useAsync(
  () => service.getData(),
  [dependency] // Re-run when dependency changes
);
```

---

## Error Boundary

### Wrapping App
```tsx
import { ErrorBoundary } from './src/presentation/contexts/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

### Custom Fallback
```tsx
<ErrorBoundary
  fallback={<CustomErrorUI />}
  onError={(error, errorInfo) => {
    // Custom error handling
  }}
>
  <YourComponent />
</ErrorBoundary>
```

---

## Testing Patterns

### Service Test
```typescript
describe('MachineService', () => {
  let service: MachineService;
  let mockRepository: jest.Mocked<IMachineRepository>;
  
  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };
    service = new MachineService(mockRepository);
  });
  
  it('should get all machines', async () => {
    const mockMachines = [{ id: '1', hostname: 'WKST-01' }];
    mockRepository.findAll.mockResolvedValue(mockMachines);
    
    const result = await service.getAllMachines();
    
    expect(result).toEqual(mockMachines);
  });
});
```

### Component Test
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { container } from './infrastructure/di/Container';

test('renders machine list', async () => {
  // Mock service
  const mockService = {
    getAllMachines: jest.fn().mockResolvedValue([/* mock data */]),
  };
  container.register('MachineService', () => mockService);
  
  render(<MachineList />);
  
  await waitFor(() => {
    expect(screen.getByText('WKST-01')).toBeInTheDocument();
  });
});
```

---

## File Organization

### Where to Put Code

- **Domain Logic**: `src/domain/`
- **Business Services**: `src/application/services/`
- **Data Access**: `src/infrastructure/repositories/`
- **UI Components**: `src/presentation/components/`
- **Utilities**: `src/shared/utils/`
- **Types**: `src/shared/types/`
- **Constants**: `src/shared/constants/`

---

## Common Imports

```typescript
// Errors
import { ValidationError, NotFoundError } from '@/domain/errors';

// Logging
import { logger } from '@/infrastructure/logging';

// Services
import { MachineService } from '@/application/services';

// Hooks
import { useFiltering, useAsync } from '@/hooks';

// Utils
import { formatDate, truncate } from '@/shared/utils';

// Types
import { MachineScan, AppEvent } from '@/shared/types';
```

---

## Best Practices

### ✅ DO
- Use dependency injection
- Handle errors properly
- Log important operations
- Validate inputs
- Use TypeScript types strictly
- Write tests for business logic

### ❌ DON'T
- Access mock data directly in components
- Use `any` types
- Ignore errors
- Mix business logic with UI
- Create circular dependencies
- Skip validation

---

## Troubleshooting

### Error: "Service not registered"
```typescript
// Make sure service is registered in DI container
container.register('MachineService', MachineService, {
  dependencies: ['IMachineRepository'],
});
```

### Error: "IPC not available"
```typescript
// Check preload script is loaded
if (!window.electron?.ipc) {
  console.error('IPC not available - check preload script');
}
```

### Error: "Validation failed"
```typescript
// Check validation schema matches input
const validator = new MachineValidator();
validator.validateFilter(filter); // Throws if invalid
```

---

*Keep this guide handy for quick reference during development!*
