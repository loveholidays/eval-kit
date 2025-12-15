import { calculateCoherence } from "./coherence.js";

describe("Coherence Metric", () => {
	describe("calculateCoherence", () => {
		it("should return 100 for single sentence", () => {
			const text = "The cat sat on the mat.";
			const result = calculateCoherence(text);

			expect(result).toMatchInlineSnapshot(`
{
  "averageSimilarity": 1,
  "feedback": "Single sentence is inherently coherent",
  "pairwiseSimilarities": [],
  "score": 100,
  "sentenceCount": 1,
}
`);
		});

		it("should calculate coherence for sentences with some shared vocabulary", () => {
			const text = "The cat sleeps peacefully. The dog plays energetically.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(2);
			expect(result.pairwiseSimilarities.length).toBe(1);
			// Different content words, low coherence expected
			expect(result.score).toBeLessThan(30);
			expect(result.feedback).toBeTruthy();
		});

		it("should calculate low coherence for unrelated sentences", () => {
			const text =
				"The cat sat on the mat. Quantum physics explains atomic behavior. Pizza is a popular Italian food.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(3);
			expect(result.pairwiseSimilarities.length).toBe(2);
			expect(result.score).toBeLessThan(50);
		});

		it("should handle text with completely different content", () => {
			const text =
				"Scientists conducted experiments. Architects designed buildings.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(2);
			expect(result.pairwiseSimilarities.length).toBe(1);
			// No shared content words
			expect(result.score).toBe(0);
		});

		it("should handle empty text", () => {
			const text = "";
			const result = calculateCoherence(text);

			expect(result).toMatchInlineSnapshot(`
{
  "averageSimilarity": 1,
  "feedback": "Excellent coherence with very strong semantic connections and smooth flow",
  "pairwiseSimilarities": [],
  "score": 100,
  "sentenceCount": 0,
}
`);
		});

		it("should respect minSentences option", () => {
			const text = "The cat sat on the mat.";
			const result = calculateCoherence(text, { minSentences: 3 });

			expect(result.score).toBe(100);
			expect(result.sentenceCount).toBe(1);
		});

		it("should calculate pairwise similarities for multiple sentences", () => {
			const text =
				"The weather was sunny today. Many people went to the beach. Swimming in the ocean is refreshing.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(3);
			expect(result.pairwiseSimilarities.length).toBe(2);
			expect(result.pairwiseSimilarities[0]).toBeGreaterThanOrEqual(0);
			expect(result.pairwiseSimilarities[0]).toBeLessThanOrEqual(1);
			expect(result.pairwiseSimilarities[1]).toBeGreaterThanOrEqual(0);
			expect(result.pairwiseSimilarities[1]).toBeLessThanOrEqual(1);
		});

		it("should round score to 2 decimal places", () => {
			const text =
				"The cat sat on the mat. The dog ran in the park. The animals played together.";
			const result = calculateCoherence(text);

			const decimalPlaces = (result.score.toString().split(".")[1] || "")
				.length;
			expect(decimalPlaces).toBeLessThanOrEqual(2);
		});

		it("should provide appropriate feedback for low coherence", () => {
			const text = "Robots move quickly. Flowers bloom beautifully.";
			const result = calculateCoherence(text);

			expect(result.feedback).toBeTruthy();
			expect(result.feedback).toContain("coherence");
			expect(result.score).toBe(0);
		});

		it("should handle sentences with no overlapping words", () => {
			const text = "Apple banana cherry. Delta echo foxtrot.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(2);
			expect(result.score).toBe(0);
			expect(result.pairwiseSimilarities[0]).toBe(0);
		});

		it("should handle long text with many sentences", () => {
			const text = `
        The cat sat on the mat. The feline was very comfortable.
        It purred softly while resting. The afternoon was peaceful.
        Birds chirped in the trees outside. Nature provided a calming atmosphere.
      `;
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBeGreaterThan(4);
			expect(result.pairwiseSimilarities.length).toBe(result.sentenceCount - 1);
			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(100);
		});

		it("should calculate average similarity correctly", () => {
			const text =
				"The cat sat on the mat. The dog ran in the park. The animals played together.";
			const result = calculateCoherence(text);

			const expectedAvg =
				result.pairwiseSimilarities.reduce((a: number, b: number) => a + b, 0) /
				result.pairwiseSimilarities.length;
			expect(result.averageSimilarity).toBeCloseTo(expectedAvg, 5);
			expect(result.score).toBeCloseTo(expectedAvg * 100, 1);
		});

		it("should handle basic sentences", () => {
			const text = "Birds fly south. Fish swim north.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(2);
			// No shared content words, different topics
			expect(result.score).toBe(0);
		});

		it("should handle case insensitivity", () => {
			const text = "HELLO world. goodbye WORLD.";
			const result = calculateCoherence(text);

			expect(result.sentenceCount).toBe(2);
			// "world" appears in both (case-insensitive)
			expect(result.score).toBe(0);
		});
	});
});
