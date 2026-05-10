module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.d.ts',
    '!src/**/dto/*.ts',
    '!src/**/decorators/*.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 35,
      lines: 40,
      statements: 40,
    },
  },
  testTimeout: 30000,
};
