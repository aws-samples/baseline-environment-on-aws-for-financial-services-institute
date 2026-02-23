module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^bleafsi-shared-constructs-v1$': '<rootDir>/../../resources/bleafsi-shared-constructs/v1.0.0/lib/index.ts',
  },
};
