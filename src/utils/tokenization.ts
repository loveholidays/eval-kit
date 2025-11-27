export const tokenizeWords = (text: string): string[] => {
	return text
		.toLowerCase()
		.replace(/[.,!?;:()[\]{}]/g, " $& ")
		.split(/\s+/)
		.filter((word) => word.length > 0);
};

export const tokenizeSentences = (text: string): string[] => {
	return text
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
};
