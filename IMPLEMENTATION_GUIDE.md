# Implementation Guide
## Step-by-Step Refactoring Execution

This guide provides concrete steps to implement the architecture refactoring plan.

---

## Quick Start Checklist

### ✅ Phase 1: Foundation (Days 1-2)

1. **Install Dependencies**
   ```bash
   npm install zod  # For validation
   npm install --save-dev @types/node
   ```

2. **Create Error Hierarchy**
   - ✅ `src/domain/errors/BaseError.ts` - Created
   - ✅ `src/domain/errors/index.ts` - Created

3. **Create Logging Infrastructure**
   - ✅ `src/infrastructure/logging/Logger.ts` - Created
   - ✅ `src/infrastructure/logging/index.ts` - Created

4. **Create Error Boundary**
   - ✅ `src/presentation/contexts/ErrorBoundary.tsx` - Created

5. **Update App.tsx to use ErrorBoundary**
   ```tsx
   import { ErrorBoundary } from './presentation/contexts/ErrorBoundary';
   
   // Wrap App component
   <ErrorBoundary>
     <App />
   </ErrorBoundary>
   ```

---

### 🔄 Phase 2: Repository Pattern (Days 3-4)

1. **Create Domain Interfaces**
   ```typescript
   // src/domain/interfaces/IMachineRepository.ts
   export interface IMachineRepository {
     findAll(): Promise<MachineScan[]>;
     findById(id: string): Promise<MachineScan | null>;
     findByFilter(filter: MachineFilter): Promise<MachineScan[]>;
   }
   ```

2. **Create Repository Implementation**
   ```typescript
   // src/infrastructure/repositories/MachineRepository.ts
   export class MachineRepository implements IMachineRepository {
     // Implementation using IPC or mock data
   }
   ```

3. **Update Services to Use Repositories**
   - Inject repository via constructor
   - Remove direct data access

---

### 🔄 Phase 3: IPC Communication (Days 5-6)

1. **Update Preload Script**
   ```typescript
   // electron/preload.cjs
   contextBridge.exposeInMainWorld('electron', {
     ipc: {
       invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
       on: (channel, callback) => ipcRenderer.on(channel, callback),
     },
   });
   ```

2. **Create IPC Handlers in Main Process**
   ```typescript
   // electron/ipc/handlers/machineHandlers.ts
   ipcMain.handle('machine:getAll', async () => {
     // Call PowerShell scripts or return mock data
   });
   ```

3. **Create IPC Client**
   ```typescript
   // src/infrastructure/ipc/ipcClient.ts
   export class IPCClient {
     async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
       return window.electron.ipc.invoke(channel, ...args);
     }
   }
   ```

---

### 🔄 Phase 4: Dependency Injection (Days 7-8)

1. **Create DI Container**
   ```typescript
   // src/infrastructure/di/Container.ts
   export class Container {
     register<T>(token: string, implementation: Constructor<T>): void;
     resolve<T>(token: string): T;
   }
   ```

2. **Configure Services**
   ```typescript
   // src/infrastructure/di/setup.ts
   container.register('IMachineRepository', MachineRepository);
   container.register('MachineService', MachineService, {
     dependencies: ['IMachineRepository'],
   });
   ```

3. **Update Components to Use DI**
   ```typescript
   const machineService = container.resolve<MachineService>('MachineService');
   ```

---

### 🔄 Phase 5: Validation Layer (Days 9-10)

1. **Install Zod**
   ```bash
   npm install zod
   ```

2. **Create Validation Schemas**
   ```typescript
   // src/infrastructure/validation/schemas/machineSchemas.ts
   import { z } from 'zod';
   
   export const MachineFilterSchema = z.object({
     searchQuery: z.string().optional(),
     status: z.enum(['All', 'Online', 'Offline']).optional(),
   });
   ```

3. **Create Validators**
   ```typescript
   // src/infrastructure/validation/validators/MachineValidator.ts
   export class MachineValidator {
     validateFilter(filter: unknown): asserts filter is MachineFilter {
       MachineFilterSchema.parse(filter);
     }
   }
   ```

4. **Use in Services**
   ```typescript
   this.validator.validateFilter(filter);
   ```

---

