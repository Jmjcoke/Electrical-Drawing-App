"use strict";
/**
 * Jest test setup configuration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load test environment variables
dotenv_1.default.config({ path: '.env.test' });
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';
// Mock console methods to reduce noise during testing
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};
// Global test timeout
jest.setTimeout(30000);
// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});
//# sourceMappingURL=setup.js.map