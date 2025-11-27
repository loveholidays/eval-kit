export const generateNgrams = (tokens: string[], n: number): string[][] => {
	if (n <= 0 || tokens.length < n) {
		return [];
	}

	const ngrams: string[][] = [];
	for (let i = 0; i <= tokens.length - n; i++) {
		ngrams.push(tokens.slice(i, i + n));
	}
	return ngrams;
};

export const countNgrams = (ngrams: string[][]): Map<string, number> => {
	const counts = new Map<string, number>();

	for (const ngram of ngrams) {
		const key = ngram.join(" ");
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	return counts;
};

export const calculateNgramPrecision = (
	candidateNgrams: string[][],
	referenceNgrams: string[][],
): number => {
	if (candidateNgrams.length === 0) {
		return 0;
	}

	const candidateCounts = countNgrams(candidateNgrams);
	const referenceCounts = countNgrams(referenceNgrams);

	let clippedMatches = 0;
	let totalCandidateNgrams = 0;

	for (const [ngram, candidateCount] of candidateCounts) {
		const referenceCount = referenceCounts.get(ngram) || 0;
		clippedMatches += Math.min(candidateCount, referenceCount);
		totalCandidateNgrams += candidateCount;
	}

	return totalCandidateNgrams > 0 ? clippedMatches / totalCandidateNgrams : 0;
};
