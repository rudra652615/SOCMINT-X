<?php

/*
=====================================================
SOCMINT-X
Main Intelligence Analysis API
Version 3.0

Flow:
Frontend
   ↓
analyze.php
   ↓
Intelligence Aggregator
   ├── YouTube
   ├── GNews
   └── Hugging Face
=====================================================
*/

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../../config/config.php";
require_once __DIR__ . "/../../functions/http.php";
require_once __DIR__ . "/../../services/intelligence.php";


/*
=====================================================
JSON RESPONSE HELPER
=====================================================
*/

function analyzeResponse(
    bool $success,
    array $data = [],
    string $message = ""
) {

    echo json_encode(

        [
            "success" => $success,

            "message" => $message,

            "data" => $data

        ],

        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES

    );

    exit;
}


/*
=====================================================
REQUEST METHOD
=====================================================
*/

if (
    $_SERVER["REQUEST_METHOD"]
    !== "POST"
) {

    analyzeResponse(

        false,

        [],

        "Only POST requests are allowed."

    );
}


/*
=====================================================
READ JSON BODY
=====================================================
*/

$rawInput =
    file_get_contents(
        "php://input"
    );


$input =
    json_decode(
        $rawInput,
        true
    );


if (
    !is_array($input)
) {

    analyzeResponse(

        false,

        [],

        "Invalid JSON request."

    );
}

$requestApiKeys = $input["api_keys"] ?? [];
if (!is_array($requestApiKeys)) {
    analyzeResponse(false, [], "API keys must be sent as a named object.");
}

$allowedApiKeys = [
    "YOUTUBE_API_KEY",
    "GNEWS_API_KEY",
    "HUGGINGFACE_API_KEY",
    "GEMINI_API_KEY"
];
foreach ($requestApiKeys as $keyName => $keyValue) {
    if (
        !is_string($keyName)
        || !in_array($keyName, $allowedApiKeys, true)
        || !is_string($keyValue)
        || strlen($keyValue) > 512
        || preg_match('/[\x00-\x1F\x7F]/', $keyValue)
    ) {
        analyzeResponse(false, [], "An API key value is invalid.");
    }
}


/*
=====================================================
GET KEYWORD
=====================================================
*/

$keyword =
    trim(
        (string)
        ($input["keyword"] ?? "")
    );

$maxResults = $input["max_results"] ?? MAX_RESULTS_PER_SOURCE;
if (
    !is_int($maxResults)
    || $maxResults < 1
    || $maxResults > MAX_RESULTS_PER_SOURCE
) {
    analyzeResponse(
        false,
        [],
        "Maximum results must be an integer between 1 and "
        . MAX_RESULTS_PER_SOURCE
        . "."
    );
}


if (
    $keyword === ""
) {

    analyzeResponse(

        false,

        [],

        "Keyword is required."

    );
}


/*
=====================================================
MAX KEYWORD LENGTH
=====================================================
*/

if (
    strlen($keyword) > 200
) {

    analyzeResponse(

        false,

        [],

        "Keyword is too long."

    );
}


/*
=====================================================
RUN INTELLIGENCE PIPELINE
=====================================================
*/

$result =
    buildIntelligence(
        $keyword,
        $maxResults,
        $requestApiKeys
    );


/*
=====================================================
PIPELINE FAILURE
=====================================================
*/

if (
    !$result["success"]
) {

    analyzeResponse(

        false,

        $result,

        $result["error"]
        ?? "No intelligence data could be retrieved."

    );
}


/*
=====================================================
SUCCESS
=====================================================
*/

analyzeResponse(

    true,

    $result,

    "Intelligence analysis completed successfully."

);