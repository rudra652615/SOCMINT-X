<?php

/*
=====================================================
SOCMINT-X
HTTP Client
Version 3.0
=====================================================
*/

require_once __DIR__ . "/../config/config.php";


/*
=====================================================
GET REQUEST
=====================================================
*/

function httpGet(
    string $url,
    array $headers = [],
    int $timeout = REQUEST_TIMEOUT
) {

    $curl = curl_init();

    $defaultHeaders = [
        "Accept: application/json",
        "User-Agent: " . APP_USER_AGENT
    ];

    $headers = array_merge(
        $defaultHeaders,
        $headers
    );

    curl_setopt_array(
        $curl,
        [
            CURLOPT_URL => $url,

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_FOLLOWLOCATION => true,

            CURLOPT_MAXREDIRS => 5,

            CURLOPT_CONNECTTIMEOUT => 10,

            CURLOPT_TIMEOUT => $timeout,

            CURLOPT_HTTPHEADER => $headers,

            CURLOPT_SSL_VERIFYPEER => APP_ENV === "production",

            CURLOPT_SSL_VERIFYHOST => APP_ENV === "production" ? 2 : 0
        ]
    );

    $body = curl_exec($curl);

    $error = curl_error($curl);

    $errno = curl_errno($curl);

    $statusCode = curl_getinfo(
        $curl,
        CURLINFO_HTTP_CODE
    );

    curl_close($curl);

    if (
        $errno !== 0
        || $body === false
    ) {

        return [
            "success" => false,
            "status" => $statusCode,
            "body" => null,
            "json" => null,
            "error" => $error ?: "HTTP request failed."
        ];
    }

    $json = json_decode(
        $body,
        true
    );

    return [
        "success" => (
            $statusCode >= 200
            && $statusCode < 300
        ),

        "status" => $statusCode,

        "body" => $body,

        "json" => (
            json_last_error() === JSON_ERROR_NONE
                ? $json
                : null
        ),

        "error" => (
            $statusCode >= 200
            && $statusCode < 300
                ? null
                : "HTTP request returned status "
                    . $statusCode
        )
    ];
}


/*
=====================================================
POST JSON REQUEST
=====================================================
*/

function httpPostJson(
    string $url,
    array $data = [],
    array $headers = [],
    int $timeout = REQUEST_TIMEOUT
) {

    $curl = curl_init();

    $defaultHeaders = [
        "Accept: application/json",
        "Content-Type: application/json",
        "User-Agent: " . APP_USER_AGENT
    ];

    $headers = array_merge(
        $defaultHeaders,
        $headers
    );

    $payload = json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
    );

    if ($payload === false) {

        return [
            "success" => false,
            "status" => 0,
            "body" => null,
            "json" => null,
            "error" => "Unable to encode request data."
        ];
    }

    curl_setopt_array(
        $curl,
        [
            CURLOPT_URL => $url,

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_FOLLOWLOCATION => true,

            CURLOPT_MAXREDIRS => 5,

            CURLOPT_CONNECTTIMEOUT => 10,

            CURLOPT_TIMEOUT => $timeout,

            CURLOPT_POST => true,

            CURLOPT_POSTFIELDS => $payload,

            CURLOPT_HTTPHEADER => $headers,

            CURLOPT_SSL_VERIFYPEER => APP_ENV === "production",

            CURLOPT_SSL_VERIFYHOST => APP_ENV === "production" ? 2 : 0
        ]
    );

    $body = curl_exec($curl);

    $error = curl_error($curl);

    $errno = curl_errno($curl);

    $statusCode = curl_getinfo(
        $curl,
        CURLINFO_HTTP_CODE
    );

    curl_close($curl);

    if (
        $errno !== 0
        || $body === false
    ) {

        return [
            "success" => false,
            "status" => $statusCode,
            "body" => null,
            "json" => null,
            "error" => $error ?: "HTTP request failed."
        ];
    }

    $json = json_decode(
        $body,
        true
    );

    return [
        "success" => (
            $statusCode >= 200
            && $statusCode < 300
        ),

        "status" => $statusCode,

        "body" => $body,

        "json" => (
            json_last_error() === JSON_ERROR_NONE
                ? $json
                : null
        ),

        "error" => (
            $statusCode >= 200
            && $statusCode < 300
                ? null
                : "HTTP request returned status "
                    . $statusCode
        )
    ];
}


/*
=====================================================
POST FORM REQUEST
=====================================================
*/

function httpPostForm(
    string $url,
    array $data = [],
    array $headers = [],
    int $timeout = REQUEST_TIMEOUT
) {

    $curl = curl_init();

    $defaultHeaders = [
        "Accept: application/json",
        "User-Agent: " . APP_USER_AGENT
    ];

    $headers = array_merge(
        $defaultHeaders,
        $headers
    );

    curl_setopt_array(
        $curl,
        [
            CURLOPT_URL => $url,

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_FOLLOWLOCATION => true,

            CURLOPT_MAXREDIRS => 5,

            CURLOPT_CONNECTTIMEOUT => 10,

            CURLOPT_TIMEOUT => $timeout,

            CURLOPT_POST => true,

            CURLOPT_POSTFIELDS => http_build_query(
                $data
            ),

            CURLOPT_HTTPHEADER => $headers,

            CURLOPT_SSL_VERIFYPEER => APP_ENV === "production",

            CURLOPT_SSL_VERIFYHOST => APP_ENV === "production" ? 2 : 0
        ]
    );

    $body = curl_exec($curl);

    $error = curl_error($curl);

    $errno = curl_errno($curl);

    $statusCode = curl_getinfo(
        $curl,
        CURLINFO_HTTP_CODE
    );

    curl_close($curl);

    if (
        $errno !== 0
        || $body === false
    ) {

        return [
            "success" => false,
            "status" => $statusCode,
            "body" => null,
            "json" => null,
            "error" => $error ?: "HTTP request failed."
        ];
    }

    $json = json_decode(
        $body,
        true
    );

    return [
        "success" => (
            $statusCode >= 200
            && $statusCode < 300
        ),

        "status" => $statusCode,

        "body" => $body,

        "json" => (
            json_last_error() === JSON_ERROR_NONE
                ? $json
                : null
        ),

        "error" => (
            $statusCode >= 200
            && $statusCode < 300
                ? null
                : "HTTP request returned status "
                    . $statusCode
        )
    ];
}


/*
=====================================================
EXTRACT JSON
=====================================================
*/

function httpJson(
    array $response
) {

    if (
        !isset($response["json"])
        || !is_array($response["json"])
    ) {

        return null;
    }

    return $response["json"];
}


/*
=====================================================
CHECK HTTP SUCCESS
=====================================================
*/

function httpSuccess(
    array $response
) {

    return (
        isset($response["success"])
        && $response["success"] === true
    );
}


/*
=====================================================
POST JSON REQUEST ALIAS
=====================================================
*/

function httpPost(
    string $url,
    array $data = [],
    array $headers = [],
    int $timeout = REQUEST_TIMEOUT
) {

    return httpPostJson(
        $url,
        $data,
        $headers,
        $timeout
    );
}