### 🔄 Phase 6: Testing Infrastructure (Days 11-12)

1. **Install Testing Dependencies**
   ```bash
   npm install --save-dev jest @testing-library/react @testing-library/jest-dom
   npm install --save-dev @types/jest ts-jest
   ```

2. **Configure Jest**
   ```json
   // package.json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage"
     }
   }
   ```

3. **Create Test Utilities**
   ```typescript
   // tests/helpers/testUtils.tsx
   export function renderWithProviders(ui: ReactElement) {
     // Render with DI container, contexts, etc.
   }
   ```

4. **Write First Tests**
   ```typescript
   // tests/unit/application/services/MachineService.test.ts
   describe('MachineService', () => {
     it('should filter machines correctly', async () => {
       // Test implementation
     });
   });
   ```

---

## Migration Strategy

### Step-by-Step Component Migration

1. **Identify Component Dependencies**
   - List all MOCK_* constants used
   - Identify service calls
   - Note state management patterns

2. **Create Service Wrapper**
   ```typescript
   // In component
   const { data, loading, error } = useAsync(() => 
     machineService.getAllMachines()
   );
   ```

3. **Replace Mock Data**
   ```typescript
   // Before
   const machines = MOCK_MACHINES;
   
   // After
   const machines = await machineService.getAllMachines();
   ```

4. **Add Error Handling**
   ```typescript
   if (error) {
     return <ErrorDisplay error={error} />;
   }
   ```

5. **Add Loading States**
   ```typescript
   if (loading) {
     return <LoadingSpinner />;
   }
   ```

---

## Common Patterns

### Service Usage Pattern
```typescript
import { useAsync } from '../hooks/useAsync';
import { container } from '../infrastructure/di/Container';
import { MachineService } from '../application/services/MachineService';

const Component: React.FC = () => {
  const machineService = container.resolve<MachineService>('MachineService');
  
  const { data: machines, loading, error, refetch } = useAsync(
    () => machineService.getAllMachines()
  );
  
  // Component logic
};
```

### Error Handling Pattern
```typescript
try {
  await service.performAction();
  logger.info('Action completed successfully');
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NotFoundError) {
    // Handle not found
  } else {
    logger.error('Unexpected error', error);
    // Handle generic error
  }
}
```

### Validation Pattern
```typescript
const validator = new MachineValidator();
try {
  validator.validateFilter(filter);
  const result = await service.filterMachines(machines, filter);
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation error to user
  }
}
```

---

## Testing Patterns

### Unit Test Example
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
    const mockMachines = [/* test data */];
    mockRepository.findAll.mockResolvedValue(mockMachines);
    
    const result = await service.getAllMachines();
    
    expect(result).toEqual(mockMachines);
    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Test Example
```typescript
describe('MachineService Integration', () => {
  it('should filter machines end-to-end', async () => {
    const repository = new MachineRepository();
    const service = new MachineService(repository);
    
    const machines = await service.getAllMachines();
    const filtered = await service.filterMachines(machines, {
      status: 'Online',
    });
    
    expect(filtered.every(m => m.status === 'Online')).toBe(true);
  });
});
```

---

## Rollback Plan

If issues arise during refactoring:

1. **Feature Flags**: Use feature flags to toggle new/old implementations
2. **Incremental Migration**: Migrate one component at a time
3. **Branch Strategy**: Keep refactoring in separate branch
4. **Test Coverage**: Ensure tests pass before merging
5. **Documentation**: Document all changes for easy rollback

---

## Success Criteria

- [ ] All services use dependency injection
- [ ] All components use services (no direct mock data)
- [ ] Error handling implemented throughout
- [ ] Logging integrated in all services
- [ ] Validation on all inputs
- [ ] 80%+ test coverage
- [ ] Zero TypeScript errors
- [ ] All linter errors resolved
- [ ] Documentation complete

---

## Next Steps After Implementation

1. **Performance Optimization**
   - Add caching layer
   - Implement request batching
   - Optimize re-renders

2. **Monitoring**
   - Add error tracking (Sentry, etc.)
   - Add performance monitoring
   - Add usage analytics

3. **Documentation**
   - API documentation
   - Architecture diagrams
   - Developer onboarding guide
