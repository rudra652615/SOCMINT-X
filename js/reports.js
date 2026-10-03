/*
=====================================================
SOCMINT-X
Reports Controller
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

        initializeReportsPage();

    }
);


/*
=====================================================
PAGE INITIALIZATION
=====================================================
*/

function initializeReportsPage() {

    const generateButton =
        document.getElementById(
            "generateReportButton"
        );

    const keywordInput =
        document.getElementById(
            "reportKeywordInput"
        );


    if (generateButton) {

        generateButton.addEventListener(
            "click",
            generateReport
        );

    }


    if (keywordInput) {

        keywordInput.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {

                    generateReport();

                }

            }
        );

    }


    const copyButton =
        document.getElementById(
            "copyReportButton"
        );


    if (copyButton) {

        copyButton.addEventListener(
            "click",
            copyReport
        );

    }


    const clearButton =
        document.getElementById(
            "clearReportButton"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearReport
        );

    }
}


/*
=====================================================
GENERATE REPORT
=====================================================
*/

async function generateReport() {

    const input =
        document.getElementById(
            "reportKeywordInput"
        );

    const button =
        document.getElementById(
            "generateReportButton"
        );


    if (!input) {

        return;

    }


    const keyword =
        input.value.trim();


    if (!keyword) {

        setReportStatus(
            "Enter a keyword first."
        );

        input.focus();

        return;

    }


    if (
        !window.SOCMINT_API ||
        !window.SOCMINT_API.runAnalysis
    ) {

        setReportStatus(
            "SOCMINT API is unavailable."
        );

        return;

    }


    setReportLoading(
        true
    );


    setReportStatus(
        "Collecting intelligence..."
    );


    try {

        /*
        -----------------------------------------
        STEP 1
        Collect current intelligence
        -----------------------------------------
        */

        const analysis =
            await window.SOCMINT_API.runAnalysis(
                keyword
            );


        if (
            !analysis ||
            analysis.success !== true
        ) {

            throw new Error(
                analysis?.message
                ||
                "Unable to collect intelligence."
            );

        }


        const data =
            analysis.data
            || {};


        /*
        -----------------------------------------
        STEP 2
        Generate report from REAL data
        -----------------------------------------
        */

        const report =
            await generateReportFromData(
                keyword,
                data
            );


        if (
            !report ||
            report.success !== true
        ) {

            throw new Error(
                report?.message
                ||
                "Unable to generate report."
            );

        }


        /*
        -----------------------------------------
        STEP 3
        Display report
        -----------------------------------------
        */

        displayReport(
            report.data
        );


        setReportStatus(
            "Intelligence report generated."
        );


    } catch (error) {

        console.error(
            "Report generation error:",
            error
        );


        setReportStatus(
            "Report generation failed: "
            + error.message
        );


    } finally {

        setReportLoading(
            false
        );

    }
}


/*
=====================================================
GENERATE REPORT FROM DATA
=====================================================
*/

async function generateReportFromData(
    keyword,
    data
) {

    /*
    The backend endpoint is responsible
    for calling the configured AI provider.

    This keeps API keys outside JavaScript.
    */


    const response =
        await fetch(
            "backend/api/report.php",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        keyword:
                            keyword,

                        data:
                            data

                    })

            }
        );


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "Invalid response from report service."
        );

    }


    return json;
}


/*
=====================================================
DISPLAY REPORT
=====================================================
*/

function displayReport(
    data
) {

    const reportContainer =
        document.getElementById(
            "reportContent"
        );


    if (!reportContainer) {

        return;

    }


    let reportText =
        "";


    /*
    -----------------------------------------
    Accept multiple backend formats
    -----------------------------------------
    */

    if (
        typeof data === "string"
    ) {

        reportText =
            data;

    }

    else if (
        data &&
        typeof data.report === "string"
    ) {

        reportText =
            data.report;

    }

    else if (
        data &&
        typeof data.text === "string"
    ) {

        reportText =
            data.text;

    }

    else if (
        data &&
        typeof data.content === "string"
    ) {

        reportText =
            data.content;

    }


    if (!reportText) {

        reportContainer.textContent =
            "No report content was returned.";

        return;

    }


    /*
    -----------------------------------------
    Basic Markdown-style rendering
    -----------------------------------------
    */

    reportContainer.innerHTML =
        formatReport(
            reportText
        );


    /*
    -----------------------------------------
    Metadata
    -----------------------------------------
    */

    if (
        data &&
        typeof data === "object"
    ) {

        setText(
            "reportKeyword",
            data.keyword
            || "-"
        );


        setText(
            "reportGenerated",
            data.generated_at
            || new Date().toLocaleString()
        );

    }

}


/*
=====================================================
FORMAT REPORT
=====================================================
*/

function formatReport(
    text
) {

    const safe =
        escapeHTML(
            text
        );


    return safe

        .replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        )

        .replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        )

        .replace(
            /^# (.*)$/gm,
            "<h1>$1</h1>"
        )

        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        )

        .replace(
            /\n\n/g,
            "</p><p>"
        )

        .replace(
            /\n/g,
            "<br>"
        );


}


/*
=====================================================
COPY REPORT
=====================================================
*/

async function copyReport() {

    const container =
        document.getElementById(
            "reportContent"
        );


    if (!container) {

        return;

    }


    const text =
        container.innerText.trim();


    if (!text) {

        setReportStatus(
            "There is no report to copy."
        );

        return;

    }


    try {

        await navigator.clipboard.writeText(
            text
        );


        setReportStatus(
            "Report copied to clipboard."
        );


    } catch (error) {

        console.error(
            error
        );


        setReportStatus(
            "Unable to copy report."
        );

    }
}


/*
=====================================================
CLEAR REPORT
=====================================================
*/

function clearReport() {

    const container =
        document.getElementById(
            "reportContent"
        );


    if (container) {

        container.innerHTML = `

            <div class="report-empty">

                <i class="fa-solid fa-file-circle-question"></i>

                <h3>No report generated</h3>

                <p>
                    Run an investigation to generate
                    an intelligence report.
                </p>

            </div>

        `;

    }


    setText(
        "reportKeyword",
        "-"
    );


    setText(
        "reportGenerated",
        "-"
    );


    setReportStatus(
        "Report cleared."
    );
}


/*
=====================================================
LOADING STATE
=====================================================
*/

function setReportLoading(
    loading
) {

    const button =
        document.getElementById(
            "generateReportButton"
        );


    if (!button) {

        return;

    }


    button.disabled =
        loading;


    if (loading) {

        button.innerHTML = `

            <i class="fa-solid fa-spinner fa-spin"></i>

            GENERATING

        `;

    } else {

        button.innerHTML = `

            <i class="fa-solid fa-file-lines"></i>

            GENERATE REPORT

        `;

    }
}


/*
=====================================================
STATUS
=====================================================
*/

function setReportStatus(
    message
) {

    const element =
        document.getElementById(
            "reportStatus"
        );


    if (element) {

        element.textContent =
            message;

    }
}


/*
=====================================================
TEXT HELPER
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