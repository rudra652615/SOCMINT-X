<?php

/*
=====================================================
SOCMINT-X
GNews Intelligence Service
Version 3.0
=====================================================
*/

require_once __DIR__ . "/../config/config.php";
require_once __DIR__ . "/../functions/http.php";
require_once __DIR__ . "/../functions/normalize.php";


/*
=====================================================
SEARCH GNEWS
=====================================================
*/

function searchGNews(
    string $keyword,
    int $maxResults = MAX_RESULTS_PER_SOURCE,
    ?string $requestApiKey = null
) {

    /*
    ---------------------------------------------
    Validate keyword
    ---------------------------------------------
    */

    $keyword = trim($keyword);

    if ($keyword === "") {

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" => "Keyword is required."
        ];
    }


    /*
    ---------------------------------------------
    Check API key
    ---------------------------------------------
    */

    $apiKey = apiKeyValue("GNEWS_API_KEY", $requestApiKey);
    if ($apiKey === "") {

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" => "GNews API key is not configured."
        ];
    }


    /*
    ---------------------------------------------
    Limit results
    ---------------------------------------------
    */

    $maxResults = max(
        1,
        min(
            $maxResults,
            100
        )
    );


    /*
    ---------------------------------------------
    GNews API
    ---------------------------------------------
    */

    $url =
        "https://gnews.io/api/v4/search"
        . "?q="
        . rawurlencode($keyword)
        . "&lang=en"
        . "&max="
        . $maxResults
        . "&sortby=publishedAt"
        . "&apikey="
        . rawurlencode(
            $apiKey
        );


    /*
    ---------------------------------------------
    Request
    ---------------------------------------------
    */

    $response = httpGet(
        $url
    );


    /*
    ---------------------------------------------
    HTTP failure
    ---------------------------------------------
    */

    if (
        !$response["success"]
    ) {

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" =>
                $response["error"]
                ?? "GNews request failed.",
            "status" =>
                $response["status"]
                ?? 0
        ];
    }


    /*
    ---------------------------------------------
    Decode response
    ---------------------------------------------
    */

    $data =
        httpJson(
            $response
        );


    if (
        !is_array($data)
    ) {

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" =>
                "Invalid GNews API response."
        ];
    }


    /*
    ---------------------------------------------
    GNews API errors
    ---------------------------------------------
    */

    if (
        isset(
            $data["errors"]
        )
    ) {

        $errorMessage =
            is_array(
                $data["errors"]
            )
                ? implode(
                    ", ",
                    $data["errors"]
                )
                : (string)
                    $data["errors"];

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" =>
                $errorMessage
                ?: "GNews API error.",
            "status" =>
                $response["status"]
                ?? 0
        ];
    }


    /*
    ---------------------------------------------
    Normalize articles
    ---------------------------------------------
    */

    $items =
        normalizeGNewsResponse(
            $data
        );


    /*
    ---------------------------------------------
    Return normalized intelligence
    ---------------------------------------------
    */

    return [

        "success" => true,

        "items" => $items,

        "total" => count($items),

        "keyword" => $keyword,

        "source" => SOURCE_GNEWS

    ];
}


/*
=====================================================
GET GNEWS INTELLIGENCE
=====================================================
*/

function getGNewsIntelligence(
    string $keyword,
    int $maxResults = MAX_RESULTS_PER_SOURCE,
    ?string $requestApiKey = null
) {

    return searchGNews(
        $keyword,
        $maxResults,
        $requestApiKey
    );
}