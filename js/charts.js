/*
=====================================================
SOCMINT-X
charts.js
Version 3.0
=====================================================
*/

"use strict";

let sentimentChart = null;
let trendChart = null;


/*
=====================================================
INITIALIZE
=====================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createSentimentChart();

        createTrendChart();

    }
);


/*
=====================================================
SENTIMENT CHART
=====================================================

Only:

POSITIVE
NEGATIVE
=====================================================
*/

function createSentimentChart() {

    const canvas =
        document.getElementById(
            "sentimentChart"
        );


    if (!canvas) {
        return;
    }


    sentimentChart =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: [

                        "Positive",

                        "Negative"

                    ],

                    datasets: [

                        {

                            data: [
                                0,
                                0
                            ],

                            backgroundColor: [

                                "#22C55E",

                                "#FF5C7A"

                            ],

                            borderWidth: 0,

                            hoverOffset: 18

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "72%",

                    plugins: {

                        legend: {

                            position: "bottom",

                            labels: {

                                color: "#D7E8FF",

                                padding: 20,

                                font: {

                                    size: 13,

                                    weight: "600"

                                }

                            }

                        }

                    },

                    animation: {

                        animateRotate: true,

                        duration: 1000

                    }

                }

            }
        );

}


/*
=====================================================
TREND CHART
=====================================================
*/

function createTrendChart() {

    const canvas =
        document.getElementById(
            "trendChart"
        );


    if (!canvas) {
        return;
    }


    trendChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: [

                        "Source 1",

                        "Source 2",

                        "Source 3",

                        "Source 4",

                        "Source 5",

                        "Source 6",

                        "Source 7"

                    ],

                    datasets: [

                        {

                            label: "Mentions",

                            data: [

                                0,
                                0,
                                0,
                                0,
                                0,
                                0,
                                0

                            ],

                            borderColor:
                                "#00E5FF",

                            backgroundColor:
                                "rgba(0,229,255,.15)",

                            fill: true,

                            tension: 0.45,

                            pointRadius: 5,

                            pointHoverRadius: 8,

                            pointBackgroundColor:
                                "#00E5FF"

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {

                            display: false

                        }

                    },

                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#9FB4D8"

                            },

                            grid: {

                                color:
                                    "rgba(255,255,255,.05)"

                            }

                        },

                        y: {

                            beginAtZero: true,

                            ticks: {

                                color:
                                    "#9FB4D8"

                            },

                            grid: {

                                color:
                                    "rgba(255,255,255,.05)"

                            }

                        }

                    },

                    animation: {

                        duration: 1000

                    }

                }

            }
        );

}


/*
=====================================================
UPDATE SENTIMENT
=====================================================
*/

window.updateCharts = function (

    positive,

    negative,

    trendData = []

) {

    /*
    ---------------------------------------------
    Normalize values
    ---------------------------------------------
    */

    positive =
        Number(positive) || 0;

    negative =
        Number(negative) || 0;


    /*
    ---------------------------------------------
    Update doughnut
    ---------------------------------------------
    */

    if (
        sentimentChart
    ) {

        sentimentChart.data.datasets[0].data = [

            positive,

            negative

        ];


        sentimentChart.update();

    }


    /*
    ---------------------------------------------
    Update trend
    ---------------------------------------------
    */

    if (
        trendChart
    ) {

        let values;


        if (
            Array.isArray(
                trendData
            ) &&
            trendData.length > 0
        ) {

            values =
                trendData
                    .map(
                        value =>
                            Number(value) || 0
                    )
                    .slice(
                        0,
                        7
                    );

        } else {

            /*
            Use real source counts instead
            of generating fake random data.
            */

            values = [

                positive,

                negative

            ];

        }


        while (
            values.length < 7
        ) {

            values.push(0);

        }


        trendChart.data.datasets[0].data =
            values;


        trendChart.update();

    }

};


/*
=====================================================
UPDATE TREND WITH REAL SOURCE DATA
=====================================================
*/

window.updateTrendChart = function (
    labels,
    values
) {

    if (
        !trendChart
    ) {

        return;

    }


    if (
        !Array.isArray(labels) ||
        !Array.isArray(values)
    ) {

        return;

    }


    trendChart.data.labels =
        labels;


    trendChart.data.datasets[0].data =
        values.map(
            value =>
                Number(value) || 0
        );


    trendChart.update();

};