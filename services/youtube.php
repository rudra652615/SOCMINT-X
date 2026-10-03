<?php

/*
=====================================================
SOCMINT-X
YouTube Intelligence Service
Version 3.0
=====================================================
*/

require_once __DIR__ . "/../config/config.php";
require_once __DIR__ . "/../functions/http.php";
require_once __DIR__ . "/../functions/normalize.php";


/*
=====================================================
SEARCH YOUTUBE
=====================================================
*/

function searchYouTube(
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

    $apiKey = apiKeyValue("YOUTUBE_API_KEY", $requestApiKey);
    if ($apiKey === "") {

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" => "YouTube API key is not configured."
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
            50
        )
    );


    /*
    ---------------------------------------------
    YouTube API
    ---------------------------------------------
    */

    $url =
        "https://www.googleapis.com/youtube/v3/search"
        . "?part=snippet"
        . "&type=video"
        . "&order=relevance"
        . "&maxResults="
        . $maxResults
        . "&q="
        . rawurlencode($keyword)
        . "&key="
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
                ?? "YouTube request failed.",
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
                "Invalid YouTube API response."
        ];
    }


    /*
    ---------------------------------------------
    YouTube API errors
    ---------------------------------------------
    */

    if (
        isset(
            $data["error"]
        )
    ) {

        $message =
            $data["error"]["message"]
            ?? "YouTube API error.";

        return [
            "success" => false,
            "items" => [],
            "total" => 0,
            "error" => $message,
            "status" =>
                $response["status"]
                ?? 0
        ];
    }


    /*
    ---------------------------------------------
    Normalize results
    ---------------------------------------------
    */

    $items =
        normalizeYouTubeResponse(
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

        "source" => SOURCE_YOUTUBE

    ];
}


/*
=====================================================
GET YOUTUBE DATA
=====================================================
*/

function getYouTubeIntelligence(
    string $keyword,
    int $maxResults = MAX_RESULTS_PER_SOURCE,
    ?string $requestApiKey = null
) {

    return searchYouTube(
        $keyword,
        $maxResults,
        $requestApiKey
    );
}