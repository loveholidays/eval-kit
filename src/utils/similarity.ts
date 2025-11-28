export const cosineSimilarity = (
	vec1: Map<string, number>,
	vec2: Map<string, number>,
): number => {
	const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);

	let dotProduct = 0;
	let magnitude1 = 0;
	let magnitude2 = 0;

	for (const term of allTerms) {
		const val1 = vec1.get(term) || 0;
		const val2 = vec2.get(term) || 0;

		dotProduct += val1 * val2;
		magnitude1 += val1 * val1;
		magnitude2 += val2 * val2;
	}

	magnitude1 = Math.sqrt(magnitude1);
	magnitude2 = Math.sqrt(magnitude2);

	if (magnitude1 === 0 || magnitude2 === 0) {
		return 0;
	}

	return dotProduct / (magnitude1 * magnitude2);
};
