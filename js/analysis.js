/*
=====================================================
SOCMINT-X
Analysis Controller
Version 3.0
=====================================================
*/

"use strict";


/*
=====================================================
INITIALIZE
=====================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAnalysisPage();

    }
);


/*
=====================================================
PAGE INITIALIZATION
=====================================================
*/

function initializeAnalysisPage() {

    const searchButton =
        document.getElementById(
            "analysisSearchButton"
        );

    const searchInput =
        document.getElementById(
            "analysisSearchInput"
        );


    if (
        !searchButton ||
        !searchInput
    ) {

        return;

    }


    searchButton.addEventListener(
        "click",
        runAnalysisPage
    );


    searchInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                runAnalysisPage();

            }

        }
    );
}


/*
=====================================================
RUN ANALYSIS
=====================================================
*/

async function runAnalysisPage() {

    const input =
        document.getElementById(
            "analysisSearchInput"
        );

    const button =
        document.getElementById(
            "analysisSearchButton"
        );


    if (
        !input ||
        !button
    ) {

        return;

    }


    const keyword =
        input.value.trim();


    if (!keyword) {

        showAnalysisMessage(
            "Enter a keyword to investigate."
        );

        input.focus();

        return;

    }


    setAnalysisLoading(
        true
    );


    showAnalysisMessage(
        "Collecting intelligence..."
    );


    try {

        if (
            !window.SOCMINT_API ||
            !window.SOCMINT_API.runAnalysis
        ) {

            throw new Error(
                "SOCMINT API is unavailable."
            );

        }


        const response =
            await window.SOCMINT_API.runAnalysis(
                keyword
            );


        if (
            !response ||
            response.success !== true
        ) {

            throw new Error(
                response?.message
                ||
                "Analysis failed."
            );

        }


        const data =
            response.data
            || {};


        renderAnalysis(
            data
        );


        showAnalysisMessage(
            "Analysis completed successfully."
        );


    } catch (error) {

        console.error(
            "Analysis page error:",
            error
        );


        showAnalysisMessage(
            "Analysis failed: "
            + error.message
        );


    } finally {

        setAnalysisLoading(
            false
        );

    }
}


/*
=====================================================
RENDER ANALYSIS
=====================================================
*/

function renderAnalysis(
    data
) {

    const items =
        Array.isArray(data.items)
            ? data.items
            : [];


    const sentiment =
        data.sentiment
        || {};


    /*
    ---------------------------------------------
    Keyword
    ---------------------------------------------
    */

    setText(
        "analysisKeyword",
        data.keyword || "-"
    );


    /*
    ---------------------------------------------
    Total
    ---------------------------------------------
    */

    setText(
        "analysisTotal",
        data.total ?? items.length
    );


    /*
    ---------------------------------------------
    Positive
    ---------------------------------------------
    */

    setText(
        "analysisPositive",
        (
            Number(
                sentiment.positive || 0
            )
            + "%"
        )
    );


    /*
    ---------------------------------------------
    Negative
    ---------------------------------------------
    */

    setText(
        "analysisNegative",
        (
            Number(
                sentiment.negative || 0
            )
            + "%"
        )
    );


    /*
    ---------------------------------------------
    Analyzed
    ---------------------------------------------
    */

    setText(
        "analysisProcessed",
        sentiment.analyzed || 0
    );


    /*
    ---------------------------------------------
    Results table
    ---------------------------------------------
    */

    renderResultsTable(
        items
    );


    /*
    ---------------------------------------------
    Source statistics
    ---------------------------------------------
    */

    renderSourceStatistics(
        data.sources
    );
}


/*
=====================================================
RESULT TABLE
=====================================================
*/

function renderResultsTable(
    items
) {

    const container =
        document.getElementById(
            "analysisResults"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        container.innerHTML = `

            <div class="analysis-empty">

                <i class="fa-solid fa-database"></i>

                <h3>No intelligence data</h3>

                <p>
                    No results were returned
                    for this investigation.
                </p>

            </div>

        `;

        return;

    }


    items.forEach(
        (item) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "analysis-result";


            const source =
                escapeHTML(
                    item.source
                    || "Unknown"
                );


            const title =
                escapeHTML(
                    item.title
                    || "Untitled"
                );


            const description =
                escapeHTML(
                    item.description
                    || ""
                );


            const sentiment =
                String(
                    item.sentiment
                    || "UNAVAILABLE"
                ).toUpperCase();


            const confidence =
                Number(
                    item.confidence || 0
                );


            let sentimentClass =
                "neutral";


            if (
                sentiment === "POSITIVE"
            ) {

                sentimentClass =
                    "positive";

            }


            if (
                sentiment === "NEGATIVE"
            ) {

                sentimentClass =
                    "negative";

            }


            row.innerHTML = `

                <div class="analysis-result-header">

                    <span class="analysis-source">
                        ${source}
                    </span>

                    <span class="analysis-sentiment ${sentimentClass}">
                        ${sentiment}
                    </span>

                </div>


                <h3>
                    ${title}
                </h3>


                ${
                    description
                        ? `
                            <p>
                                ${description}
                            </p>
                          `
                        : ""
                }


                ${
                    confidence > 0
                        ? `
                            <small>
                                Sentiment confidence:
                                ${confidence}%
                            </small>
                          `
                        : ""
                }

            `;


            container.appendChild(
                row
            );

        }
    );
}


/*
=====================================================
SOURCE STATISTICS
=====================================================
*/

function renderSourceStatistics(
    sources
) {

    const container =
        document.getElementById(
            "sourceStatistics"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!sources) {

        return;

    }


    const sourceList = [];


    if (
        sources.youtube
    ) {

        sourceList.push({

            name: "YouTube",

            count:
                Number(
                    sources.youtube.count || 0
                ),

            available:
                sources.youtube.available === true

        });

    }


    if (
        sources.gnews
    ) {

        sourceList.push({

            name: "GNews",

            count:
                Number(
                    sources.gnews.count || 0
                ),

            available:
                sources.gnews.available === true

        });

    }


    sourceList.forEach(
        (source) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "source-stat";


            element.innerHTML = `

                <div>

                    <strong>
                        ${escapeHTML(source.name)}
                    </strong>

                    <span>
                        ${
                            source.available
                                ? "Available"
                                : "Unavailable"
                        }
                    </span>

                </div>

                <b>
                    ${source.count}
                </b>

            `;


            container.appendChild(
                element
            );

        }
    );
}


/*
=====================================================
LOADING STATE
=====================================================
*/

function setAnalysisLoading(
    loading
) {

    const button =
        document.getElementById(
            "analysisSearchButton"
        );


    if (!button) {

        return;

    }


    button.disabled =
        loading;


    if (loading) {

        button.innerHTML = `

            <i class="fa-solid fa-spinner fa-spin"></i>

            ANALYZING

        `;

    } else {

        button.innerHTML = `

            <i class="fa-solid fa-magnifying-glass-chart"></i>

            ANALYZE

        `;

    }
}


/*
=====================================================
MESSAGE
=====================================================
*/

function showAnalysisMessage(
    message
) {

    const element =
        document.getElementById(
            "analysisMessage"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message;
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


    if (element) {

        element.textContent =
            value;

    }
}


/*
=====================================================
HTML ESCAPE
=====================================================
*/

function escapeHTML(
    value
) {

    return String(value)

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