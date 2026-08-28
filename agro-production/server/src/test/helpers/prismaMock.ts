import { vi } from 'vitest';

export function createPrismaMock(models: Record<string, Record<string, unknown>> = {}) {
  const defaultModels: Record<string, Record<string, unknown>> = {
    campaign: {},
    investment: {},
    order: {},
    user: {},
    dispute: {},
    product: {},
    transaction: {},
    eventCursor: {},
    disputeEvidence: {},
    disputeAuditEntry: {},
  };

  const mergedModels = { ...defaultModels, ...models };
  const mockPrisma: Record<string, Record<string, unknown>> = {};

  for (const [modelName, methods] of Object.entries(mergedModels)) {
    mockPrisma[modelName] = {};
    const defaultMethods = [
      'findUnique',
      'findMany',
      'count',
      'create',
      'update',
      'upsert',
      'delete',
      'deleteMany',
      'findFirst',
    ];

    for (const method of defaultMethods) {
      if (!(method in methods)) {
        mockPrisma[modelName][method] = vi.fn();
      }
    }

    Object.assign(mockPrisma[modelName], methods);
  }

  mockPrisma.connectDB = vi.fn();
  mockPrisma.$queryRaw = vi.fn();

  return mockPrisma;
}
