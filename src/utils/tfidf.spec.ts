import { calculateIDF, calculateTFIDF } from "./tfidf.js";

describe("TF-IDF Utils", () => {
	describe("calculateIDF", () => {
		it("should calculate IDF for simple case", () => {
			const sentenceTokens = [
				["the", "cat", "sat"],
				["the", "dog", "ran"],
			];
			const idf = calculateIDF(sentenceTokens);

			// "the" appears in both sentences: log((2+1)/(2+1)) = log(1) = 0
			expect(idf.get("the")).toBeCloseTo(0, 3);

			// "cat" appears in 1 sentence: log((2+1)/(1+1)) = log(1.5) = 0.405...
			expect(idf.get("cat")).toBeCloseTo(0.405, 2);

			// "dog" appears in 1 sentence: log((2+1)/(1+1)) = log(1.5) = 0.405...
			expect(idf.get("dog")).toBeCloseTo(0.405, 2);
		});

		it("should handle single sentence", () => {
			const sentenceTokens = [["the", "cat", "sat"]];
			const idf = calculateIDF(sentenceTokens);

			// All words appear in 1/1 sentences: log((1+1)/(1+1)) = log(1) = 0
			expect(idf.get("the")).toBeCloseTo(0, 3);
			expect(idf.get("cat")).toBeCloseTo(0, 3);
			expect(idf.get("sat")).toBeCloseTo(0, 3);
		});

		it("should handle word appearing in all sentences", () => {
			const sentenceTokens = [
				["the", "cat"],
				["the", "dog"],
				["the", "bird"],
			];
			const idf = calculateIDF(sentenceTokens);

			// "the" appears in all 3 sentences: log((3+1)/(3+1)) = log(1) = 0
			expect(idf.get("the")).toBeCloseTo(0, 3);
		});

		it("should handle word appearing in one sentence only", () => {
			const sentenceTokens = [
				["rare", "word"],
				["common", "text"],
				["common", "phrase"],
			];
			const idf = calculateIDF(sentenceTokens);

			// "rare" appears in 1/3 sentences: log((3+1)/(1+1)) = log(2) = 0.693...
			expect(idf.get("rare")).toBeCloseTo(0.693, 2);
		});

		it("should handle empty sentence tokens", () => {
			const sentenceTokens: string[][] = [];
			const idf = calculateIDF(sentenceTokens);

			expect(idf.size).toBe(0);
		});

		it("should handle sentence with duplicate words", () => {
			const sentenceTokens = [
				["the", "the", "cat"],
				["the", "dog"],
			];
			const idf = calculateIDF(sentenceTokens);

			// "the" appears in 2/2 sentences (counted once per sentence): log((2+1)/(2+1)) = log(1) = 0
			expect(idf.get("the")).toBeCloseTo(0, 3);

			// "cat" appears in 1/2 sentences: log((2+1)/(1+1)) = log(1.5) = 0.405...
			expect(idf.get("cat")).toBeCloseTo(0.405, 2);
		});
	});

	describe("calculateTFIDF", () => {
		it("should calculate TF-IDF for simple case", () => {
			const tokens = ["the", "cat", "sat"];
			const idf = new Map([
				["the", 0],
				["cat", 1],
				["sat", 1],
			]);

			const tfidf = calculateTFIDF(tokens, idf);

			// TF("the") = 1, IDF = 0 → TF-IDF = 0
			expect(tfidf.get("the")).toBe(0);

			// TF("cat") = 1, IDF = 1 → TF-IDF = 1
			expect(tfidf.get("cat")).toBe(1);

			// TF("sat") = 1, IDF = 1 → TF-IDF = 1
			expect(tfidf.get("sat")).toBe(1);
		});

		it("should handle repeated words", () => {
			const tokens = ["the", "the", "cat"];
			const idf = new Map([
				["the", 0.5],
				["cat", 1],
			]);

			const tfidf = calculateTFIDF(tokens, idf);

			// TF("the") = 2, IDF = 0.5 → TF-IDF = 1
			expect(tfidf.get("the")).toBe(1);

			// TF("cat") = 1, IDF = 1 → TF-IDF = 1
			expect(tfidf.get("cat")).toBe(1);
		});

		it("should handle empty tokens", () => {
			const tokens: string[] = [];
			const idf = new Map([["the", 1]]);

			const tfidf = calculateTFIDF(tokens, idf);

			expect(tfidf.size).toBe(0);
		});

		it("should handle tokens not in IDF map", () => {
			const tokens = ["unknown", "word"];
			const idf = new Map([["other", 1]]);

			const tfidf = calculateTFIDF(tokens, idf);

			// Words not in IDF get IDF = 0 → TF-IDF = 0
			expect(tfidf.get("unknown")).toBe(0);
			expect(tfidf.get("word")).toBe(0);
		});

		it("should calculate correct TF for multiple occurrences", () => {
			const tokens = ["cat", "cat", "cat", "dog"];
			const idf = new Map([
				["cat", 0.5],
				["dog", 1],
			]);

			const tfidf = calculateTFIDF(tokens, idf);

			// TF("cat") = 3, IDF = 0.5 → TF-IDF = 1.5
			expect(tfidf.get("cat")).toBe(1.5);

			// TF("dog") = 1, IDF = 1 → TF-IDF = 1
			expect(tfidf.get("dog")).toBe(1);
		});

		it("should handle zero IDF values", () => {
			const tokens = ["common", "word"];
			const idf = new Map([
				["common", 0],
				["word", 0],
			]);

			const tfidf = calculateTFIDF(tokens, idf);

			// Zero IDF → TF-IDF = 0
			expect(tfidf.get("common")).toBe(0);
			expect(tfidf.get("word")).toBe(0);
		});
	});
});
