export const calculateIDF = (
	sentenceTokens: string[][],
): Map<string, number> => {
	const totalSentences = sentenceTokens.length;
	const documentFrequency = new Map<string, number>();

	// Count how many sentences each word appears in
	for (const tokens of sentenceTokens) {
		const uniqueTokens = new Set(tokens);
		for (const token of uniqueTokens) {
			documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
		}
	}

	// Calculate IDF: log((total_sentences + 1) / (sentences_containing_term + 1))
	// Add smoothing to avoid zero IDF values
	const idf = new Map<string, number>();
	for (const [term, df] of documentFrequency) {
		idf.set(term, Math.log((totalSentences + 1) / (df + 1)));
	}

	return idf;
};

export const calculateTFIDF = (
	tokens: string[],
	idf: Map<string, number>,
): Map<string, number> => {
	// Calculate TF (term frequency)
	const tf = new Map<string, number>();
	for (const token of tokens) {
		tf.set(token, (tf.get(token) || 0) + 1);
	}

	// Multiply TF by IDF
	const tfidf = new Map<string, number>();
	for (const [term, termFreq] of tf) {
		const idfValue = idf.get(term) || 0;
		tfidf.set(term, termFreq * idfValue);
	}

	return tfidf;
};
