import { calculatePerplexity, clearPerplexityCache } from "./perplexity";

describe("Perplexity Metric", () => {
	afterAll(() => {
		clearPerplexityCache();
	});

	describe("calculatePerplexity", () => {
		it("should calculate perplexity for natural text", async () => {
			const text = "The cat sat on the mat and looked very comfortable.";
			const result = await calculatePerplexity(text);

			expect(result.perplexity).toBeGreaterThan(0);
			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(100);
			expect(result.tokenCount).toBeGreaterThan(0);
			expect(result.modelUsed).toBe("distilgpt2");
			expect(result.feedback).toContain("perplexity");
		}, 30000);

		it("should return low perplexity for very natural text", async () => {
			const text = "The weather is nice today. The sun is shining.";
			const result = await calculatePerplexity(text);

			expect(result.perplexity).toBeLessThan(100);
			expect(result.score).toBeGreaterThan(0);
		}, 30000);

		it("should handle very short text", async () => {
			const text = "Hello";
			const result = await calculatePerplexity(text);

			expect(result.score).toBe(100);
			expect(result.feedback).toContain("short");
		}, 30000);

		it("should handle empty text", async () => {
			const text = "";
			const result = await calculatePerplexity(text);

			expect(result.score).toBe(100);
			expect(result.tokenCount).toBeLessThanOrEqual(1);
		}, 30000);

		it("should respect model option", async () => {
			const text = "The cat sat on the mat.";
			const result = await calculatePerplexity(text, { model: "distilgpt2" });

			expect(result.modelUsed).toBe("distilgpt2");
		}, 30000);

		it("should return valid averageLogProb", async () => {
			const text = "The cat sat on the mat.";
			const result = await calculatePerplexity(text);

			expect(result.averageLogProb).toBeLessThan(0);
			expect(Number.isFinite(result.averageLogProb)).toBe(true);
		}, 30000);

		it("should calculate correct score ranges for excellent quality", async () => {
			const text = "The cat sat on the mat.";
			const result = await calculatePerplexity(text);

			if (result.perplexity < 20) {
				expect(result.score).toBeGreaterThanOrEqual(90);
			}
		}, 30000);

		it("should provide appropriate feedback based on perplexity", async () => {
			const text = "The quick brown fox jumps over the lazy dog.";
			const result = await calculatePerplexity(text);

			expect(result.feedback).toBeTruthy();
			expect(result.feedback).toContain("perplexity");
		}, 30000);

		it("should handle longer text", async () => {
			const text = `
        The cat sat on the mat and looked very comfortable.
        It was a sunny afternoon and the weather was perfect.
        Birds were singing in the trees outside the window.
        Everything seemed peaceful and calm in the quiet house.
      `;
			const result = await calculatePerplexity(text);

			expect(result.tokenCount).toBeGreaterThan(20);
			expect(result.perplexity).toBeGreaterThan(0);
			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(100);
		}, 30000);

		it("should cache model between calls", async () => {
			const text1 = "The cat sat.";
			const text2 = "The dog ran.";

			const start = Date.now();
			await calculatePerplexity(text1);
			const firstCall = Date.now() - start;

			const start2 = Date.now();
			await calculatePerplexity(text2);
			const secondCall = Date.now() - start2;

			expect(secondCall).toBeLessThan(firstCall);
		}, 60000);

		it("should round perplexity to 2 decimal places", async () => {
			const text = "The cat sat on the mat.";
			const result = await calculatePerplexity(text);

			const decimalPlaces = (result.perplexity.toString().split(".")[1] || "")
				.length;
			expect(decimalPlaces).toBeLessThanOrEqual(2);
		}, 30000);

		it("should round score to 2 decimal places", async () => {
			const text = "The cat sat on the mat.";
			const result = await calculatePerplexity(text);

			const decimalPlaces = (result.score.toString().split(".")[1] || "")
				.length;
			expect(decimalPlaces).toBeLessThanOrEqual(2);
		}, 30000);

		it("should handle text with punctuation", async () => {
			const text = "Hello! How are you? I am fine, thank you.";
			const result = await calculatePerplexity(text);

			expect(result.perplexity).toBeGreaterThan(0);
			expect(result.tokenCount).toBeGreaterThan(0);
		}, 30000);

		it("should handle text with numbers", async () => {
			const text = "There are 3 cats and 2 dogs in the house.";
			const result = await calculatePerplexity(text);

			expect(result.perplexity).toBeGreaterThan(0);
			expect(result.score).toBeGreaterThanOrEqual(0);
		}, 30000);
	});

	describe("clearPerplexityCache", () => {
		it("should clear the cache", () => {
			expect(() => clearPerplexityCache()).not.toThrow();
		});
	});
});
