<?php

/*
=====================================================
SOCMINT-X
Data Normalization Layer
Version 3.0
=====================================================

Converts different API response formats into one
standard SOCMINT-X intelligence format.
=====================================================
*/

require_once __DIR__ . "/../config/config.php";


/*
=====================================================
NORMALIZE YOUTUBE VIDEO
=====================================================
*/

function normalizeYouTubeVideo(
    array $video
) {

    $snippet = $video["snippet"] ?? [];
    $id = $video["id"] ?? [];

    if (is_array($id)) {
        $videoId = $id["videoId"] ?? "";
    } else {
        $videoId = $id;
    }

    return [

        "source" => SOURCE_YOUTUBE,

        "type" => "video",

        "id" => (string) $videoId,

        "title" => trim(
            $snippet["title"] ?? ""
        ),

        "description" => trim(
            strip_tags(
                $snippet["description"] ?? ""
            )
        ),

        "author" => trim(
            $snippet["channelTitle"] ?? ""
        ),

        "published_at" =>
            $snippet["publishedAt"] ?? null,

        "url" => $videoId !== ""
            ? "https://www.youtube.com/watch?v="
                . rawurlencode($videoId)
            : "",

        "image" =>
            $snippet["thumbnails"]["high"]["url"]
            ?? $snippet["thumbnails"]["medium"]["url"]
            ?? $snippet["thumbnails"]["default"]["url"]
            ?? "",

        "sentiment" => null,

        "sentiment_confidence" => null

    ];
}


/*
=====================================================
NORMALIZE YOUTUBE RESPONSE
=====================================================
*/

function normalizeYouTubeResponse(
    array $response
) {

    $items = $response["items"] ?? [];

    if (!is_array($items)) {
        $items = [];
    }

    $results = [];

    foreach ($items as $item) {

        if (!is_array($item)) {
            continue;
        }

        $normalized =
            normalizeYouTubeVideo(
                $item
            );

        if (
            $normalized["title"] === ""
            && $normalized["id"] === ""
        ) {
            continue;
        }

        $results[] = $normalized;
    }

    return $results;
}


/*
=====================================================
NORMALIZE GNEWS ARTICLE
=====================================================
*/

function normalizeGNewsArticle(
    array $article
) {

    $source = $article["source"] ?? [];

    return [

        "source" => SOURCE_GNEWS,

        "type" => "article",

        "id" => sha1(
            ($article["url"] ?? "")
            . ($article["title"] ?? "")
        ),

        "title" => trim(
            $article["title"] ?? ""
        ),

        "description" => trim(
            strip_tags(
                $article["description"] ?? ""
            )
        ),

        "author" => trim(
            $article["author"] ?? ""
        ),

        "published_at" =>
            $article["publishedAt"] ?? null,

        "url" => trim(
            $article["url"] ?? ""
        ),

        "image" => trim(
            $article["image"] ?? ""
        ),

        "source_name" => trim(
            $source["name"] ?? ""
        ),

        "sentiment" => null,

        "sentiment_confidence" => null

    ];
}


/*
=====================================================
NORMALIZE GNEWS RESPONSE
=====================================================
*/

function normalizeGNewsResponse(
    array $response
) {

    $articles =
        $response["articles"] ?? [];

    if (!is_array($articles)) {
        $articles = [];
    }

    $results = [];

    foreach ($articles as $article) {

        if (!is_array($article)) {
            continue;
        }

        $normalized =
            normalizeGNewsArticle(
                $article
            );

        if (
            $normalized["title"] === ""
        ) {
            continue;
        }

        $results[] = $normalized;
    }

    return $results;
}


/*
=====================================================
COMBINE INTELLIGENCE
=====================================================
*/

function combineIntelligence(
    array $youtube,
    array $news
) {

    $combined = array_merge(
        $youtube,
        $news
    );

    usort(
        $combined,
        function (
            $a,
            $b
        ) {

            $dateA =
                strtotime(
                    $a["published_at"] ?? ""
                ) ?: 0;

            $dateB =
                strtotime(
                    $b["published_at"] ?? ""
                ) ?: 0;

            if ($dateA === 0) {
                return $dateB === 0 ? 0 : 1;
            }

            if ($dateB === 0) {
                return -1;
            }

            return $dateB <=> $dateA;
        }
    );

    return $combined;
}


/*
=====================================================
EXTRACT TEXT FOR SENTIMENT
=====================================================
*/

function extractSentimentTexts(
    array $items
) {

    $texts = [];

    foreach ($items as $item) {

        if (!is_array($item)) {
            continue;
        }

        $title =
            trim(
                $item["title"] ?? ""
            );

        $description =
            trim(
                $item["description"] ?? ""
            );

        /*
        Title is the primary signal.
        Description is appended when available.
        */

        if (
            $title === ""
            && $description === ""
        ) {
            continue;
        }

        $text = $title;

        if ($description !== "") {

            $text .= " "
                . $description;
        }

        $texts[] = $text;
    }

    return $texts;
}


/*
=====================================================
ATTACH SENTIMENT
=====================================================
*/

function attachSentiment(
    array $items,
    array $sentiments
) {

    $sentimentIndex = 0;

    foreach (
        $items
        as &$item
    ) {

        if (
            !isset(
                $sentiments[$sentimentIndex]
            )
        ) {
            break;
        }

        $sentiment =
            $sentiments[
                $sentimentIndex
            ];

        $item["sentiment"] =
            $sentiment["label"]
            ?? null;

        $item["sentiment_confidence"] =
            $sentiment["confidence"]
            ?? null;

        $sentimentIndex++;
    }

    unset($item);

    return $items;
}


/*
=====================================================
CALCULATE SOURCE COUNTS
=====================================================
*/

function calculateSourceCounts(
    array $items
) {

    $counts = [];

    foreach ($items as $item) {

        $source =
            $item["source"]
            ?? "Unknown";

        if (
            !isset(
                $counts[$source]
            )
        ) {

            $counts[$source] = 0;
        }

        $counts[$source]++;
    }

    return $counts;
}


/*
=====================================================
CALCULATE SENTIMENT COUNTS
=====================================================
*/

function calculateSentimentCounts(
    array $items
) {

    $positive = 0;
    $negative = 0;

    foreach ($items as $item) {

        $label =
            strtoupper(
                $item["sentiment"]
                ?? ""
            );

        if (
            $label === SENTIMENT_POSITIVE
        ) {

            $positive++;
        }

        elseif (
            $label === SENTIMENT_NEGATIVE
        ) {

            $negative++;
        }
    }

    $total =
        $positive
        + $negative;

    if ($total === 0) {

        return [

            "positive" => 0,

            "negative" => 0,

            "analyzed" => 0

        ];
    }

    return [

        "positive" =>
            round(
                ($positive / $total)
                * 100
            ),

        "negative" =>
            round(
                ($negative / $total)
                * 100
            ),

        "analyzed" => $total

    ];
}


/*
=====================================================
BUILD INTELLIGENCE SUMMARY
=====================================================
*/

function buildIntelligenceSummary(
    array $items
) {

    return [

        "total" => count($items),

        "sources" =>
            calculateSourceCounts(
                $items
            ),

        "sentiment" =>
            calculateSentimentCounts(
                $items
            )

    ];
}