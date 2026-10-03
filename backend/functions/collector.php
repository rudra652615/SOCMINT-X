<?php

/*
=====================================================
SOCMINT-X
Collector / HTTP Request Functions
Version 3.0
=====================================================
*/

declare(strict_types=1);


/*
=====================================================
JSON INPUT
=====================================================
*/

function getJsonInput(): array
{
    $raw = file_get_contents("php://input");

    if ($raw === false || trim($raw) === "") {
        return [];
    }

    $decoded = json_decode(
        $raw,
        true
    );

    if (!is_array($decoded)) {
        return [];
    }

    return $decoded;
}


/*
=====================================================
JSON RESPONSE
=====================================================
*/

function sendResponse(
    bool $success,
    array $data = [],
    string $message = ""
): void {

    http_response_code(
        $success ? 200 : 400
    );

    header(
        "Content-Type: application/json; charset=UTF-8"
    );

    echo json_encode(
        [
            "success" => $success,
            "message" => $message,
            "data" => $data
        ],
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


/*
=====================================================
CURL GET
=====================================================
*/

function curlGET(
    string $url,
    array $headers = [],
    int $timeout = 30
): array|false {

    $curl = curl_init();

    if ($curl === false) {
        return false;
    }


    $defaultHeaders = [

        "Accept: application/json",

        "User-Agent: SOCMINT-X/3.0"

    ];


    $headers =
        array_merge(
            $defaultHeaders,
            $headers
        );


    curl_setopt_array(
        $curl,
        [

            CURLOPT_URL =>
                $url,

            CURLOPT_RETURNTRANSFER =>
                true,

            CURLOPT_FOLLOWLOCATION =>
                true,

            CURLOPT_MAXREDIRS =>
                5,

            CURLOPT_CONNECTTIMEOUT =>
                10,

            CURLOPT_TIMEOUT =>
                $timeout,

            CURLOPT_HTTPHEADER =>
                $headers,

            CURLOPT_SSL_VERIFYPEER =>
                false,

            CURLOPT_SSL_VERIFYHOST =>
                0

        ]
    );


    $response =
        curl_exec(
            $curl
        );


    if (
        $response === false
    ) {

        error_log(
            "SOCMINT-X CURL GET error: "
            . curl_error($curl)
        );

        curl_close(
            $curl
        );

        return false;
    }


    $httpCode =
        curl_getinfo(
            $curl,
            CURLINFO_HTTP_CODE
        );


    curl_close(
        $curl
    );


    if (
        $httpCode < 200 ||
        $httpCode >= 300
    ) {

        error_log(
            "SOCMINT-X GET HTTP error: "
            . $httpCode
        );

        return false;
    }


    $decoded =
        json_decode(
            $response,
            true
        );


    if (
        !is_array($decoded)
    ) {

        return false;
    }


    return $decoded;
}


/*
=====================================================
CURL POST
=====================================================
*/

function curlPOST(
    string $url,
    array $data = [],
    array $headers = [],
    int $timeout = 60
): array|false {

    $curl = curl_init();

    if ($curl === false) {
        return false;
    }


    $defaultHeaders = [

        "Accept: application/json",

        "Content-Type: application/json",

        "User-Agent: SOCMINT-X/3.0"

    ];


    $headers =
        array_merge(
            $defaultHeaders,
            $headers
        );


    $payload =
        json_encode(
            $data,
            JSON_UNESCAPED_SLASHES |
            JSON_UNESCAPED_UNICODE
        );


    if (
        $payload === false
    ) {

        curl_close(
            $curl
        );

        return false;
    }


    curl_setopt_array(
        $curl,
        [

            CURLOPT_URL =>
                $url,

            CURLOPT_POST =>
                true,

            CURLOPT_POSTFIELDS =>
                $payload,

            CURLOPT_RETURNTRANSFER =>
                true,

            CURLOPT_FOLLOWLOCATION =>
                true,

            CURLOPT_MAXREDIRS =>
                5,

            CURLOPT_CONNECTTIMEOUT =>
                10,

            CURLOPT_TIMEOUT =>
                $timeout,

            CURLOPT_HTTPHEADER =>
                $headers,

            CURLOPT_SSL_VERIFYPEER =>
                false,

            CURLOPT_SSL_VERIFYHOST =>
                0

        ]
    );


    $response =
        curl_exec(
            $curl
        );


    if (
        $response === false
    ) {

        error_log(
            "SOCMINT-X CURL POST error: "
            . curl_error($curl)
        );

        curl_close(
            $curl
        );

        return false;
    }


    $httpCode =
        curl_getinfo(
            $curl,
            CURLINFO_HTTP_CODE
        );


    curl_close(
        $curl
    );


    /*
    ---------------------------------------------
    Do not immediately reject non-2xx responses.

    Hugging Face, for example, can return useful
    JSON error information that the caller needs.
    ---------------------------------------------
    */

    $decoded =
        json_decode(
            $response,
            true
        );


    if (
        !is_array($decoded)
    ) {

        error_log(
            "SOCMINT-X invalid JSON POST response. HTTP: "
            . $httpCode
        );

        return false;
    }


    /*
    ---------------------------------------------
    Preserve API error responses for the caller.
    ---------------------------------------------
    */

    if (
        $httpCode < 200 ||
        $httpCode >= 300
    ) {

        error_log(
            "SOCMINT-X POST HTTP error: "
            . $httpCode
            . " Response: "
            . json_encode($decoded)
        );

        return $decoded;
    }


    return $decoded;
}


/*
=====================================================
CURL POST RAW
=====================================================

Useful for APIs where the body needs to be sent
without converting an already-created payload.
=====================================================
*/

function curlPOSTRaw(
    string $url,
    string $payload,
    array $headers = [],
    int $timeout = 60
): array|false {

    $curl = curl_init();

    if ($curl === false) {
        return false;
    }


    $defaultHeaders = [

        "Accept: application/json",

        "Content-Type: application/json",

        "User-Agent: SOCMINT-X/3.0"

    ];


    $headers =
        array_merge(
            $defaultHeaders,
            $headers
        );


    curl_setopt_array(
        $curl,
        [

            CURLOPT_URL =>
                $url,

            CURLOPT_POST =>
                true,

            CURLOPT_POSTFIELDS =>
                $payload,

            CURLOPT_RETURNTRANSFER =>
                true,

            CURLOPT_FOLLOWLOCATION =>
                true,

            CURLOPT_MAXREDIRS =>
                5,

            CURLOPT_CONNECTTIMEOUT =>
                10,

            CURLOPT_TIMEOUT =>
                $timeout,

            CURLOPT_HTTPHEADER =>
                $headers,

            CURLOPT_SSL_VERIFYPEER =>
                true,

            CURLOPT_SSL_VERIFYHOST =>
                2

        ]
    );


    $response =
        curl_exec(
            $curl
        );


    if (
        $response === false
    ) {

        error_log(
            "SOCMINT-X CURL RAW POST error: "
            . curl_error($curl)
        );

        curl_close(
            $curl
        );

        return false;
    }


    curl_close(
        $curl
    );


    $decoded =
        json_decode(
            $response,
            true
        );


    if (
        !is_array($decoded)
    ) {

        return false;
    }


    return $decoded;
}
