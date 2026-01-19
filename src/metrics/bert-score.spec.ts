import { calculateBertScore, clearBertCache } from "./bert-score";

describe("BERTScore Metric", () => {
	// Increase timeout for model loading
	jest.setTimeout(30000);

	afterAll(() => {
		// Clean up model cache after tests
		clearBertCache();
	});

	it("should return high score for identical texts", async () => {
		const result = await calculateBertScore(
			"The cat is on the mat",
			"The cat is on the mat",
		);

		expect(result.score).toBeGreaterThan(95);
		expect(result.f1).toBeGreaterThan(95);
		expect(result.precision).toBeGreaterThan(95);
		expect(result.recall).toBeGreaterThan(95);
	});

	it("should return high score for semantically similar texts", async () => {
		const result = await calculateBertScore(
			"The cat sits on the mat",
			"A feline is on the rug",
		);

		// Should recognize semantic similarity despite different words
		expect(result.score).toBeGreaterThan(70);
	});

	it("should return low score for semantically different texts", async () => {
		const result = await calculateBertScore(
			"The weather is nice today",
			"I love playing basketball",
		);

		expect(result.score).toBeLessThan(50);
	});

	it("should recognize paraphrases", async () => {
		const result = await calculateBertScore(
			"The movie was excellent",
			"The film was great",
		);

		// Should score higher than random text due to semantic similarity
		expect(result.score).toBeGreaterThan(70);
	});

	it("should return all score types", async () => {
		const result = await calculateBertScore("Hello world", "Hi world");

		expect(result).toHaveProperty("score");
		expect(result).toHaveProperty("precision");
		expect(result).toHaveProperty("recall");
		expect(result).toHaveProperty("f1");
		expect(result).toHaveProperty("modelUsed");
	});

	it("should respect scoreType option", async () => {
		const f1Result = await calculateBertScore("Hello world", "Hi world", {
			scoreType: "f1",
		});
		expect(f1Result.score).toBe(f1Result.f1);

		const precisionResult = await calculateBertScore(
			"Hello world",
			"Hi world",
			{ scoreType: "precision" },
		);
		expect(precisionResult.score).toBe(precisionResult.precision);

		const recallResult = await calculateBertScore("Hello world", "Hi world", {
			scoreType: "recall",
		});
		expect(recallResult.score).toBe(recallResult.recall);
	});

	it("should cache model between calls", async () => {
		const start1 = Date.now();
		await calculateBertScore("Test 1", "Reference 1");
		const time1 = Date.now() - start1;

		const start2 = Date.now();
		await calculateBertScore("Test 2", "Reference 2");
		const time2 = Date.now() - start2;

		// Second call should be much faster (cached model)
		expect(time2).toBeLessThan(time1 * 0.5);
	});

	it("should handle different models", async () => {
		const result = await calculateBertScore("Hello world", "Hi world", {
			model: "sentence-transformers/all-MiniLM-L6-v2",
		});

		expect(result.modelUsed).toBe("sentence-transformers/all-MiniLM-L6-v2");
		expect(result.score).toBeGreaterThan(0);
	});
});
