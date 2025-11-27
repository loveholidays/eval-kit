import { calculateBleu } from "./bleu";

describe("BLEU Metric", () => {
	it("should perfect score for identical texts", () => {
		const result = calculateBleu(
			"The cat is on the mat",
			"The cat is on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 1,
  "candidateLength": 6,
  "precisions": [
    100,
    100,
    100,
    100,
  ],
  "referenceLength": 6,
  "score": 100,
}
`);
	});

	it("should zero score for completely different texts", () => {
		const result = calculateBleu("foo bar baz", "qux quux corge");
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 1,
  "candidateLength": 3,
  "precisions": [
    0,
    0,
    0,
    0,
  ],
  "referenceLength": 3,
  "score": 0,
}
`);
	});

	it("should brevity penalty for shorter candidates", () => {
		const result = calculateBleu("The cat", "The cat is on the mat");
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 0.1353,
  "candidateLength": 2,
  "precisions": [
    100,
    100,
    0,
    0,
  ],
  "referenceLength": 6,
  "score": 13.53,
}
`);
	});

	it("should no brevity penalty for longer candidates", () => {
		const result = calculateBleu(
			"The cat is on the mat and floor",
			"The cat is on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 1,
  "candidateLength": 8,
  "precisions": [
    75,
    71.43,
    66.67,
    60,
  ],
  "referenceLength": 6,
  "score": 68.04,
}
`);
	});

	it("should n-gram precisions", () => {
		const result = calculateBleu(
			"The cat is on the mat",
			"The cat sits on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 1,
  "candidateLength": 6,
  "precisions": [
    83.33,
    60,
    25,
    0,
  ],
  "referenceLength": 6,
  "score": 50,
}
`);
	});

	it("should custom options with smoothing", () => {
		const result = calculateBleu("Hello world", "Hello beautiful world", {
			maxNgramSize: 2,
			smoothing: 0.1,
		});
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 0.6065,
  "candidateLength": 2,
  "precisions": [
    100,
    10,
  ],
  "referenceLength": 3,
  "score": 19.18,
}
`);
	});

	it("should detailed metrics structure", () => {
		const result = calculateBleu("The cat", "The dog");
		expect(result).toMatchInlineSnapshot(`
{
  "brevityPenalty": 1,
  "candidateLength": 2,
  "precisions": [
    50,
    0,
    0,
    0,
  ],
  "referenceLength": 2,
  "score": 50,
}
`);
	});
});
