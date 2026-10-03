<?php

/*
=====================================================
SOCMINT-X
Application Configuration
Version 3.0
=====================================================
*/

define(
    "APP_NAME",
    "SOCMINT-X"
);

define(
    "APP_VERSION",
    "3.0"
);

define(
    "APP_ENV",
    getenv("APP_ENV") ?: "development"
);


/*
=====================================================
PATHS
=====================================================
*/

define(
    "BASE_PATH",
    dirname(__DIR__)
);

define(
    "CONFIG_PATH",
    BASE_PATH . "/config"
);

define(
    "API_PATH",
    BASE_PATH . "/backend/api"
);

define(
    "SERVICES_PATH",
    BASE_PATH . "/services"
);

define(
    "FUNCTIONS_PATH",
    BASE_PATH . "/functions"
);

define(
    "ASSETS_PATH",
    BASE_PATH . "/assets"
);

define(
    "PAGES_PATH",
    BASE_PATH . "/pages"
);

define(
    "STORAGE_PATH",
    BASE_PATH . "/storage"
);

define(
    "REPORTS_PATH",
    STORAGE_PATH . "/reports"
);

define(
    "CACHE_PATH",
    STORAGE_PATH . "/cache"
);


/*
=====================================================
TIMEZONE
=====================================================
*/

date_default_timezone_set(
    "Asia/Kolkata"
);


/*
=====================================================
APPLICATION LIMITS
=====================================================
*/

define(
    "MAX_KEYWORD_LENGTH",
    200
);

define(
    "MAX_RESULTS_PER_SOURCE",
    50
);

define(
    "REQUEST_TIMEOUT",
    30
);

define(
    "AI_REQUEST_TIMEOUT",
    60
);


/*
=====================================================
SECURITY
=====================================================
*/

define(
    "APP_USER_AGENT",
    "SOCMINT-X/3.0"
);

require_once CONFIG_PATH . "/api_keys.php";


/*
=====================================================
SUPPORTED INTELLIGENCE SOURCES
=====================================================
*/

define(
    "SOURCE_YOUTUBE",
    "YouTube"
);

define(
    "SOURCE_GNEWS",
    "GNews"
);

define(
    "SOURCE_HUGGINGFACE",
    "Hugging Face"
);

define(
    "SOURCE_GEMINI",
    "Gemini"
);


/*
=====================================================
SENTIMENT LABELS
=====================================================
*/

define(
    "SENTIMENT_POSITIVE",
    "POSITIVE"
);

define(
    "SENTIMENT_NEGATIVE",
    "NEGATIVE"
);


/*
=====================================================
CREATE REQUIRED STORAGE DIRECTORIES
=====================================================
*/

$requiredDirectories = [

    STORAGE_PATH,

    REPORTS_PATH,

    CACHE_PATH

];

foreach (
    $requiredDirectories
    as $directory
) {

    if (
        !is_dir($directory)
    ) {

        @mkdir(
            $directory,
            0755,
            true
        );
    }
}
