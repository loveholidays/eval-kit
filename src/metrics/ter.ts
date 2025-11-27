import { distance } from "fastest-levenshtein";
import { tokenizeWords } from "../utils/tokenization.js";

export interface TerOptions {
	normalize?: boolean;
}

export interface TerResult {
	score: number;
	rawTer: number;
	editCount: number;
	candidateLength: number;
	referenceLength: number;
	feedback: string;
}

export const calculateTer = (
	candidate: string,
	reference: string,
	options: TerOptions = {},
): TerResult => {
	const { normalize = true } = options;

	const candidateTokens = tokenizeWords(candidate);
	const referenceTokens = tokenizeWords(reference);

	const candidateLength = candidateTokens.length;
	const referenceLength = referenceTokens.length;

	const editCount = distance(
		candidateTokens.join(" "),
		referenceTokens.join(" "),
	);

	let rawTer = 0;
	if (normalize && referenceLength > 0) {
		rawTer = editCount / referenceLength;
	} else {
		rawTer = editCount;
	}

	const invertedScore = Math.max(0, 1 - rawTer) * 100;

	let feedback = "";
	if (editCount === 0) {
		feedback = "Perfect match with reference translation";
	} else if (rawTer < 0.2) {
		feedback = `Excellent translation with only ${editCount} minor edit(s) needed`;
	} else if (rawTer < 0.4) {
		feedback = `Good translation with ${editCount} edit(s) needed`;
	} else if (rawTer < 0.6) {
		feedback = `Fair translation requiring ${editCount} edit(s)`;
	} else {
		feedback = `Poor translation requiring ${editCount} edit(s) - significant revision needed`;
	}

	const lengthDiff = Math.abs(candidateLength - referenceLength);
	if (lengthDiff > referenceLength * 0.2) {
		if (candidateLength > referenceLength) {
			feedback += ` (translation is ${lengthDiff} words too long)`;
		} else {
			feedback += ` (translation is ${lengthDiff} words too short)`;
		}
	}

	return {
		score: Math.round(invertedScore * 100) / 100,
		rawTer: Math.round(rawTer * 10000) / 10000,
		editCount,
		candidateLength,
		referenceLength,
		feedback,
	};
};
