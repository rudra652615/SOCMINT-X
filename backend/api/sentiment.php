<?php

/*
=====================================================
SOCMINT-X
Real Sentiment Analysis
Hugging Face
Version 3.0
=====================================================
*/

declare(strict_types=1);

header(
    "Content-Type: application/json; charset=UTF-8"
);

require_once __DIR__ . "/../config/api_keys.php";
require_once __DIR__ . "/../functions/collector.php";


/*
=====================================================
INPUT
=====================================================
*/

$input =
    getJsonInput();


$posts =
    $input["posts"] ?? [];


if (
    !is_array($posts)
) {

    sendResponse(
        false,
        [],
        "Posts must be an array."
    );

}


/*
=====================================================
CLEAN INPUT
=====================================================
*/

$cleanPosts = [];


foreach (
    $posts as $post
) {

    if (
        !is_string($post)
    ) {

        continue;

    }


    $post =
        trim(
            strip_tags(
                html_entity_decode(
                    $post,
                    ENT_QUOTES |
                    ENT_HTML5,
                    "UTF-8"
                )
            )
        );


    if (
        $post === ""
    ) {

        continue;

    }


    /*
    Avoid sending extremely large text
    to the sentiment model.
    */

    if (
        strlen($post) > 1000
    ) {

        $post =
            substr(
                $post,
                0,
                1000
            );

    }


    $cleanPosts[] =
        $post;
}


$cleanPosts =
    array_values(
        array_unique(
            $cleanPosts
        )
    );


if (
    count($cleanPosts) === 0
) {

    sendResponse(
        false,
        [],
        "No valid posts supplied."
    );

}


/*
=====================================================
HUGGING FACE KEY
=====================================================
*/

if (
    !defined("HUGGINGFACE_API_KEY") ||
    trim(
        HUGGINGFACE_API_KEY
    ) === ""
) {

    sendResponse(
        false,
        [],
        "Hugging Face API key not configured."
    );

}


/*
=====================================================
MODEL
=====================================================
*/

$model =
    "distilbert/distilbert-base-uncased-finetuned-sst-2-english";


$url =
    "https://router.huggingface.co/hf-inference/models/"
    . $model;


/*
=====================================================
HEADERS
=====================================================
*/

$headers = [

    "Authorization: Bearer "
    . trim(
        HUGGINGFACE_API_KEY
    ),

    "Content-Type: application/json",

    "Accept: application/json"

];


/*
=====================================================
COUNTERS
=====================================================
*/

$positive =
    0;

$negative =
    0;

$results =
    [];


/*
=====================================================
PROCESS POSTS
=====================================================
*/

foreach (
    $cleanPosts as $post
) {


    /*
    ---------------------------------------------
    Hugging Face request
    ---------------------------------------------
    */

    $response =
        curlPOST(
            $url,

            [
                "inputs" => $post
            ],

            $headers,

            60
        );


    /*
    ---------------------------------------------
    Request failed
    ---------------------------------------------
    */

    if (
        $response === false
    ) {

        continue;

    }


    /*
    ---------------------------------------------
    Hugging Face may return:

    [
        [
            [
                "label" => "NEGATIVE",
                "score" => 0.99
            ],
            [
                "label" => "POSITIVE",
                "score" => 0.01
            ]
        ]
    ]

    ---------------------------------------------
    */


    $prediction = null;


    if (
        isset(
            $response[0][0]
        ) &&
        is_array(
            $response[0][0]
        )
    ) {

        $prediction =
            $response[0];

    }


    /*
    Some responses can already be:

    [
        {"label":"POSITIVE","score":0.99},
        {"label":"NEGATIVE","score":0.01}
    ]
    */

    elseif (
        isset(
            $response[0]["label"]
        )
    ) {

        $prediction =
            $response;

    }


    /*
    ---------------------------------------------
    Invalid model response
    ---------------------------------------------
    */

    if (
        !is_array(
            $prediction
        ) ||
        count(
            $prediction
        ) === 0
    ) {

        continue;

    }


    /*
    ---------------------------------------------
    Find highest-confidence prediction
    ---------------------------------------------
    */

    $best =
        null;


    foreach (
        $prediction as $item
    ) {

        if (
            !is_array(
                $item
            )
        ) {

            continue;

        }


        if (
            !isset(
                $item["label"],
                $item["score"]
            )
        ) {

            continue;

        }


        $label =
            strtoupper(
                trim(
                    (string)
                    $item["label"]
                )
            );


        $score =
            (float)
            $item["score"];


        if (
            $best === null ||
            $score >
            $best["score"]
        ) {

            $best = [

                "label" =>
                    $label,

                "score" =>
                    $score

            ];

        }

    }


    if (
        $best === null
    ) {

        continue;

    }


    /*
    ---------------------------------------------
    Normalize label
    ---------------------------------------------
    */

    if (
        $best["label"] === "POSITIVE"
    ) {

        $label =
            "POSITIVE";

        $positive++;

    }

    elseif (
        $best["label"] === "NEGATIVE"
    ) {

        $label =
            "NEGATIVE";

        $negative++;

    }

    else {

        /*
        SST-2 should only return
        POSITIVE / NEGATIVE.

        Ignore unexpected labels.
        */

        continue;

    }


    /*
    ---------------------------------------------
    Confidence
    ---------------------------------------------
    */

    $confidence =
        round(
            max(
                0,
                min(
                    100,
                    $best["score"] * 100
                )
            ),
            2
        );


    /*
    ---------------------------------------------
    Store result
    ---------------------------------------------
    */

    $results[] = [

        "text" =>
            $post,

        "label" =>
            $label,

        "confidence" =>
            $confidence

    ];

}


/*
=====================================================
NO SUCCESSFUL PREDICTIONS
=====================================================
*/

$analyzed =
    count(
        $results
    );


if (
    $analyzed === 0
) {

    sendResponse(
        false,
        [

            "summary" => [

                "positive" =>
                    0,

                "negative" =>
                    0

            ],

            "analyzed" =>
                0,

            "results" =>
                []

        ],
        "Hugging Face returned no usable sentiment predictions."
    );

}


/*
=====================================================
PERCENTAGES
=====================================================
*/

$positivePercentage =
    round(
        (
            $positive /
            $analyzed
        ) * 100
    );


$negativePercentage =
    100 -
    $positivePercentage;


/*
=====================================================
FINAL RESPONSE
=====================================================
*/

sendResponse(

    true,

    [

        "summary" => [

            "positive" =>
                $positivePercentage,

            "negative" =>
                $negativePercentage

        ],

        "analyzed" =>
            $analyzed,

        "results" =>
            $results

    ],

    "Real Hugging Face sentiment analysis completed."

);