<?php

/*
=====================================================
SOCMINT-X
Hugging Face Sentiment Intelligence Service
Version 3.0

REAL DATA ONLY
Positive / Negative
=====================================================
*/

require_once __DIR__ . "/../config/config.php";
require_once __DIR__ . "/../functions/http.php";


/*
=====================================================
ANALYZE SINGLE TEXT
=====================================================
*/

function analyzeSentimentText(
    string $text,
    ?string $requestApiKey = null
) {

    $text = trim($text);

    if ($text === "") {

        return [
            "success" => false,
            "label" => null,
            "confidence" => 0,
            "error" => "Empty text."
        ];
    }


    /*
    ---------------------------------------------
    Check Hugging Face API key
    ---------------------------------------------
    */

    $apiKey = apiKeyValue("HUGGINGFACE_API_KEY", $requestApiKey);
    if ($apiKey === "") {

        return [
            "success" => false,
            "label" => null,
            "confidence" => 0,
            "error" =>
                "Hugging Face API key is not configured."
        ];
    }


    /*
    ---------------------------------------------
    Hugging Face model
    ---------------------------------------------
    */

    $url =
        "https://router.huggingface.co/hf-inference/models/"
        . "distilbert/distilbert-base-uncased-finetuned-sst-2-english";


    /*
    ---------------------------------------------
    Request headers
    ---------------------------------------------
    */

    $headers = [

        "Authorization: Bearer "
        . $apiKey,

        "Content-Type: application/json",

        "Accept: application/json"

    ];


    /*
    ---------------------------------------------
    Request body
    ---------------------------------------------
    */

    $body = [

        "inputs" => $text

    ];


    /*
    ---------------------------------------------
    Send request
    ---------------------------------------------
    */

    $response = httpPost(
        $url,
        $body,
        $headers
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

            "label" => null,

            "confidence" => 0,

            "error" =>
                $response["error"]
                ?? "Sentiment request failed.",

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

            "label" => null,

            "confidence" => 0,

            "error" =>
                "Invalid Hugging Face response."

        ];
    }


    /*
    ---------------------------------------------
    Handle model loading response
    ---------------------------------------------
    */

    if (
        isset(
            $data["error"]
        )
    ) {

        return [

            "success" => false,

            "label" => null,

            "confidence" => 0,

            "error" =>
                $data["error"],

            "status" =>
                $response["status"]
                ?? 0

        ];
    }


    /*
    ---------------------------------------------
    Hugging Face response can be:

    [
        [
            {
                "label": "POSITIVE",
                "score": 0.99
            },
            {
                "label": "NEGATIVE",
                "score": 0.01
            }
        ]
    ]
    ---------------------------------------------
    */

    if (
        isset($data[0])
        && is_array($data[0])
    ) {

        $predictions = $data[0];

    } else {

        $predictions = $data;
    }


    /*
    ---------------------------------------------
    Validate predictions
    ---------------------------------------------
    */

    if (
        !is_array($predictions)
        || empty($predictions)
    ) {

        return [

            "success" => false,

            "label" => null,

            "confidence" => 0,

            "error" =>
                "No sentiment prediction returned."

        ];
    }


    /*
    ---------------------------------------------
    Find highest-confidence prediction
    ---------------------------------------------
    */

    $best = null;

    foreach (
        $predictions
        as $prediction
    ) {

        if (
            !is_array($prediction)
        ) {
            continue;
        }

        if (
            !isset(
                $prediction["label"],
                $prediction["score"]
            )
        ) {
            continue;
        }

        if (
            $best === null
            || (float)
                $prediction["score"]
                >
                (float)
                    $best["score"]
        ) {

            $best = $prediction;
        }
    }


    if (
        $best === null
    ) {

        return [

            "success" => false,

            "label" => null,

            "confidence" => 0,

            "error" =>
                "Unable to determine sentiment."

        ];
    }


    /*
    ---------------------------------------------
    Normalize label
    ---------------------------------------------
    */

    $label =
        strtoupper(
            trim(
                $best["label"]
            )
        );


    /*
    ---------------------------------------------
    Only Positive / Negative allowed
    ---------------------------------------------
    */

    if (
        $label !== "POSITIVE"
        && $label !== "NEGATIVE"
    ) {

        return [

            "success" => false,

            "label" => null,

            "confidence" => 0,

            "error" =>
                "Unsupported sentiment label."

        ];
    }


    /*
    ---------------------------------------------
    Return result
    ---------------------------------------------
    */

    return [

        "success" => true,

        "label" => $label,

        "confidence" =>
            round(
                ((float)
                    $best["score"])
                * 100,
                2
            ),

        "text" => $text

    ];
}


/*
=====================================================
ANALYZE MULTIPLE TEXTS
=====================================================
*/

function analyzeSentimentBatch(
    array $texts,
    ?string $requestApiKey = null
) {

    $results = [];

    $positive = 0;

    $negative = 0;

    $failed = 0;


    foreach (
        $texts
        as $index => $text
    ) {

        if (
            !is_string($text)
        ) {

            $text =
                (string) $text;
        }

        $result =
            analyzeSentimentText(
                $text,
                $requestApiKey
            );


        /*
        -----------------------------------------
        Successful prediction
        -----------------------------------------
        */

        if (
            $result["success"]
        ) {

            if (
                $result["label"]
                === "POSITIVE"
            ) {

                $positive++;

            } else {

                $negative++;
            }

            $results[] = [

                "index" => $index,

                "text" => $text,

                "label" =>
                    $result["label"],

                "confidence" =>
                    $result["confidence"]

            ];

        }

        /*
        -----------------------------------------
        Failed prediction
        -----------------------------------------
        */

        else {

            $failed++;

            $results[] = [

                "index" => $index,

                "text" => $text,

                "label" => null,

                "confidence" => 0,

                "error" =>
                    $result["error"]
                    ?? "Analysis failed."

            ];
        }
    }


    /*
    ---------------------------------------------
    Calculate percentages ONLY from successful
    predictions.
    ---------------------------------------------
    */

    $analyzed =
        $positive
        + $negative;


    if (
        $analyzed > 0
    ) {

        $positivePercent =
            round(
                ($positive / $analyzed)
                * 100
            );

        $negativePercent =
            100
            - $positivePercent;

    } else {

        $positivePercent = 0;

        $negativePercent = 0;
    }


    return [

        "success" =>
            $analyzed > 0,

        "summary" => [

            "positive" =>
                $positivePercent,

            "negative" =>
                $negativePercent,

            "analyzed" =>
                $analyzed,

            "failed" =>
                $failed

        ],

        "results" => $results

    ];
}