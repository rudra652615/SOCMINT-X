/*
=====================================================
SOCMINT-X
API Handler
Version 3.0
=====================================================
*/

"use strict";


/*
=====================================================
API CONFIGURATION
=====================================================
*/

const SOCMINT_API_BASE =
    "backend/api";


/*
=====================================================
GENERIC REQUEST
=====================================================
*/

async function apiRequest(
    endpoint,
    options = {}
) {

    const config = {

        method:
            options.method || "POST",

        headers: {

            "Content-Type":
                "application/json",

            ...(options.headers || {})

        },

        ...options

    };


    /*
    ---------------------------------------------
    Make request
    ---------------------------------------------
    */

    const response =
        await fetch(
            `${SOCMINT_API_BASE}/${endpoint}`,
            config
        );


    /*
    ---------------------------------------------
    Parse JSON
    ---------------------------------------------
    */

    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Invalid JSON response from ${endpoint}`
        );

    }


    /*
    ---------------------------------------------
    HTTP error
    ---------------------------------------------
    */

    if (!response.ok) {

        throw new Error(

            data?.message
            ||
            `HTTP ${response.status}`

        );

    }


    return data;
}


/*
=====================================================
YOUTUBE
=====================================================
*/

async function fetchYoutube(
    keyword
) {

    if (!keyword) {

        return {

            success: false,

            data: {
                videos: []
            },

            message:
                "Keyword is required."

        };

    }


    try {

        return await apiRequest(
            "youtube.php",
            {

                method: "POST",

                body:
                    JSON.stringify({

                        keyword:
                            keyword

                    })

            }
        );

    } catch (error) {

        console.error(
            "YouTube API error:",
            error
        );


        return {

            success: false,

            data: {
                videos: []
            },

            message:
                error.message

        };

    }
}


/*
=====================================================
GNEWS
=====================================================
*/

async function fetchTrends(
    keyword
) {

    if (!keyword) {

        return {

            success: false,

            data: {
                articles: []
            },

            message:
                "Keyword is required."

        };

    }


    try {

        return await apiRequest(
            "trends.php",
            {

                method: "POST",

                body:
                    JSON.stringify({

                        keyword:
                            keyword

                    })

            }
        );

    } catch (error) {

        console.error(
            "GNews API error:",
            error
        );


        return {

            success: false,

            data: {
                articles: []
            },

            message:
                error.message

        };

    }
}


/*
=====================================================
REAL SENTIMENT
=====================================================

Uses the backend Hugging Face integration.

The API key NEVER appears in this file.
=====================================================
*/

async function analyzeSentiment(
    posts
) {

    if (
        !Array.isArray(posts) ||
        posts.length === 0
    ) {

        return {

            success: false,

            data: {
                summary: {
                    positive: 0,
                    negative: 0
                },

                results: []
            },

            message:
                "No posts supplied."

        };

    }


    try {

        return await apiRequest(
            "sentiment.php",
            {

                method: "POST",

                body:
                    JSON.stringify({

                        posts:
                            posts

                    })

            }
        );

    } catch (error) {

        console.error(
            "Sentiment API error:",
            error
        );


        return {

            success: false,

            data: {

                summary: {

                    positive: 0,

                    negative: 0

                },

                results: []

            },

            message:
                error.message

        };

    }
}


/*
=====================================================
AI REPORT
=====================================================
*/

async function generateAIReport(
    payload
) {

    if (
        !payload ||
        !payload.keyword
    ) {

        return {

            success: false,

            data: {},

            message:
                "Keyword is required."

        };

    }


    try {

        return await apiRequest(
            "report.php",
            {

                method: "POST",

                body:
                    JSON.stringify({

                        keyword:
                            payload.keyword,

                        data:
                            payload.data
                            || {},

                        posts:
                            Array.isArray(
                                payload.posts
                            )
                                ? payload.posts
                                : []

                    })

            }
        );

    } catch (error) {

        console.error(
            "AI report API error:",
            error
        );


        return {

            success: false,

            data: {},

            message:
                error.message

        };

    }
}


/*
=====================================================
FULL ANALYSIS
=====================================================

Collects:

1. YouTube
2. GNews
3. Sentiment

All data comes from the backend.
=====================================================
*/

async function runAnalysis(
    keyword
) {

    if (!keyword) {

        return {

            success: false,

            data: {},

            message:
                "Keyword is required."

        };

    }


    try {

        /*
        -----------------------------------------
        Collect sources
        -----------------------------------------
        */

        const [

            youtube,

            gnews

        ] = await Promise.all([

            fetchYoutube(
                keyword
            ),

            fetchTrends(
                keyword
            )

        ]);


        /*
        -----------------------------------------
        Normalize YouTube
        -----------------------------------------
        */

        const youtubeItems =
            youtube?.success &&
            Array.isArray(
                youtube?.data?.videos
            )
                ? youtube.data.videos.map(
                    video => ({

                        source:
                            "YouTube",

                        title:
                            video.title
                            || "",

                        description:
                            video.description
                            || "",

                        published:
                            video.published
                            || "",

                        url:
                            video.videoId
                                ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`
                                : "",

                        image:
                            video.thumbnail
                            || ""

                    })
                )
                : [];


        /*
        -----------------------------------------
        Normalize GNews
        -----------------------------------------
        */

        const newsItems =
            gnews?.success &&
            Array.isArray(
                gnews?.data?.articles
            )
                ? gnews.data.articles.map(
                    article => ({

                        source:
                            "GNews",

                        title:
                            article.title
                            || "",

                        description:
                            article.description
                            || "",

                        published:
                            article.published
                            || "",

                        url:
                            article.url
                            || "",

                        image:
                            article.image
                            || ""

                    })
                )
                : [];


        /*
        -----------------------------------------
        Combine real results
        -----------------------------------------
        */

        const items = [

            ...youtubeItems,

            ...newsItems

        ];


        /*
        -----------------------------------------
        Extract text for sentiment
        -----------------------------------------
        */

        const posts =
            items
                .map(
                    item =>
                        item.title
                )
                .filter(
                    title =>
                        title &&
                        title.trim()
                );


        /*
        -----------------------------------------
        Run real sentiment
        -----------------------------------------
        */

        let sentiment = {

            success: false,

            data: {

                summary: {

                    positive: 0,

                    negative: 0

                },

                results: []

            }

        };


        if (
            posts.length > 0
        ) {

            sentiment =
                await analyzeSentiment(
                    posts
                );

        }


        /*
        -----------------------------------------
        Attach sentiment results
        -----------------------------------------
        */

        const sentimentResults =
            sentiment?.data?.results
            || [];


        const sentimentMap =
            new Map();


        sentimentResults.forEach(
            result => {

                sentimentMap.set(
                    result.text,
                    result
                );

            }
        );


        const analyzedItems =
            items.map(
                item => {

                    const result =
                        sentimentMap.get(
                            item.title
                        );


                    return {

                        ...item,

                        sentiment:
                            result?.label
                            || "UNAVAILABLE",

                        confidence:
                            Number(
                                result?.confidence
                                || 0
                            )

                    };

                }
            );


        /*
        -----------------------------------------
        Source counts
        -----------------------------------------
        */

        const sourceData = {

            youtube: {

                count:
                    youtubeItems.length,

                available:
                    youtube?.success === true

            },

            gnews: {

                count:
                    newsItems.length,

                available:
                    gnews?.success === true

            }

        };


        /*
        -----------------------------------------
        Final analysis object
        -----------------------------------------
        */

        return {

            success: true,

            message:
                "Analysis completed.",

            data: {

                keyword:
                    keyword,

                total:
                    analyzedItems.length,

                items:
                    analyzedItems,

                posts:
                    posts,

                sentiment:
                    {

                        positive:
                            Number(
                                sentiment?.data?.summary?.positive
                                || 0
                            ),

                        negative:
                            Number(
                                sentiment?.data?.summary?.negative
                                || 0
                            ),

                        analyzed:
                            sentimentResults.length

                    },

                sources:
                    sourceData,

                generated_at:
                    new Date().toISOString()

            }

        };

    } catch (error) {

        console.error(
            "Full analysis error:",
            error
        );


        return {

            success: false,

            data: {},

            message:
                error.message
                ||
                "Analysis failed."

        };

    }
}


/*
=====================================================
GLOBAL API OBJECT
=====================================================
*/

window.SOCMINT_API = {

    request:
        apiRequest,

    youtube:
        fetchYoutube,

    trends:
        fetchTrends,

    sentiment:
        analyzeSentiment,

    report:
        generateAIReport,

    runAnalysis:
        runAnalysis

};


/*
=====================================================
BACKWARD COMPATIBILITY
=====================================================

Existing dashboard.js can continue using:

fetchYoutube()
fetchTrends()
analyzeSentiment()
generateAIReport()
=====================================================
*/

window.fetchYoutube =
    fetchYoutube;

window.fetchTrends =
    fetchTrends;

window.analyzeSentiment =
    analyzeSentiment;

window.generateAIReport =
    generateAIReport;

window.runAnalysis =
    runAnalysis;