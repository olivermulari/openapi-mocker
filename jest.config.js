/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  // Add more setup options before each test is run
  moduleDirectories: ["node_modules", "<rootDir>/"],
  // testEnvironment: "jest-environment-jsdom",
  verbose: true,
  // jest setup
  automock: false,
  resetMocks: false,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = config;
