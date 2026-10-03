/*
=====================================================
SOCMINT-X
dashboard.js
Version 3.0
=====================================================
*/

"use strict";


document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeClock();

        initializeCursorGlow();

        initializeSearch();

        initializeSidebar();

        initializeWorldMap();

    }
);


/*
=====================================================
LIVE CLOCK
=====================================================
*/

function initializeClock() {

    const clock =
        document.getElementById(
            "clock"
        );


    if (!clock) {
        return;
    }


    function updateClock() {

        const now =
            new Date();


        clock.textContent =
            now.toLocaleTimeString();

    }


    updateClock();

    setInterval(
        updateClock,
        1000
    );

}


/*
=====================================================
CURSOR GLOW
=====================================================
*/

function initializeCursorGlow() {

    const glow =
        document.querySelector(
            ".cursor-light"
        );


    if (!glow) {
        return;
    }


    document.addEventListener(
        "mousemove",
        event => {

            glow.style.left =
                event.clientX + "px";

            glow.style.top =
                event.clientY + "px";

        }
    );

}


/*
=====================================================
SEARCH
=====================================================
*/

function initializeSearch() {

    const button =
        document.getElementById(
            "searchButton"
        );


    const input =
        document.getElementById(
            "searchInput"
        );


    if (
        !button ||
        !input
    ) {

        return;

    }


    button.addEventListener(
        "click",
        performAnalysis
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                performAnalysis();

            }

        }
    );

}


/*
=====================================================
MAIN ANALYSIS
=====================================================
*/

async function performAnalysis() {

    const input =
        document.getElementById(
            "searchInput"
        );


    const button =
        document.getElementById(
            "searchButton"
        );


    if (!input) {
        return;
    }


    const keyword =
        input.value.trim();


    if (!keyword) {

        alert(
            "Enter a keyword."
        );

        return;

    }


    /*
    ---------------------------------------------
    UI: scanning
    ---------------------------------------------
    */

    if (button) {

        button.disabled =
            true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Scanning';

    }


    setSummary(
        "Collecting intelligence..."
    );


    clearFeed();


    try {

        /*
        -----------------------------------------
        Run complete analysis
        -----------------------------------------
        */

        const analysis =
            await window.runAnalysis(
                keyword
            );


        if (
            !analysis ||
            !analysis.success
        ) {

            throw new Error(

                analysis?.message
                ||
                "Analysis failed."

            );

        }


        const data =
            analysis.data;


        /*
        -----------------------------------------
        Update dashboard
        -----------------------------------------
        */

        updateDashboard(
            data
        );


        /*
        -----------------------------------------
        Generate AI report
        -----------------------------------------
        */

        setSummary(
            "Generating intelligence report..."
        );


        const report =
            await window.generateAIReport({

                keyword:
                    keyword,

                posts:
                    data.posts || [],

                data:
                    data

            });


        if (
            report &&
            report.success
        ) {

            const reportText =
                extractReportText(
                    report
                );


            if (reportText) {

                typeSummary(
                    reportText
                );

            } else {

                setSummary(
                    "Analysis completed successfully."
                );

            }

        } else {

            setSummary(
                "Analysis completed. AI report unavailable."
            );

        }

    } catch (error) {

        console.error(
            "SOCMINT-X analysis error:",
            error
        );


        setSummary(
            "Analysis failed: "
            + error.message
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.innerHTML =
                '<i class="fa-solid fa-bolt"></i> Start Scan';

        }

    }

}


/*
=====================================================
UPDATE DASHBOARD
=====================================================
*/

