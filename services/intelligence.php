<?php

/*
=====================================================
SOCMINT-X
Unified Intelligence Aggregator
Version 3.0

Sources:
- YouTube
- GNews
- Hugging Face Sentiment
=====================================================
*/

require_once __DIR__ . "/../config/config.php";
require_once __DIR__ . "/youtube.php";
require_once __DIR__ . "/gnews.php";
require_once __DIR__ . "/sentiment.php";
require_once __DIR__ . "/gemini.php";


/*
=====================================================
BUILD INTELLIGENCE DATASET
=====================================================
*/

function buildIntelligence(
    string $keyword,
    int $maxResults = MAX_RESULTS_PER_SOURCE,
    array $requestApiKeys = []
) {

    $keyword = trim($keyword);
    $maxResults = max(1, min($maxResults, MAX_RESULTS_PER_SOURCE));

    if ($keyword === "") {

        return [
            "success" => false,
            "keyword" => "",
            "items" => [],
            "sources" => [],
            "sentiment" => [
                "positive" => 0,
                "negative" => 0,
                "analyzed" => 0,
                "failed" => 0
            ],
            "error" => "Keyword is required."
        ];
    }


    /*
    ---------------------------------------------
    Fetch real YouTube data
    ---------------------------------------------
    */

    $youtube =
        getYouTubeIntelligence(
            $keyword,
            $maxResults,
            $requestApiKeys["YOUTUBE_API_KEY"] ?? null
        );


    /*
    ---------------------------------------------
    Fetch real GNews data
    ---------------------------------------------
    */

    $gnews =
        getGNewsIntelligence(
            $keyword,
            $maxResults,
            $requestApiKeys["GNEWS_API_KEY"] ?? null
        );


    /*
    ---------------------------------------------
    Unified items
    ---------------------------------------------
    */

    $items = combineIntelligence(
        $youtube["success"] ? $youtube["items"] : [],
        $gnews["success"] ? $gnews["items"] : []
    );

    foreach (array_slice(array_keys($items), 0, 30) as $index) {
        $items[$index]["gemini_ref"] = "S" . ($index + 1);
    }


    /*
    ---------------------------------------------
    Extract text for sentiment
    ---------------------------------------------
    */

    $texts = [];

    foreach (
        $items
        as $item
    ) {

        $text = trim(

            ($item["title"] ?? "")
            . " "
            . ($item["description"] ?? "")

        );

        if ($text !== "") {

            $texts[] = $text;
        }
    }

    /*
    ---------------------------------------------
    Real Hugging Face sentiment
    ---------------------------------------------
    */

    $sentiment =
        analyzeSentimentBatch(
            $texts,
            $requestApiKeys["HUGGINGFACE_API_KEY"] ?? null
        );


    /*
    ---------------------------------------------
    Attach sentiment to items
    ---------------------------------------------
    */

    foreach (
        $items
        as $index => &$item
    ) {

        $item["sentiment"] = null;

        $item["confidence"] = 0;

        if (
            isset(
                $sentiment["results"][$index]
            )
        ) {

            $prediction =
                $sentiment["results"][$index];

            if (
                !empty(
                    $prediction["label"]
                )
            ) {

                $item["sentiment"] =
                    $prediction["label"];

                $item["confidence"] =
                    $prediction["confidence"];
            }
        }
    }

    unset($item);

    $gemini = summarizeWithGemini(
        $keyword,
        $items,
        $requestApiKeys["GEMINI_API_KEY"] ?? null
    );
    $locationEstimates = [];
    foreach (($gemini["location_estimates"] ?? []) as $estimate) {
        if (is_array($estimate) && isset($estimate["ref"])) {
            $locationEstimates[(string) $estimate["ref"]] = $estimate;
        }
    }
    foreach ($items as &$item) {
        $ref = (string) ($item["gemini_ref"] ?? "");
        if (isset($locationEstimates[$ref])) {
            $item["gemini_location"] = $locationEstimates[$ref];
        }
    }
    unset($item);


    /*
    ---------------------------------------------
    Source status
    ---------------------------------------------
    */

    $sources = [

        "youtube" => [

            "available" =>
                $youtube["success"],

            "count" =>
                $youtube["total"] ?? 0,

            "key_source" =>
                apiKeySource(
                    "YOUTUBE_API_KEY",
                    $requestApiKeys["YOUTUBE_API_KEY"] ?? null
                ),

            "error" =>
                $youtube["error"] ?? null

        ],

        "gnews" => [

            "available" =>
                $gnews["success"],

            "count" =>
                $gnews["total"] ?? 0,

            "key_source" =>
                apiKeySource(
                    "GNEWS_API_KEY",
                    $requestApiKeys["GNEWS_API_KEY"] ?? null
                ),

            "error" =>
                $gnews["error"] ?? null

        ]

    ];


    /*
    ---------------------------------------------
    Overall status
    ---------------------------------------------
    */

    $successfulSources = 0;

    foreach (
        $sources
        as $source
    ) {

        if (
            $source["available"]
        ) {

            $successfulSources++;
        }
    }


    /*
    ---------------------------------------------
    Return complete intelligence
    ---------------------------------------------
    */

    return [

        "success" =>
            $successfulSources > 0,

        "keyword" =>
            $keyword,

        "total" =>
            count($items),

        "items" =>
            $items,

        "sources" =>
            $sources,

        "sentiment" =>
            $sentiment["summary"] ?? [

                "positive" => 0,

                "negative" => 0,

                "analyzed" => 0,

                "failed" => 0

            ],

        "gemini" => $gemini,

        "generated_at" => gmdate("c")

    ];
}
