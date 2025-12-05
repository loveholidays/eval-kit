import {
	AutoTokenizer,
	AutoModelForCausalLM,
	type PreTrainedTokenizer,
	type PreTrainedModel,
} from "@xenova/transformers";

export interface PerplexityOptions {
	model?: string;
	stride?: number;
}

export interface PerplexityResult {
	perplexity: number;
	score: number;
	tokenCount: number;
	averageLogProb: number;
	modelUsed: string;
	feedback: string;
}

let cachedTokenizer: PreTrainedTokenizer | null = null;
let cachedModel: PreTrainedModel | null = null;
let cachedModelName: string | null = null;

const getModelAndTokenizer = async (
	modelName: string,
): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> => {
	if (
		cachedTokenizer &&
		cachedModel &&
		cachedModelName === modelName
	) {
		return { tokenizer: cachedTokenizer, model: cachedModel };
	}

	const [tokenizer, model] = await Promise.all([
		AutoTokenizer.from_pretrained(modelName),
		AutoModelForCausalLM.from_pretrained(modelName, {
			quantized: true,
		}),
	]);

	cachedTokenizer = tokenizer;
	cachedModel = model;
	cachedModelName = modelName;

	return { tokenizer, model };
};

const softmax = (logits: number[]): number[] => {
	const maxLogit = Math.max(...logits);
	const exps = logits.map((x) => Math.exp(x - maxLogit));
	const sumExps = exps.reduce((a, b) => a + b, 0);
	return exps.map((x) => x / sumExps);
};

const normalizePerplexityToScore = (perplexity: number): number => {
	if (perplexity < 20) {
		return 90 + ((20 - perplexity) / 20) * 10;
	}
	if (perplexity < 50) {
		return 70 + ((50 - perplexity) / 30) * 20;
	}
	if (perplexity < 100) {
		return 40 + ((100 - perplexity) / 50) * 30;
	}
	if (perplexity < 300) {
		return 10 + ((300 - perplexity) / 200) * 30;
	}
	return Math.max(0, 10 - (perplexity - 300) / 100);
};

const generateFeedback = (perplexity: number, score: number): string => {
	if (perplexity < 20) {
		return `Excellent text quality with very natural, human-like language (perplexity: ${perplexity.toFixed(1)})`;
	}
	if (perplexity < 50) {
		return `Good text quality with mostly natural phrasing (perplexity: ${perplexity.toFixed(1)})`;
	}
	if (perplexity < 100) {
		return `Fair text quality with somewhat unnatural phrasing (perplexity: ${perplexity.toFixed(1)})`;
	}
	if (perplexity < 300) {
		return `Poor text quality with many awkward sequences (perplexity: ${perplexity.toFixed(1)})`;
	}
	return `Very poor text quality with nonsensical or extremely unnatural language (perplexity: ${perplexity.toFixed(1)})`;
};

export const calculatePerplexity = async (
	text: string,
	options: PerplexityOptions = {},
): Promise<PerplexityResult> => {
	const { model: modelName = "distilgpt2", stride = 512 } = options;

	const { tokenizer, model } = await getModelAndTokenizer(modelName);

	const encoded = await tokenizer(text, {
		return_tensors: "pt",
		truncation: false,
		add_special_tokens: true,
	});

	const inputIds = Array.from(encoded.input_ids.data as BigInt64Array).map(
		(x) => Number(x),
	);

	if (inputIds.length <= 1) {
		return {
			perplexity: 1.0,
			score: 100,
			tokenCount: inputIds.length,
			averageLogProb: 0,
			modelUsed: modelName,
			feedback: "Text too short to calculate perplexity meaningfully",
		};
	}

	let totalLogProb = 0;
	let totalTokens = 0;

	for (let i = 0; i < inputIds.length; i += stride) {
		const end = Math.min(i + stride + 1, inputIds.length);
		const batch = inputIds.slice(i, end);

		if (batch.length <= 1) continue;

		const batchTensor = {
			input_ids: {
				data: new BigInt64Array(batch.map((x) => BigInt(x))),
				dims: [1, batch.length],
			},
		};

		const outputs = await model(batchTensor);
		const logits = outputs.logits;

		if (!logits || !logits.data) continue;

		const vocabSize = (tokenizer.model as any).vocab?.length || 50257;
		const logitsArray = Array.from(logits.data as Float32Array);

		for (let j = 1; j < batch.length; j++) {
			const startIdx = (j - 1) * vocabSize;
			const endIdx = startIdx + vocabSize;
			const prevLogits = logitsArray.slice(startIdx, endIdx);

			const probs = softmax(prevLogits);
			const targetTokenId = batch[j];
			const prob = probs[targetTokenId] || 1e-10;

			totalLogProb += Math.log(prob);
			totalTokens++;
		}

		if (end >= inputIds.length) break;
	}

	const averageLogProb = totalTokens > 0 ? totalLogProb / totalTokens : 0;
	const perplexity = Math.exp(-averageLogProb);
	const score = normalizePerplexityToScore(perplexity);

	return {
		perplexity: Math.round(perplexity * 100) / 100,
		score: Math.round(score * 100) / 100,
		tokenCount: totalTokens,
		averageLogProb: Math.round(averageLogProb * 10000) / 10000,
		modelUsed: modelName,
		feedback: generateFeedback(perplexity, score),
	};
};

export const clearPerplexityCache = (): void => {
	cachedTokenizer = null;
	cachedModel = null;
	cachedModelName = null;
};
