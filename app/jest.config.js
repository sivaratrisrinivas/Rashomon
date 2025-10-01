/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    },
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
    testPathIgnorePatterns: [
      '/node_modules/',
      '/tests/',  // Exclude integration tests
    ],
  };
  module.exports = config;