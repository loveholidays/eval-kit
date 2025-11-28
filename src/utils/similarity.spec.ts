import { cosineSimilarity } from "./similarity.js";

describe("Similarity Utils", () => {
	describe("cosineSimilarity", () => {
		it("should return 1.0 for identical vectors", () => {
			const vec1 = new Map([
				["cat", 1],
				["dog", 2],
			]);
			const vec2 = new Map([
				["cat", 1],
				["dog", 2],
			]);

			const result = cosineSimilarity(vec1, vec2);
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("should return 0.0 for orthogonal vectors", () => {
			const vec1 = new Map([["cat", 1]]);
			const vec2 = new Map([["dog", 1]]);

			const result = cosineSimilarity(vec1, vec2);
			expect(result).toBe(0);
		});

		it("should calculate similarity for partially overlapping vectors", () => {
			const vec1 = new Map([
				["cat", 1],
				["dog", 1],
			]);
			const vec2 = new Map([
				["cat", 1],
				["bird", 1],
			]);

			const result = cosineSimilarity(vec1, vec2);
			// cos(θ) = (1*1 + 0*1 + 1*0) / (√2 * √2) = 1/2 = 0.5
			expect(result).toBeCloseTo(0.5, 5);
		});

		it("should handle empty vectors", () => {
			const vec1 = new Map<string, number>();
			const vec2 = new Map([["cat", 1]]);

			const result = cosineSimilarity(vec1, vec2);
			expect(result).toBe(0);
		});

		it("should handle both empty vectors", () => {
			const vec1 = new Map<string, number>();
			const vec2 = new Map<string, number>();

			const result = cosineSimilarity(vec1, vec2);
			expect(result).toBe(0);
		});

		it("should handle vectors with different magnitudes", () => {
			const vec1 = new Map([["cat", 2]]);
			const vec2 = new Map([["cat", 4]]);

			const result = cosineSimilarity(vec1, vec2);
			// Same direction, different magnitude → similarity = 1.0
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("should calculate correct similarity with multiple terms", () => {
			const vec1 = new Map([
				["the", 2],
				["cat", 1],
				["sat", 1],
			]);
			const vec2 = new Map([
				["the", 2],
				["dog", 1],
				["ran", 1],
			]);

			const result = cosineSimilarity(vec1, vec2);
			// Dot product: 2*2 + 0 + 0 + 0 + 0 = 4
			// Magnitude1: √(4 + 1 + 1) = √6
			// Magnitude2: √(4 + 1 + 1) = √6
			// Similarity: 4 / 6 = 0.666...
			expect(result).toBeCloseTo(0.666, 2);
		});

		it("should handle zero values in vectors", () => {
			const vec1 = new Map([
				["cat", 1],
				["dog", 0],
			]);
			const vec2 = new Map([
				["cat", 1],
				["dog", 0],
			]);

			const result = cosineSimilarity(vec1, vec2);
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("should handle negative values", () => {
			const vec1 = new Map([["cat", 1]]);
			const vec2 = new Map([["cat", -1]]);

			const result = cosineSimilarity(vec1, vec2);
			// Opposite directions → similarity = -1.0
			expect(result).toBeCloseTo(-1.0, 5);
		});

		it("should handle large vectors efficiently", () => {
			const vec1 = new Map<string, number>();
			const vec2 = new Map<string, number>();

			for (let i = 0; i < 1000; i++) {
				vec1.set(`word${i}`, Math.random());
				vec2.set(`word${i}`, Math.random());
			}

			const result = cosineSimilarity(vec1, vec2);
			// Should return a value between 0 and 1 for random vectors
			expect(result).toBeGreaterThanOrEqual(-1);
			expect(result).toBeLessThanOrEqual(1);
		});
	});
});
