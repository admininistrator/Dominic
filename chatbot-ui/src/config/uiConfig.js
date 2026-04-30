export const TYPEWRITER_INTERVAL_MS = 12;

const GPT_THINKING_EFFORT_OPTIONS = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "xhigh", label: "xHigh", disabled: true },
];

const CLAUDE_SONNET_THINKING_EFFORT_OPTIONS = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];

const CLAUDE_OPUS_THINKING_EFFORT_OPTIONS = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "xhigh", label: "xHigh" },
];

const KILOCODE_THINKING_MODE_OPTIONS = [
	{ value: "instant", label: "Instant" },
	{ value: "thinking", label: "Thinking" },
];

export const CHAT_MODEL_AVAILABILITY = {
	"claude-opus-4.6": false,
};

export const CHAT_MODEL_OPTIONS = [
	{
		id: "gpt-5.3-codex",
		label: "GPT-5.3 Codex",
		group: "OpenAI",
		description: "From OpenAI",
		thinkingOptions: GPT_THINKING_EFFORT_OPTIONS,
	},
	{
		id: "gpt-5.4",
		label: "GPT-5.4",
		group: "OpenAI",
		description: "From OpenAI",
		thinkingOptions: GPT_THINKING_EFFORT_OPTIONS,
	},
	{
		id: "gemini-3.1-pro-preview",
		label: "Gemini 3.1 Pro Preview",
		group: "Google",
		description: "From Google",
		thinkingOptions: [],
	},
	{
		id: "claude-haiku-4.5",
		label: "Claude Haiku 4.5",
		group: "Anthropic",
		description: "From Anthropic",
		thinkingOptions: [],
	},
	{
		id: "gpt-5.4-mini",
		label: "GPT-5.4 Mini",
		group: "OpenAI",
		description: "From OpenAI",
		thinkingOptions: GPT_THINKING_EFFORT_OPTIONS,
	},
	{
		id: "claude-sonnet-4.6",
		label: "Claude Sonnet 4.6",
		group: "Anthropic",
		description: "From Anthropic",
		thinkingOptions: CLAUDE_SONNET_THINKING_EFFORT_OPTIONS,
	},
	{
		id: "claude-opus-4.6",
		label: "Claude Opus 4.6",
		group: "Anthropic",
		description: "From Anthropic",
		thinkingOptions: CLAUDE_OPUS_THINKING_EFFORT_OPTIONS,
	},
	{
		id: "deepseek-v4-pro",
		label: "DeepSeek V4 Pro",
		group: "DeepSeek",
		description: "From DeepSeek",
		thinkingOptions: [],
	},
	{
		id: "kc/nvidia/nemotron-3-super-120b-a12b:free",
		label: "NVIDIA Nemotron 3 Super 120B",
		group: "KiloCode",
		description: "From NVIDIA",
		thinkingOptions: [],
	},
	{
		id: "kc/moonshotai/kimi-k2.6",
		label: "MoonshotAI Kimi K2.6",
		group: "KiloCode",
		description: "From MoonshotAI",
		thinkingOptions: KILOCODE_THINKING_MODE_OPTIONS,
	},
	{
		id: "kc/inclusionai/ling-2.6-1t:free",
		label: "inclusionAI Ling-2.6-1T",
		group: "KiloCode",
		description: "From inclusionAI",
		thinkingOptions: [],
	},
	{
		id: "kc/qwen/qwen3.6-plus",
		label: "Qwen 3.6 Plus",
		group: "KiloCode",
		description: "From Qwen",
		thinkingOptions: KILOCODE_THINKING_MODE_OPTIONS,
	},
	{
		id: "kc/minimax/minimax-m2.7",
		label: "MiniMax M2.7",
		group: "KiloCode",
		description: "From MiniMax",
		thinkingOptions: [],
	},
].map((option) => ({
	...option,
	available: (CHAT_MODEL_AVAILABILITY[option.id] ?? true) !== false,
}));

const CHAT_MODEL_GROUP_ORDER = ["OpenAI", "Anthropic", "Google", "DeepSeek", "KiloCode"];

