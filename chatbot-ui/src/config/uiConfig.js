export const TYPEWRITER_INTERVAL_MS = 12;

const FALLBACK_MODEL_CATALOG = {
	defaultModel: "gpt-5.4",
	models: [
		{
			id: "gpt-5.4",
			label: "GPT-5.4",
			displayProvider: "OpenAI",
			enabled: true,
			default: true,
			capabilities: {
				reasoningEffort: {
					enabled: true,
					allowedValues: ["low", "medium", "high"],
					default: "medium",
					userConfigurable: true,
				},
			},
		},
	],
};

const CHAT_MODEL_GROUP_ORDER = ["OpenAI", "Anthropic", "Google/Gemini", "Google", "DeepSeek", "NVIDIA", "Custom"];

export let CHAT_MODEL_OPTIONS = [];
export let SUPPORTED_CHAT_MODELS = [];
export let AVAILABLE_CHAT_MODELS = [];
export let DEFAULT_CHAT_MODEL = "";

function labelForEffort(value) {
	const normalized = String(value || "").trim().toLowerCase();
	const labels = {
		instant: "Instant",
		thinking: "Thinking",
		minimal: "Minimal",
		low: "Low",
		medium: "Medium",
		high: "High",
		xhigh: "xHigh",
	};
	return labels[normalized] || normalized;
}

function normalizeReasoningOptions(model) {
	const capability = model?.capabilities?.reasoningEffort;
	if (!capability?.enabled || capability.userConfigurable === false) return [];
	const allowedValues = Array.isArray(capability.allowedValues) ? capability.allowedValues : [];
	return allowedValues
		.map((value) => String(value || "").trim().toLowerCase())
		.filter(Boolean)
		.map((value) => ({ value, label: labelForEffort(value) }));
}

function normalizeCatalog(rawCatalog) {
	const source = rawCatalog && Array.isArray(rawCatalog.models) ? rawCatalog : FALLBACK_MODEL_CATALOG;
	const models = source.models
		.filter((model) => model && typeof model.id === "string" && model.id.trim())
		.map((model) => {
			const id = model.id.trim();
			const displayProvider = String(model.displayProvider || model.providerLabel || "Other").trim() || "Other";
			return {
				id,
				label: String(model.label || id).trim(),
				group: displayProvider,
				description: `From ${displayProvider}`,
				available: model.enabled !== false,
				default: Boolean(model.default),
				thinkingOptions: normalizeReasoningOptions(model),
				thinkingDefault: String(model?.capabilities?.reasoningEffort?.default || "").trim().toLowerCase() || null,
			};
		});

	const available = models.filter((option) => option.available);
	const defaultModel = String(source.defaultModel || "").trim();
	const resolvedDefault = available.some((option) => option.id === defaultModel)
		? defaultModel
		: available.find((option) => option.default)?.id || available[0]?.id || models[0]?.id || "";

	return { models, defaultModel: resolvedDefault };
}

export function configureChatModelCatalog(rawCatalog) {
	const catalog = normalizeCatalog(rawCatalog);
	CHAT_MODEL_OPTIONS = catalog.models;
	SUPPORTED_CHAT_MODELS = CHAT_MODEL_OPTIONS.map((option) => option.id);
	AVAILABLE_CHAT_MODELS = CHAT_MODEL_OPTIONS.filter((option) => option.available).map((option) => option.id);
	DEFAULT_CHAT_MODEL = catalog.defaultModel;
	return {
		defaultModel: DEFAULT_CHAT_MODEL,
		supportedModels: SUPPORTED_CHAT_MODELS,
		availableModels: AVAILABLE_CHAT_MODELS,
		models: CHAT_MODEL_OPTIONS,
	};
}

configureChatModelCatalog(FALLBACK_MODEL_CATALOG);

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
		if (!grouped.has(groupName)) grouped.set(groupName, []);
		grouped.get(groupName).push(option);
	}

	return [...grouped.entries()]
		.sort(([groupA], [groupB]) => {
			const orderA = CHAT_MODEL_GROUP_ORDER.indexOf(groupA);
			const orderB = CHAT_MODEL_GROUP_ORDER.indexOf(groupB);
			const normalizedOrderA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
			const normalizedOrderB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
			if (normalizedOrderA !== normalizedOrderB) return normalizedOrderA - normalizedOrderB;
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
	const option = getChatModelOption(modelName);
	const options = getThinkingEffortOptionsForModel(modelName).filter((item) => !item.disabled);
	if (options.length === 0) return null;
	if (option?.thinkingDefault && options.some((item) => item.value === option.thinkingDefault)) {
		return option.thinkingDefault;
	}
	return options.find((item) => item.value === "medium")?.value || options[0]?.value || null;
}

export function normalizeThinkingEffortForModel(modelName, effortValue) {
	const options = getThinkingEffortOptionsForModel(modelName).filter((option) => !option.disabled);
	if (options.length === 0) return null;

	const normalized = typeof effortValue === "string" ? effortValue.trim().toLowerCase() : "";
	if (options.some((option) => option.value === normalized)) return normalized;
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