function updateDashboard(
    data
) {

    const keyword =
        data.keyword || "-";


    const items =
        Array.isArray(
            data.items
        )
            ? data.items
            : [];


    const sentiment =
        data.sentiment || {};


    const positive =
        Number(
            sentiment.positive
            || 0
        );


    const negative =
        Number(
            sentiment.negative
            || 0
        );


    const total =
        Number(
            data.total
            || items.length
            || 0
        );


    /*
    ---------------------------------------------
    Source information
    ---------------------------------------------
    */

    const youtubeCount =
        Number(
            data.sources?.youtube?.count
            || 0
        );


    const gnewsCount =
        Number(
            data.sources?.gnews?.count
            || 0
        );


    /*
    ---------------------------------------------
    Counters
    ---------------------------------------------
    */

    setText(
        "mentionCount",
        total
    );


    setText(
        "positiveCount",
        positive + "%"
    );


    setText(
        "negativeCount",
        negative + "%"
    );


    setText(
        "sourceCount",
        countAvailableSources(
            data.sources
        )
    );


    /*
    ---------------------------------------------
    Investigation summary
    ---------------------------------------------
    */

    setText(
        "keywordResult",
        keyword
    );


    setText(
        "sourceResult",
        buildSourceText(
            data.sources
        )
    );


    setText(
        "mentionResult",
        total
    );


    setText(
        "topSourceResult",
        getTopSource(
            youtubeCount,
            gnewsCount
        )
    );


    setText(
        "updateResult",
        new Date().toLocaleString()
    );


    /*
    ---------------------------------------------
    Threat level
    ---------------------------------------------
    */

    const threat =
        calculateThreatLevel(
            negative,
            total
        );


    setText(
        "riskResult",
        threat
    );


    /*
    ---------------------------------------------
    Feed
    ---------------------------------------------
    */

    updateFeed(
        items
    );


    /*
    ---------------------------------------------
    Sentiment chart
    ---------------------------------------------
    */

    if (
        window.updateCharts
    ) {

        window.updateCharts(

            positive,

            negative,

            [
                youtubeCount,
                gnewsCount

            ]

        );

    }


    /*
    ---------------------------------------------
    Real trend data
    ---------------------------------------------
    */

    if (
        window.updateTrendChart
    ) {

        window.updateTrendChart(

            [
                "YouTube",
                "GNews"
            ],

            [
                youtubeCount,
                gnewsCount
            ]

        );

    }


    /*
    ---------------------------------------------
    Initial summary
    ---------------------------------------------
    */

    setSummary(
        buildAnalysisSummary(
            keyword,
            total,
            positive,
            negative
        )
    );

}


/*
=====================================================
SOURCE COUNT
=====================================================
*/

function countAvailableSources(
    sources
) {

    if (!sources) {
        return 0;
    }


    let count = 0;


    if (
        sources.youtube?.available
    ) {

        count++;

    }


    if (
        sources.gnews?.available
    ) {

        count++;

    }


    return count;

}


/*
=====================================================
SOURCE TEXT
=====================================================
*/

function buildSourceText(
    sources
) {

    const names = [];


    if (
        sources?.youtube?.available
    ) {

        names.push(
            "YouTube"
        );

    }


    if (
        sources?.gnews?.available
    ) {

        names.push(
            "GNews"
        );

    }


    return names.length
        ? names.join(", ")
        : "None";

}


/*
=====================================================
TOP SOURCE
=====================================================
*/

function getTopSource(
    youtube,
    gnews
) {

    if (
        youtube === 0 &&
        gnews === 0
    ) {

        return "-";

    }


    if (
        youtube >= gnews
    ) {

        return "YouTube";

    }


    return "GNews";

}


/*
=====================================================
THREAT LEVEL
=====================================================

This is a simple dashboard indicator.

It is NOT a substitute for a professional
threat-assessment methodology.
=====================================================
*/

function calculateThreatLevel(
    negativePercentage,
    total
) {

    if (
        total <= 0
    ) {

        return "LOW";

    }


    if (
        negativePercentage >= 70
    ) {

        return "HIGH";

    }


    if (
        negativePercentage >= 40
    ) {

        return "MEDIUM";

    }


    return "LOW";

}


/*
=====================================================
ANALYSIS SUMMARY
=====================================================
*/

function buildAnalysisSummary(
    keyword,
    total,
    positive,
    negative
) {

    if (
        total === 0
    ) {

        return (
            `No public intelligence was found for "${keyword}".`
        );

    }


    return (

        `Analysis completed for "${keyword}". ` +

        `${total} public items were collected. ` +

        `Sentiment: ${positive}% positive ` +

        `and ${negative}% negative.`

    );

}


/*
=====================================================
LIVE FEED
=====================================================
*/

