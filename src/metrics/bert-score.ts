import type { FeatureExtractionPipeline, Tensor } from "@xenova/transformers";
import { cos_sim, pipeline } from "@xenova/transformers";
import { tokenizeWords } from "../utils/tokenization.js";

export interface BertScoreOptions {
	model?: string;
	scoreType?: "f1" | "precision" | "recall";
}

export interface BertScoreResult {
	score: number;
	precision: number;
	recall: number;
	f1: number;
	modelUsed: string;
}

let cachedPipeline: FeatureExtractionPipeline | null = null;
let cachedModelName: string | null = null;

const getPipeline = async (
	modelName: string,
): Promise<FeatureExtractionPipeline> => {
	if (cachedPipeline && cachedModelName === modelName) {
		return cachedPipeline;
	}

	cachedPipeline = await pipeline("feature-extraction", modelName, {
		quantized: false,
	});
	cachedModelName = modelName;

	return cachedPipeline;
};

const getTokenEmbeddings = async (
	tokens: string[],
	extractor: FeatureExtractionPipeline,
): Promise<number[][]> => {
	const embeddings: number[][] = [];

	for (const token of tokens) {
		const embedding = await extractor(token, {
			pooling: "mean",
			normalize: true,
		});
		embeddings.push(Array.from(embedding.data as Float32Array));
	}

	return embeddings;
};

const computeMaxSimilarities = (
	sourceEmbeddings: number[][],
	targetEmbeddings: number[][],
): number[] => {
	const maxSimilarities: number[] = [];

	for (const sourceEmb of sourceEmbeddings) {
		let maxSim = -1;
		for (const targetEmb of targetEmbeddings) {
			const sim = cos_sim(sourceEmb, targetEmb);
			if (sim > maxSim) {
				maxSim = sim;
			}
		}
		maxSimilarities.push(maxSim);
	}

	return maxSimilarities;
};

export const calculateBertScore = async (
	candidate: string,
	reference: string,
	options: BertScoreOptions = {},
): Promise<BertScoreResult> => {
	const { model = "Xenova/all-MiniLM-L6-v2", scoreType = "f1" } = options;

	const extractor = await getPipeline(model);

	const candidateTokens = tokenizeWords(candidate);
	const referenceTokens = tokenizeWords(reference);

	const candidateEmbeddings = await getTokenEmbeddings(
		candidateTokens,
		extractor,
	);
	const referenceEmbeddings = await getTokenEmbeddings(
		referenceTokens,
		extractor,
	);

	const precisionSimilarities = computeMaxSimilarities(
		candidateEmbeddings,
		referenceEmbeddings,
	);
	const recallSimilarities = computeMaxSimilarities(
		referenceEmbeddings,
		candidateEmbeddings,
	);

	const precision =
		precisionSimilarities.length > 0
			? precisionSimilarities.reduce((sum, sim) => sum + sim, 0) /
				precisionSimilarities.length
			: 0;

	const recall =
		recallSimilarities.length > 0
			? recallSimilarities.reduce((sum, sim) => sum + sim, 0) /
				recallSimilarities.length
			: 0;

	const f1 =
		precision + recall > 0
			? (2 * precision * recall) / (precision + recall)
			: 0;

	let finalScore = f1;
	if (scoreType === "precision") {
		finalScore = precision;
	} else if (scoreType === "recall") {
		finalScore = recall;
	}

	return {
		score: Math.round(finalScore * 10000) / 100,
		precision: Math.round(precision * 10000) / 100,
		recall: Math.round(recall * 10000) / 100,
		f1: Math.round(f1 * 10000) / 100,
		modelUsed: model,
	};
};

export const clearBertCache = (): void => {
	cachedPipeline = null;
	cachedModelName = null;
};
