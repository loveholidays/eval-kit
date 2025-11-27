import { calculateTer } from "./ter";

describe("TER Metric", () => {
	it("should perfect score for identical texts", () => {
		const result = calculateTer(
			"The cat is on the mat",
			"The cat is on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 6,
  "editCount": 0,
  "feedback": "Perfect match with reference translation",
  "rawTer": 0,
  "referenceLength": 6,
  "score": 100,
}
`);
	});

	it("should calculate edit distance correctly", () => {
		const result = calculateTer(
			"The cat is on the mat",
			"The cat sits on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 6,
  "editCount": 2,
  "feedback": "Good translation with 2 edit(s) needed",
  "rawTer": 0.3333,
  "referenceLength": 6,
  "score": 66.67,
}
`);
	});

	it("should penalize longer candidates appropriately", () => {
		const result = calculateTer(
			"The cat is on the mat and the floor",
			"The cat is on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 9,
  "editCount": 14,
  "feedback": "Poor translation requiring 14 edit(s) - significant revision needed (translation is 3 words too long)",
  "rawTer": 2.3333,
  "referenceLength": 6,
  "score": 0,
}
`);
	});

	it("should penalize shorter candidates appropriately", () => {
		const result = calculateTer("The cat", "The cat is on the mat");
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 2,
  "editCount": 14,
  "feedback": "Poor translation requiring 14 edit(s) - significant revision needed (translation is 4 words too short)",
  "rawTer": 2.3333,
  "referenceLength": 6,
  "score": 0,
}
`);
	});

	it("should good translation quality", () => {
		const result = calculateTer(
			"The cat sits on the mat",
			"The cat is on the mat",
		);
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 6,
  "editCount": 2,
  "feedback": "Good translation with 2 edit(s) needed",
  "rawTer": 0.3333,
  "referenceLength": 6,
  "score": 66.67,
}
`);
	});

	it("should poor translation quality", () => {
		const result = calculateTer("Completely different text", "Hello world");
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 3,
  "editCount": 21,
  "feedback": "Poor translation requiring 21 edit(s) - significant revision needed (translation is 1 words too long)",
  "rawTer": 10.5,
  "referenceLength": 2,
  "score": 0,
}
`);
	});

	it("should raw edit count mode", () => {
		const result = calculateTer("Hello world", "Hello beautiful world", {
			normalize: false,
		});
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 2,
  "editCount": 10,
  "feedback": "Poor translation requiring 10 edit(s) - significant revision needed (translation is 1 words too short)",
  "rawTer": 10,
  "referenceLength": 3,
  "score": 0,
}
`);
	});

	it("should perfect vs poor comparison", () => {
		const result = calculateTer("same text", "same text");
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 2,
  "editCount": 0,
  "feedback": "Perfect match with reference translation",
  "rawTer": 0,
  "referenceLength": 2,
  "score": 100,
}
`);
	});

	it("should detailed metrics structure", () => {
		const result = calculateTer("The cat", "The dog");
		expect(result).toMatchInlineSnapshot(`
{
  "candidateLength": 2,
  "editCount": 3,
  "feedback": "Poor translation requiring 3 edit(s) - significant revision needed",
  "rawTer": 1.5,
  "referenceLength": 2,
  "score": 0,
}
`);
	});
});
