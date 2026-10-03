<?php
/*
=====================================================
SOCMINT-X
API Keys Configuration
Version 3.0

Configure API keys as environment variables in the PHP host.
Never commit API credentials to this repository.
=====================================================
*/

$apiKeyNames = [
    "YOUTUBE_API_KEY",
    "GNEWS_API_KEY",
    "HUGGINGFACE_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_SEARCH_API_KEY",
    "GOOGLE_SEARCH_ENGINE_ID"
];

$apiKeyOverrides = [];
$apiKeyFile = getenv("SOCMINT_SECRETS_PATH")
    ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . ".socmint-x-secrets.php";

if (is_file($apiKeyFile)) {
    $loadedApiKeyOverrides = require $apiKeyFile;
    if (!is_array($loadedApiKeyOverrides)) {
        throw new RuntimeException("The SOCMINT-X secrets file must return an array.");
    }
    $apiKeyOverrides = $loadedApiKeyOverrides;
}

foreach ($apiKeyNames as $apiKeyName) {
    if (!defined($apiKeyName)) {
        $apiKeyValue = getenv($apiKeyName);
        if ($apiKeyValue === false || trim($apiKeyValue) === "") {
            $apiKeyValue = $apiKeyOverrides[$apiKeyName] ?? "";
        }
        define(
            $apiKeyName,
            is_string($apiKeyValue) ? trim($apiKeyValue) : ""
        );
    }
}


/*
=====================================================
API STATUS HELPER
=====================================================
*/

function apiKeyConfigured(string $key): bool
{
    return defined($key)
        && constant($key) !== ""
        && trim(constant($key)) !== "";
}

function apiKeyValue(string $key, ?string $requestKey = null): string
{
    if (apiKeyConfigured($key)) {
        return trim((string) constant($key));
    }

    return is_string($requestKey) ? trim($requestKey) : "";
}

function apiKeySource(string $key, ?string $requestKey = null): string
{
    if (apiKeyConfigured($key)) {
        return "server";
    }

    return is_string($requestKey) && trim($requestKey) !== ""
        ? "browser"
        : "missing";
}