export const SUPPORTED_CHAT_MODELS = CHAT_MODEL_OPTIONS.map((option) => option.id);
export const AVAILABLE_CHAT_MODELS = CHAT_MODEL_OPTIONS.filter((option) => option.available).map((option) => option.id);
export const DEFAULT_CHAT_MODEL = AVAILABLE_CHAT_MODELS.includes("gpt-5.4")
	? "gpt-5.4"
	: AVAILABLE_CHAT_MODELS[0] || SUPPORTED_CHAT_MODELS[0] || "";

function normalizeModelName(modelName) {
	return typeof modelName === "string" ? modelName.trim().toLowerCase() : "";
}

export function getChatModelOption(modelName) {
	const normalized = normalizeModelName(modelName);
	if (!normalized) return null;
	return CHAT_MODEL_OPTIONS.find((option) => option.id.toLowerCase() === normalized) || null;
}

export function getChatModelLabel(modelName) {
	return getChatModelOption(modelName)?.label || (typeof modelName === "string" ? modelName.trim() : "");
}

export function getChatModelDescription(modelName) {
	const option = getChatModelOption(modelName);
	if (!option) return "";
	return option.available ? option.description || "" : "Not available";
}

export function isChatModelAvailable(modelName) {
	return Boolean(getChatModelOption(modelName)?.available);
}

export function getGroupedChatModelOptions(modelNames = []) {
	const normalizedModelNames = new Set(
		Array.isArray(modelNames)
			? modelNames
				.map((modelName) => (typeof modelName === "string" ? modelName.trim() : ""))
				.filter(Boolean)
			: []
	);

	const options = CHAT_MODEL_OPTIONS.filter((option) => normalizedModelNames.has(option.id));
	const grouped = new Map();

	for (const option of options) {
		const groupName = option.group || "Other";
		if (!grouped.has(groupName)) {
			grouped.set(groupName, []);
		}
		grouped.get(groupName).push(option);
	}

	return [...grouped.entries()]
		.sort(([groupA], [groupB]) => {
			const orderA = CHAT_MODEL_GROUP_ORDER.indexOf(groupA);
			const orderB = CHAT_MODEL_GROUP_ORDER.indexOf(groupB);
			const normalizedOrderA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
			const normalizedOrderB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
			if (normalizedOrderA !== normalizedOrderB) {
				return normalizedOrderA - normalizedOrderB;
			}
			return groupA.localeCompare(groupB);
		})
		.map(([group, models]) => ({ group, models }));
}

export function getChatModelDisplayText(modelName, effortValue, fallbackText = "") {
	const label = getChatModelLabel(modelName);
	const normalizedEffort = typeof effortValue === "string" ? effortValue.trim().toLowerCase() : "";
	if (label) {
		if (normalizedEffort) {
			const effortLabel = getThinkingEffortLabel(modelName, normalizedEffort);
			return effortLabel ? `${label} ${effortLabel}` : label;
		}
		return label;
	}
	return typeof fallbackText === "string" ? fallbackText.trim() : "";
}

export function getThinkingEffortOptionsForModel(modelName) {
	const option = getChatModelOption(modelName);
	if (!option?.available) return [];
	return option.thinkingOptions || [];
}

export function supportsThinkingEffort(modelName) {
	return getThinkingEffortOptionsForModel(modelName).some((option) => !option.disabled);
}

export function getDefaultThinkingEffortForModel(modelName) {
	const options = getThinkingEffortOptionsForModel(modelName).filter((option) => !option.disabled);
	return options.find((option) => option.value === "medium")?.value || options[0]?.value || null;
}

export function normalizeThinkingEffortForModel(modelName, effortValue) {
	const options = getThinkingEffortOptionsForModel(modelName).filter((option) => !option.disabled);
	if (options.length === 0) return null;

	const normalized = typeof effortValue === "string" ? effortValue.trim().toLowerCase() : "";
	if (options.some((option) => option.value === normalized)) {
		return normalized;
	}

	return getDefaultThinkingEffortForModel(modelName);
}

export function getThinkingEffortLabel(modelName, effortValue) {
	const options = getThinkingEffortOptionsForModel(modelName);
	const normalized = typeof effortValue === "string" ? effortValue.trim().toLowerCase() : "";
	if (normalized) {
		const matched = options.find((option) => option.value === normalized);
		if (matched) return matched.label;
	}
	const fallback = getDefaultThinkingEffortForModel(modelName);
	return options.find((option) => option.value === fallback)?.label || "";
}

