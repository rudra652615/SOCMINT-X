"use strict";

const SOCMINT_API_KEYS_STORAGE_KEY = "socmint_api_keys";
const SOCMINT_ACTIVE_API_KEYS = [
    "YOUTUBE_API_KEY",
    "GNEWS_API_KEY",
    "HUGGINGFACE_API_KEY",
    "GEMINI_API_KEY"
];

window.getSOCMINTApiKeys = function () {
    try {
        const stored = localStorage.getItem(SOCMINT_API_KEYS_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Stored API keys are not an object.");
        }

        return Object.fromEntries(SOCMINT_ACTIVE_API_KEYS
            .filter(name => typeof parsed[name] === "string" && parsed[name].trim() !== "")
            .map(name => [name, parsed[name].trim()]));
    } catch (error) {
        console.error("Unable to read browser API keys:", error);
        return {};
    }
};
