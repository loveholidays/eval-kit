import { cosineSimilarity } from "../utils/similarity.js";
import { calculateIDF, calculateTFIDF } from "../utils/tfidf.js";
import { tokenizeSentences, tokenizeWords } from "../utils/tokenization.js";

export interface CoherenceOptions {
	minSentences?: number;
}

export interface CoherenceResult {
	score: number;
	sentenceCount: number;
	pairwiseSimilarities: number[];
	averageSimilarity: number;
	feedback: string;
}

const generateFeedback = (score: number, sentenceCount: number): string => {
	if (sentenceCount === 1) {
		return "Single sentence is inherently coherent";
	}

	if (score >= 90) {
		return "Excellent coherence with very strong semantic connections and smooth flow";
	}
	if (score >= 75) {
		return "Good coherence with strong connections and mostly smooth transitions";
	}
	if (score >= 60) {
		return "Fair coherence with moderate topic continuity but some noticeable gaps";
	}
	if (score >= 40) {
		return "Poor coherence with weak connections and frequent topic shifts";
	}
	return "Very poor coherence with disconnected sentences and no clear topic continuity";
};

export const calculateCoherence = (
	text: string,
	options: CoherenceOptions = {},
): CoherenceResult => {
	const { minSentences = 2 } = options;

	const sentences = tokenizeSentences(text);

	if (sentences.length < minSentences) {
		return {
			score: 100,
			sentenceCount: sentences.length,
			pairwiseSimilarities: [],
			averageSimilarity: 1.0,
			feedback: generateFeedback(100, sentences.length),
		};
	}

	const sentenceTokens = sentences.map((s) => tokenizeWords(s));

	const idf = calculateIDF(sentenceTokens);

	const tfidfVectors = sentenceTokens.map((tokens) =>
		calculateTFIDF(tokens, idf),
	);

	const similarities: number[] = [];
	for (let i = 0; i < tfidfVectors.length - 1; i++) {
		const sim = cosineSimilarity(tfidfVectors[i], tfidfVectors[i + 1]);
		similarities.push(sim);
	}

	const avgSimilarity =
		similarities.length > 0
			? similarities.reduce((a, b) => a + b, 0) / similarities.length
			: 0;
	const score = avgSimilarity * 100;

	return {
		score: Math.round(score * 100) / 100,
		sentenceCount: sentences.length,
		pairwiseSimilarities: similarities,
		averageSimilarity: avgSimilarity,
		feedback: generateFeedback(score, sentences.length),
	};
};
