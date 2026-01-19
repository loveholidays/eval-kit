import { tokenizeSentences, tokenizeWords } from "./tokenization";

describe("Tokenization Utils", () => {
	describe("tokenizeWords", () => {
		it("should tokenize simple sentence", () => {
			const result = tokenizeWords("The cat is on the mat");
			expect(result).toMatchInlineSnapshot(`
[
  "the",
  "cat",
  "is",
  "on",
  "the",
  "mat",
]
`);
		});

		it("should handle punctuation", () => {
			const result = tokenizeWords("Hello, world! How are you?");
			expect(result).toMatchInlineSnapshot(`
[
  "hello",
  ",",
  "world",
  "!",
  "how",
  "are",
  "you",
  "?",
]
`);
		});

		it("should lowercase all tokens", () => {
			const result = tokenizeWords("The CAT and DOG");
			expect(result).toMatchInlineSnapshot(`
[
  "the",
  "cat",
  "and",
  "dog",
]
`);
		});

		it("should handle multiple spaces", () => {
			const result = tokenizeWords("Hello    world");
			expect(result).toMatchInlineSnapshot(`
[
  "hello",
  "world",
]
`);
		});

		it("should handle empty string", () => {
			const result = tokenizeWords("");
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should handle string with only spaces", () => {
			const result = tokenizeWords("   ");
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should handle various punctuation marks", () => {
			const result = tokenizeWords("One (two) [three] {four}: five; six.");
			expect(result).toMatchInlineSnapshot(`
[
  "one",
  "(",
  "two",
  ")",
  "[",
  "three",
  "]",
  "{",
  "four",
  "}",
  ":",
  "five",
  ";",
  "six",
  ".",
]
`);
		});

		it("should preserve punctuation as separate tokens", () => {
			const result = tokenizeWords("Hello, world!");
			expect(result).toMatchInlineSnapshot(`
[
  "hello",
  ",",
  "world",
  "!",
]
`);
		});
	});

	describe("tokenizeSentences", () => {
		it("should split on periods", () => {
			const result = tokenizeSentences("First sentence. Second sentence.");
			expect(result).toMatchInlineSnapshot(`
[
  "First sentence",
  "Second sentence",
]
`);
		});

		it("should split on exclamation marks", () => {
			const result = tokenizeSentences("Hello! How are you!");
			expect(result).toMatchInlineSnapshot(`
[
  "Hello",
  "How are you",
]
`);
		});

		it("should split on question marks", () => {
			const result = tokenizeSentences("Who? What? When?");
			expect(result).toMatchInlineSnapshot(`
[
  "Who",
  "What",
  "When",
]
`);
		});

		it("should handle mixed punctuation", () => {
			const result = tokenizeSentences("Hello! How are you? I am fine.");
			expect(result).toMatchInlineSnapshot(`
[
  "Hello",
  "How are you",
  "I am fine",
]
`);
		});

		it("should trim whitespace", () => {
			const result = tokenizeSentences("  First.   Second.  ");
			expect(result).toMatchInlineSnapshot(`
[
  "First",
  "Second",
]
`);
		});

		it("should handle empty string", () => {
			const result = tokenizeSentences("");
			expect(result).toMatchInlineSnapshot(`[]`);
		});

		it("should handle multiple sentence terminators", () => {
			const result = tokenizeSentences("Really?! Yes!!");
			expect(result).toMatchInlineSnapshot(`
[
  "Really",
  "Yes",
]
`);
		});

		it("should handle no sentence terminators", () => {
			const result = tokenizeSentences("Just one sentence");
			expect(result).toMatchInlineSnapshot(`
[
  "Just one sentence",
]
`);
		});
	});
});
