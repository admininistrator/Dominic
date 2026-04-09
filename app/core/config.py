import os


def _get_int(name: str, default: int, min_value: int = 1) -> int:
	raw = os.getenv(name)
	if raw is None:
		return default
	try:
		value = int(raw)
		if value < min_value:
			return default
		return value
	except ValueError:
		return default


# Hybrid context tuning
CONTEXT_WINDOW_SIZE = _get_int("CONTEXT_WINDOW_SIZE", 8)
SUMMARY_TRIGGER_MESSAGES = _get_int("SUMMARY_TRIGGER_MESSAGES", 10)
SUMMARY_MAX_TOKENS = _get_int("SUMMARY_MAX_TOKENS", 220)

# Model output tuning
MAX_OUTPUT_TOKENS = _get_int("MAX_OUTPUT_TOKENS", 5000)

# Quota window tuning (rolling window, in hours)
ROLLING_WINDOW_HOURS = _get_int("ROLLING_WINDOW_HOURS", 2)

# Heuristic fallback when provider token counting is unavailable
TOKEN_ESTIMATE_CHARS_PER_TOKEN = _get_int("TOKEN_ESTIMATE_CHARS_PER_TOKEN", 4)

