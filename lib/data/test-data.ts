import { generateMockData } from "./mock-market-data";

// Generate 10 days of data to test
const testData = generateMockData(10);

console.log("Generated test data:");
console.log(testData.slice(0, 3)); // Show first 3 days

export { testData };