function updateFeed(
    items
) {

    const container =
        document.getElementById(
            "postsContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        container.innerHTML = `

            <div class="feed-item">

                <i class="fa-solid fa-circle-info"></i>

                <div>

                    <h4>
                        No Results Found
                    </h4>

                    <p>
                        No intelligence sources returned data.
                    </p>

                    <small>
                        Just Now
                    </small>

                </div>

            </div>

        `;

        return;

    }


    items
        .slice(0, 15)
        .forEach(
            item => {

                const source =
                    item.source
                    || "Unknown";


                const sentiment =
                    item.sentiment
                    || "UNAVAILABLE";


                const confidence =
                    Number(
                        item.confidence
                        || 0
                    );


                const icon =
                    source === "YouTube"

                        ? "fa-brands fa-youtube"

                        : "fa-solid fa-newspaper";


                const sentimentClass =
                    sentiment === "POSITIVE"

                        ? "positive"

                        : sentiment === "NEGATIVE"

                            ? "negative"

                            : "neutral";


                const feedItem =
                    document.createElement(
                        "div"
                    );


                feedItem.className =
                    "feed-item";


                feedItem.innerHTML = `

                    <i class="${icon}"></i>

                    <div>

                        <h4>
                            ${escapeHTML(source)}
                        </h4>

                        <p>
                            ${escapeHTML(
                                item.title
                                || "Untitled"
                            )}
                        </p>

                        <small>

                            <span class="${sentimentClass}">
                                ${escapeHTML(
                                    sentiment
                                )}
                            </span>

                            ${confidence > 0
                                ? " • "
                                + confidence
                                + "% confidence"
                                : ""
                            }

                        </small>

                    </div>

                `;


                /*
                ---------------------------------
                Make result clickable
                ---------------------------------
                */

                if (
                    item.url
                ) {

                    feedItem.style.cursor =
                        "pointer";


                    feedItem.addEventListener(
                        "click",
                        () => {

                            window.open(
                                item.url,
                                "_blank",
                                "noopener,noreferrer"
                            );

                        }
                    );

                }


                container.appendChild(
                    feedItem
                );

            }
        );

}


/*
=====================================================
CLEAR FEED
=====================================================
*/

function clearFeed() {

    const container =
        document.getElementById(
            "postsContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="feed-item">

            <i class="fa-solid fa-spinner fa-spin"></i>

            <div>

                <h4>
                    Scanning Sources
                </h4>

                <p>
                    Collecting public intelligence...
                </p>

            </div>

        </div>

    `;

}


/*
=====================================================
AI SUMMARY
=====================================================
*/

function setSummary(
    text
) {

    const box =
        document.getElementById(
            "summaryText"
        );


    if (!box) {
        return;
    }


    box.textContent =
        text;

}


/*
=====================================================
TYPE SUMMARY
=====================================================
*/

function typeSummary(
    text
) {

    const box =
        document.getElementById(
            "summaryText"
        );


    if (!box) {
        return;
    }


    box.textContent =
        "";


    let index =
        0;


    const timer =
        setInterval(
            () => {

                box.textContent +=
                    text.charAt(
                        index
                    );


                index++;


                if (
                    index >=
                    text.length
                ) {

                    clearInterval(
                        timer
                    );

                }

            },
            12
        );

}


/*
=====================================================
REPORT TEXT EXTRACTION
=====================================================
*/

function extractReportText(
    report
) {

    const data =
        report?.data;


    if (
        typeof data === "string"
    ) {

        return data;

    }


    if (
        typeof data?.report === "string"
    ) {

        return data.report;

    }


    if (
        typeof data?.text === "string"
    ) {

        return data.text;

    }


    if (
        typeof report?.message === "string" &&
        report.message.length > 30
    ) {

        return report.message;

    }


    return "";

}


/*
=====================================================
SAFE TEXT
=====================================================
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/*
=====================================================
HTML ESCAPE
=====================================================
*/

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/*
=====================================================
SIDEBAR
=====================================================
*/

function initializeSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (!sidebar) {
        return;
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key.toLowerCase()
                === "m"
            ) {

                sidebar.classList.toggle(
                    "active"
                );

            }

        }
    );

}


/*
=====================================================
WORLD MAP
=====================================================
*/

function initializeWorldMap() {

    document
        .querySelectorAll(
            ".node"
        )
        .forEach(
            node => {

                node.addEventListener(
                    "mouseenter",
                    () => {

                        node.style.transform =
                            "scale(1.8)";

                    }
                );


                node.addEventListener(
                    "mouseleave",
                    () => {

                        node.style.transform =
                            "scale(1)";

                    }
                );

            }
        );

}