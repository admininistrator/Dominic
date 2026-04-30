const iconModules = import.meta.glob("./*.svg", { eager: true, import: "default" });

function getIconNameFromPath(path) {
	return path.split("/").pop()?.replace(/\.svg$/i, "") || "";
}

function normalizeIconKey(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const ICONS_BY_NAME = Object.fromEntries(
	Object.entries(iconModules).map(([path, icon]) => [normalizeIconKey(getIconNameFromPath(path)), icon])
);

function getIconAsset(iconName) {
	return ICONS_BY_NAME[normalizeIconKey(iconName)] || null;
}

export const DOMINIC_AVATAR_ICON = getIconAsset("dominic-avatar");
export const MODEL_PICKER_AVATAR_ICON = getIconAsset("model-picker-avatar");
export const USER_AVATAR_ICON = getIconAsset("user-avatar");

export function getModelPickerIcon(modelName) {
	const normalizedModel = String(modelName || "").trim().toLowerCase();
	const sanitizedModel = normalizeIconKey(normalizedModel);
	const modelSegments = normalizedModel
		.split("/")
		.map((segment) => normalizeIconKey(segment))
		.filter(Boolean);
	const providerCandidates = [];

	if (normalizedModel.startsWith("gpt-")) providerCandidates.push("openai-logo");
	if (normalizedModel.startsWith("claude-")) providerCandidates.push("anthropic-logo");
	if (normalizedModel.includes("gemini")) providerCandidates.push("google-gemini-logo");
	if (normalizedModel.startsWith("deepseek-")) providerCandidates.push("deepseek-logo");

	const candidates = [
		sanitizedModel,
		...modelSegments,
		...providerCandidates,
		"model-picker-avatar",
	];

	for (const candidate of candidates) {
		const icon = getIconAsset(candidate);
		if (icon) return icon;
	}

	return MODEL_PICKER_AVATAR_ICON;
}