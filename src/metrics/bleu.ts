import { calculateNgramPrecision, generateNgrams } from "../utils/ngram.js";
import { tokenizeWords } from "../utils/tokenization.js";

export interface BleuOptions {
	maxNgramSize?: number;
	smoothing?: number;
}

export interface BleuResult {
	score: number;
	precisions: number[];
	brevityPenalty: number;
	candidateLength: number;
	referenceLength: number;
}

export const calculateBleu = (
	candidate: string,
	reference: string,
	options: BleuOptions = {},
): BleuResult => {
	const { maxNgramSize = 4, smoothing = 0 } = options;

	const candidateTokens = tokenizeWords(candidate);
	const referenceTokens = tokenizeWords(reference);

	const candidateLength = candidateTokens.length;
	const referenceLength = referenceTokens.length;

	const precisions: number[] = [];

	for (let n = 1; n <= maxNgramSize; n++) {
		const candidateNgrams = generateNgrams(candidateTokens, n);
		const referenceNgrams = generateNgrams(referenceTokens, n);

		const precision = calculateNgramPrecision(candidateNgrams, referenceNgrams);

		const smoothedPrecision = Math.max(precision, smoothing);
		precisions.push(smoothedPrecision);
	}

	let brevityPenalty = 1.0;
	if (candidateLength < referenceLength) {
		brevityPenalty = Math.exp(1 - referenceLength / candidateLength);
	}

	let logSum = 0;
	let validPrecisions = 0;

	for (const precision of precisions) {
		if (precision > 0) {
			logSum += Math.log(precision);
			validPrecisions++;
		}
	}

	let bleuScore = 0;
	if (validPrecisions > 0) {
		const geometricMean = Math.exp(logSum / validPrecisions);
		bleuScore = brevityPenalty * geometricMean * 100;
	}

	return {
		score: Math.round(bleuScore * 100) / 100,
		precisions: precisions.map((p) => Math.round(p * 10000) / 100),
		brevityPenalty: Math.round(brevityPenalty * 10000) / 10000,
		candidateLength,
		referenceLength,
	};
};
