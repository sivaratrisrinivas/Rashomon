/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.(t|j)sx?$': 'ts-jest',
    },
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
  };
  module.exports = config;