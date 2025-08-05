// Jest setup file for global test configuration
import { storageService } from '../services/storage.service.js';
global.console = {
    ...console,
    // Uncomment to ignore specific console methods in tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};
// Cleanup after all tests
afterAll(() => {
    // Stop storage service cleanup timers
    storageService.stopCleanupScheduler();
});
//# sourceMappingURL=setup.js.map