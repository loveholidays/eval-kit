import { calculateNgramPrecision, countNgrams, generateNgrams } from "./ngram";

describe("N-gram Utils", () => {
	describe("generateNgrams", () => {
		it("should generate unigrams", () => {
			const result = generateNgrams(["the", "cat", "sat"], 1);
			expect(result).toMatchInlineSnapshot(`
[
  [
    "the",
  ],
  [
    "cat",
  ],
  [
    "sat",
  ],
]
`);
		});

		it("should generate bigrams", () => {
			const result = generateNgrams(["the", "cat", "sat"], 2);
			expect(result).toMatchInlineSnapshot(`
[
  [
    "the",
    "cat",
  ],
  [
    "cat",
    "sat",
  ],
]
`);
		});

		it("should generate trigrams", () => {
			const result = generateNgrams(["the", "cat", "sat"], 3);
			expect(result).toMatchInlineSnapshot(`
[
  [
    "the",
    "cat",
    "sat",
  ],
]
`);
		});

		it("should generate 4-grams", () => {
			const result = generateNgrams(["the", "cat", "sat", "here"], 4);
			expect(result).toMatchInlineSnapshot(`
[
  [
    "the",
    "cat",
    "sat",
    "here",
  ],
]
`);
		});

		it("should return empty array when n is zero", () => {
			const result = generateNgrams(["the", "cat"], 0);
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should return empty array when n is negative", () => {
			const result = generateNgrams(["the", "cat"], -1);
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should return empty array when tokens length is less than n", () => {
			const result = generateNgrams(["the", "cat"], 5);
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should handle empty token array", () => {
			const result = generateNgrams([], 2);
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should handle single token", () => {
			const result = generateNgrams(["word"], 1);
			expect(result).toMatchInlineSnapshot(`
[
  [
    "word",
  ],
]
`);
		});
	});

	describe("countNgrams", () => {
		it("should count unique ngrams", () => {
			const ngrams = [
				["the", "cat"],
				["cat", "sat"],
				["sat", "on"],
			];
			const result = countNgrams(ngrams);
			expect(Object.fromEntries(result)).toMatchInlineSnapshot(`
{
  "cat sat": 1,
  "sat on": 1,
  "the cat": 1,
}
`);
		});

		it("should count duplicate ngrams", () => {
			const ngrams = [
				["the", "cat"],
				["cat", "sat"],
				["the", "cat"],
			];
			const result = countNgrams(ngrams);
			expect(Object.fromEntries(result)).toMatchInlineSnapshot(`
{
  "cat sat": 1,
  "the cat": 2,
}
`);
		});

		it("should handle unigrams", () => {
			const ngrams = [["the"], ["cat"], ["the"]];
			const result = countNgrams(ngrams);
			expect(Object.fromEntries(result)).toMatchInlineSnapshot(`
{
  "cat": 1,
  "the": 2,
}
`);
		});

		it("should handle empty array", () => {
			const result = countNgrams([]);
			expect(Object.fromEntries(result)).toMatchInlineSnapshot(`{}`);
		});

		it("should count multiple duplicates", () => {
			const ngrams = [["a"], ["a"], ["a"], ["b"], ["b"]];
			const result = countNgrams(ngrams);
			expect(Object.fromEntries(result)).toMatchInlineSnapshot(`
{
  "a": 3,
  "b": 2,
}
`);
		});
	});

	describe("calculateNgramPrecision", () => {
		it("should calculate perfect precision for identical ngrams", () => {
			const candidate = [
				["the", "cat"],
				["cat", "sat"],
			];
			const reference = [
				["the", "cat"],
				["cat", "sat"],
			];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`1`);
		});

		it("should calculate zero precision for no matches", () => {
			const candidate = [
				["the", "dog"],
				["dog", "ran"],
			];
			const reference = [
				["the", "cat"],
				["cat", "sat"],
			];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0`);
		});

		it("should calculate partial precision", () => {
			const candidate = [
				["the", "cat"],
				["cat", "sat"],
				["sat", "here"],
			];
			const reference = [
				["the", "cat"],
				["cat", "ran"],
			];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0.3333333333333333`);
		});

		it("should clip counts when candidate has duplicates", () => {
			const candidate = [["the"], ["the"], ["the"]];
			const reference = [["the"]];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0.3333333333333333`);
		});

		it("should handle empty candidate", () => {
			const candidate: string[][] = [];
			const reference = [["the", "cat"]];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0`);
		});

		it("should handle empty reference", () => {
			const candidate = [["the", "cat"]];
			const reference: string[][] = [];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0`);
		});

		it("should handle different ngram lengths in same array", () => {
			const candidate = [["the", "cat"], ["cat"]];
			const reference = [["the", "cat"]];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0.5`);
		});

		it("should calculate precision with 50% match", () => {
			const candidate = [["a"], ["b"], ["c"], ["d"]];
			const reference = [["a"], ["b"]];
			const result = calculateNgramPrecision(candidate, reference);
			expect(result).toMatchInlineSnapshot(`0.5`);
		});
	});
});
