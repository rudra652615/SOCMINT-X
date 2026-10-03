"use strict";

const LATEST_SCAN_KEY = "socmint_latest_scan";
const SETTINGS_KEY = "socmint_settings";
let pageRefreshTimer = null;
let pageScanInProgress = false;

document.addEventListener("DOMContentLoaded", () => {
    initializePageClock();
    initializePageIcons();
    initializePageNavigation();
    initializeAnalysisForm();
    initializeReportActions();
    applyPagePreferences();
    renderCurrentPage(loadLatestScan());
    window.addEventListener("storage", event => {
        if (event.key === LATEST_SCAN_KEY) {
            renderCurrentPage(loadLatestScan());
        } else if (event.key === SETTINGS_KEY) {
            applyPagePreferences();
            initializePageAutoRefresh();
            renderCurrentPage(loadLatestScan());
        }
    });
    window.addEventListener("socmintSettingsChanged", () => {
        applyPagePreferences();
        initializePageAutoRefresh();
        renderCurrentPage(loadLatestScan());
    });
    initializePageAutoRefresh();
});

function initializePageClock() {
    const clock = document.getElementById("clock");
    const today = document.getElementById("todayLabel");
    if (!clock && !today) {
        return;
    }

    const tick = () => {
        const now = new Date();
        if (clock) {
            clock.textContent = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
        }
        if (today) {
            today.textContent = now.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric"
            });
        }
    };

    tick();
    window.setInterval(tick, 1000);
}

function initializePageIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function initializePageNavigation() {
    const currentPage = document.body.dataset.page;
    document.querySelectorAll(".nav-item").forEach(link => {
        const destination = new URL(link.href, window.location.href);
        const isCurrent = destination.pathname === window.location.pathname
            || (currentPage === "dashboard" && destination.pathname.endsWith("/index.html"));
        link.classList.toggle("active", isCurrent);
        if (isCurrent) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function initializeAnalysisForm() {
    const form = document.getElementById("pageSearchForm");
    const input = document.getElementById("pageSearchInput");
    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        runPageAnalysis(input.value);
    });

    document.querySelectorAll("[data-page-query]").forEach(button => {
        button.addEventListener("click", () => {
            input.value = button.dataset.pageQuery || "";
            runPageAnalysis(input.value);
        });
    });
}

function getPageSettings() {
    const defaults = {
        autoRefresh: false,
        notifications: false,
        liveFeed: true,
        sentimentAnalysis: true,
        reportExport: true,
        maxResults: 10,
        refreshInterval: 300,
        theme: "dark"
    };

    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Stored preferences are not an object.");
        }
        const reportExport = parsed.reportExport === undefined
            ? parsed.aiReports
            : parsed.reportExport;
        return {
            ...defaults,
            ...parsed,
            autoRefresh: parsed.autoRefresh === true,
            notifications: parsed.notifications === true,
            liveFeed: parsed.liveFeed !== false,
            sentimentAnalysis: parsed.sentimentAnalysis !== false,
            reportExport: reportExport !== false,
            maxResults: Math.max(1, Math.min(50, Math.trunc(Number(parsed.maxResults) || defaults.maxResults))),
            refreshInterval: Math.max(10, Math.min(3600, Math.trunc(Number(parsed.refreshInterval) || defaults.refreshInterval))),
            theme: parsed.theme === "light" ? "light" : "dark"
        };
    } catch (error) {
        console.error("Unable to load display preferences:", error);
        return defaults;
    }
}

function applyPagePreferences() {
    const settings = getPageSettings();
    document.documentElement.dataset.theme = settings.theme;
    document.body.classList.toggle("hide-sentiment", !settings.sentimentAnalysis);
    document.body.classList.toggle("hide-live-feed", !settings.liveFeed);
    const reportActions = document.querySelectorAll("#generatePageReport, #copyPageReport, #downloadPageReport");
    reportActions.forEach(button => {
        button.hidden = !settings.reportExport;
    });
    if (!settings.reportExport) {
        setPageMessage(
            document.getElementById("reportStatus"),
            "Report export is disabled in Settings.",
            ""
        );
    }
}

function initializePageAutoRefresh() {
    if (pageRefreshTimer !== null) {
        window.clearInterval(pageRefreshTimer);
    }
    const settings = getPageSettings();
    if (!settings.autoRefresh) {
        pageRefreshTimer = null;
        return;
    }
    pageRefreshTimer = window.setInterval(() => {
        if (pageScanInProgress) {
            return;
        }
        const latestScan = loadLatestScan();
        if (latestScan?.keyword) {
            runPageAnalysis(latestScan.keyword, { silent: true });
        }
    }, settings.refreshInterval * 1000);
}

async function runPageAnalysis(rawKeyword, options = {}) {
    const keyword = String(rawKeyword || "").trim();
    const input = document.getElementById("pageSearchInput");
    const button = document.getElementById("pageSearchButton");
    const status = document.getElementById("pageStatus");
    const settings = getPageSettings();

    if (!keyword) {
        if (!options.silent) {
            setPageMessage(status, "Enter a keyword to investigate.", "error");
        }
        input?.focus();
        return;
    }

    if (keyword.length > 200) {
        setPageMessage(status, "Keywords must be 200 characters or fewer.", "error");
        return;
    }

    pageScanInProgress = true;
    if (!options.silent) {
        setPageMessage(status, "Collecting public records from configured sources...", "");
    }
    setText("pageSystemStatus", "Scanning");
    if (button && !options.silent) {
        button.disabled = true;
        button.textContent = "Scanning…";
    }

    try {
        const response = await fetch("backend/api/analyze.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword,
                max_results: settings.maxResults,
                api_keys: window.getSOCMINTApiKeys()
            })
        });
        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error("The backend returned an invalid JSON response.");
        }

        const data = payload?.data && typeof payload.data === "object"
            ? payload.data
            : {};
        if (data.keyword) {
            data.generated_at = data.generated_at || new Date().toISOString();
            persistLatestScan(data);
            renderCurrentPage(data);
        }

        if (!response.ok || payload?.success !== true) {
            const message = payload?.message || "The investigation could not be completed.";
            if (!options.silent) {
                setPageMessage(status, message, "error");
            }
            setText("pageSystemStatus", "Limited");
            return;
        }

        if (!options.silent) {
            setPageMessage(status, `Investigation complete: ${Number(data.total || 0)} real records collected.`, "success");
        }
        setText("pageSystemStatus", "Online");
        sendPageNotification(data);
    } catch (error) {
        if (!options.silent) {
            setPageMessage(status, `Analysis failed: ${error.message}`, "error");
        }
        setText("pageSystemStatus", "Needs attention");
    } finally {
        pageScanInProgress = false;
        if (button && !options.silent) {
            button.disabled = false;
            button.innerHTML = '<i data-lucide="scan-search"></i><span>Start Scan</span>';
        }
        initializePageIcons();
    }
}

function sendPageNotification(data) {
    const settings = getPageSettings();
    if (
        !settings.notifications
        || !("Notification" in window)
        || Notification.permission !== "granted"
    ) {
        return;
    }

    try {
        new Notification("SOCMINT-X scan complete", {
            body: `${Number(data.total || 0)} real records returned for "${data.keyword}".`,
            tag: "socmint-scan-complete"
        });
    } catch (error) {
        console.error("Unable to show scan notification:", error);
    }
}

function persistLatestScan(data) {
    try {
        localStorage.setItem(LATEST_SCAN_KEY, JSON.stringify(data));
    } catch (error) {
        const status = document.getElementById("pageStatus");
        setPageMessage(
            status,
            `Scan finished, but this browser could not share the results with other pages: ${error.message}`,
            "error"
        );
    }
}

function loadLatestScan() {
    try {
        const stored = localStorage.getItem(LATEST_SCAN_KEY);
        if (!stored) {
            return null;
        }
        const data = JSON.parse(stored);
        return data && typeof data === "object" && Array.isArray(data.items) ? data : null;
    } catch (error) {
        setPageMessage(
            document.getElementById("pageStatus"),
            `Saved investigation data could not be read: ${error.message}`,
            "error"
        );
        return null;
    }
}

function renderCurrentPage(data) {
    const page = document.body.dataset.page;
    if (page === "dashboard") {
        renderDashboardPage(data);
    } else if (page === "analysis") {
        renderAnalysisPage(data);
    } else if (page === "analytics") {
        renderAnalyticsPage(data);
    } else if (page === "intelligence") {
        renderIntelligencePage(data);
    } else if (page === "reports") {
        renderReportPage(data);
    }
}

function renderDashboardPage(data) {
    if (!data) {
        return;
    }
    const sentiment = data.sentiment || {};
    setText("dashboardKeyword", data.keyword || "—");
    setText("dashboardWhen", formatDate(data.generated_at) || "Latest investigation");
    setText("dashboardTotal", Number(data.total || data.items.length));
    const analyzed = Number(sentiment.analyzed || 0);
    setText("dashboardPositive", formatPercent(sentiment.positive, analyzed));
    setText("dashboardNegative", formatPercent(sentiment.negative, analyzed));
    setText("dashboardAnalyzed", `${analyzed} analyzed`);
    const items = limitEvidence(data.items, getPageSettings().maxResults, 5);
    setText("dashboardSummary", buildAnalystSummary(data));
    setText("dashboardSummaryStatus", `${data.items.length} public records`);
    renderEvidence("dashboardEvidence", items);
    renderEvidenceMap(
        "dashboardMapMarkers",
        "dashboardMapStatus",
        "dashboardMapCount",
        items,
        "dashboardLocationEstimateDetails",
        "dashboardLocationEstimates"
    );
}

function renderAnalysisPage(data) {
    if (!data) {
        return;
    }
    const sentiment = data.sentiment || {};
    setText("analysisKeyword", data.keyword || "—");
    setText("analysisTotal", Number(data.total || data.items.length));
    setText("analysisPositive", formatPercent(sentiment.positive, sentiment.analyzed));
    setText("analysisNegative", formatPercent(sentiment.negative, sentiment.analyzed));
    setText("analysisProcessed", Number(sentiment.analyzed || 0));
    setText("analysisResultCount", `${data.items.length} records`);
    renderSources("analysisSources", data.sources);
    const items = limitEvidence(data.items, getPageSettings().maxResults);
    setText("analysisResultCount", `${items.length} of ${data.items.length} records`);
    renderEvidence("analysisResults", items);
}

function renderAnalyticsPage(data) {
    if (!data) {
        return;
    }
    const sentiment = data.sentiment || {};
    const positive = Number(sentiment.positive || 0);
    const negative = Number(sentiment.negative || 0);
    const analyzed = Number(sentiment.analyzed || 0);
    const total = Number(data.total || data.items.length);
    const unscored = Math.max(0, total - analyzed);
    const positiveDegrees = analyzed ? Math.round(positive * 3.6) : 0;
    const negativeDegrees = analyzed ? Math.round(negative * 3.6) : 0;
    const donut = document.getElementById("analyticsDonut");

    setText("analyticsKeyword", data.keyword || "No investigation selected");
    setText("analyticsTotal", total);
    setText("analyticsAnalyzed", analyzed);
    setText("analyticsPositive", formatPercent(positive, analyzed));
    setText("analyticsNegative", formatPercent(negative, analyzed));
    setText("analyticsSentimentCount", `${analyzed} analyzed`);
    setText("analyticsDonutCenter", formatPercent(positive, analyzed));
    setText("analyticsPositiveLegend", formatPercent(positive, analyzed));
    setText("analyticsNegativeLegend", formatPercent(negative, analyzed));
    setText("analyticsUnscored", unscored);
    if (donut) {
        donut.style.background = `conic-gradient(var(--green) 0deg ${positiveDegrees}deg, var(--red) ${positiveDegrees}deg ${positiveDegrees + negativeDegrees}deg, #3a4247 ${positiveDegrees + negativeDegrees}deg 360deg)`;
    }
    renderSources("analyticsSources", data.sources);
    renderSourceBars(data);
    renderPublicationTimeline(data.items);
}

function renderIntelligencePage(data) {
    if (!data) {
        return;
    }
    const sentiment = data.sentiment || {};
    const items = data.items;
    const sourceNames = [];
    if (data.sources?.youtube?.available) {
        sourceNames.push("YouTube");
    }
    if (data.sources?.gnews?.available) {
        sourceNames.push("GNews");
    }
    const sourceDescription = sourceNames.length
        ? `from ${sourceNames.join(" and ")}`
        : "from the configured public sources";
    const analyzed = Number(sentiment.analyzed || 0);
    const sentimentSummary = analyzed > 0
        ? `Sentiment was analyzed for ${analyzed} records: ${Number(sentiment.positive || 0)}% positive and ${Number(sentiment.negative || 0)}% negative.`
        : "No sentiment predictions were returned, so sentiment percentages are unavailable.";
    const summary = items.length
        ? `The investigation of "${data.keyword}" returned ${items.length} public records ${sourceDescription}. ${sentimentSummary} Results reflect the latest source responses and do not include reliable item-level geolocation.`
        : `No public records were returned for "${data.keyword}". Check the source errors below, verify the matching API key in Settings, then try another search.`;

    setText("intelligenceKeyword", data.keyword || "No investigation selected");
    setText("intelligenceUpdated", formatDate(data.generated_at) || "Latest scan");
    setText("intelligenceSummary", summary);
    renderGeminiSummary(data.gemini, items.length);
    setText("intelligencePositive", formatPercent(sentiment.positive, analyzed));
    setText("intelligenceNegative", formatPercent(sentiment.negative, analyzed));
    setText("intelligenceAnalyzed", `${Number(sentiment.analyzed || 0)} analyzed`);
    setText("intelligenceCount", `${items.length} records`);
    renderSources("intelligenceSources", data.sources);
    const visibleItems = limitEvidence(items, getPageSettings().maxResults);
    renderEvidence("intelligenceEvidence", visibleItems);
    renderEvidenceMap(
        "intelligenceMapMarkers",
        "intelligenceMapStatus",
        "intelligenceMapCount",
        visibleItems,
        "intelligenceLocationEstimateDetails",
        "intelligenceLocationEstimates"
    );
}

function buildAnalystSummary(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const sources = data.sources || {};
    const sourceCounts = [
        ["YouTube", Number(sources.youtube?.count || 0)],
        ["GNews", Number(sources.gnews?.count || 0)]
    ].filter(([, count]) => count > 0);
    const target = data.keyword ? `"${data.keyword}"` : "this investigation";

    if (items.length === 0) {
        const errors = [sources.youtube?.error, sources.gnews?.error]
            .filter(message => typeof message === "string" && message.trim() !== "");
        return `No public source records were returned for ${target}.${errors.length ? ` Source status: ${errors.join(" ")}` : " Check source availability and run another scan."}`;
    }

    const sourceBreakdown = sourceCounts.length
        ? sourceCounts.map(([name, count]) => `${name}: ${count}`).join("; ")
        : "Source-level counts were not provided";
    const observations = [
        `${items.length} real public records were returned for ${target}.`,
        `Source breakdown: ${sourceBreakdown}.`
    ];
    const sentiment = data.sentiment || {};
    const analyzed = Number(sentiment.analyzed || 0);
    if (getPageSettings().sentimentAnalysis) {
        observations.push(analyzed > 0
            ? `Sentiment was analyzed for ${analyzed} records: ${Number(sentiment.positive || 0)}% positive and ${Number(sentiment.negative || 0)}% negative.`
            : "Sentiment was not assessed because no usable predictions were returned.");
    }
    observations.push("The connected sources do not provide reliable post-level locations, so no geographic conclusions are drawn.");
    return observations.join(" ");
}

function renderEvidenceMap(markersId, statusId, countId, items, estimateDetailsId, estimateListId) {
    const markers = document.getElementById(markersId);
    if (!markers) {
        return;
    }

    markers.replaceChildren();
    const locatedItems = items
        .map((item, index) => ({ item, index, location: getEvidenceLocation(item) }))
        .filter(entry => entry.location !== null);

    let estimateNumber = 0;
    locatedItems.forEach(({ item, index, location }) => {
        const marker = document.createElement("button");
        const source = String(item.source || "Source record");
        const publisher = String(item.author || item.source_name || "");
        const estimate = location.kind === "gemini";
        if (estimate) {
            estimateNumber += 1;
        }
        const details = estimate
            ? `${location.name} · approximate ${location.resolution}-level estimate · ${Math.round(location.confidence * 100)}% confidence`
            : "Source-provided coordinates";
        const description = [details, source, publisher, item.title || "Untitled record"]
            .filter(Boolean)
            .join(" · ");
        marker.type = "button";
        marker.className = `location-marker${estimate ? " gemini-location-marker" : " source-location-marker"}`;
        marker.style.left = `${((location.longitude + 180) / 360) * 100}%`;
        marker.style.top = `${((90 - location.latitude) / 180) * 100}%`;
        if (estimate) {
            marker.textContent = String(estimateNumber);
        }
        marker.setAttribute("aria-label", `${estimate ? "Gemini-estimated location" : "Source-provided location"}: ${description}. Select to open record.`);
        marker.title = description;
        marker.addEventListener("click", () => {
            const card = document.querySelector(`[data-evidence-index="${index}"]`);
            card?.scrollIntoView({ behavior: "smooth", block: "center" });
            card?.classList.add("map-highlight");
            window.setTimeout(() => card?.classList.remove("map-highlight"), 1800);
        });
        markers.appendChild(marker);
    });

    const status = document.getElementById(statusId);
    const count = document.getElementById(countId);
    const sourceLocated = locatedItems.filter(entry => entry.location.kind === "source").length;
    const estimated = locatedItems.length - sourceLocated;
    renderGeminiLocationList(
        estimateDetailsId,
        estimateListId,
        locatedItems.filter(entry => entry.location.kind === "gemini")
    );
    if (count) {
        count.textContent = `${sourceLocated} source · ${estimated} AI-estimated`;
    }
    if (status) {
        if (sourceLocated > 0 || estimated > 0) {
            const parts = [];
            if (sourceLocated > 0) {
                parts.push(`${sourceLocated} source-provided location${sourceLocated === 1 ? "" : "s"}`);
            }
            if (estimated > 0) {
                parts.push(`${estimated} approximate Gemini estimate${estimated === 1 ? "" : "s"}`);
            }
            status.textContent = `${parts.join(" · ")}. AI pins are estimates from explicitly named places, not post geolocation. Select a pin to view its record.`;
        } else if (items.length > 0) {
            status.textContent = "No source coordinates or evidence-backed Gemini estimates for this scan. Gemini only estimates a place when the record explicitly names it.";
        } else {
            status.textContent = "No records were returned, so there are no source locations or Gemini estimates to map.";
        }
    }
}

function renderGeminiLocationList(detailsId, listId, estimates) {
    const details = document.getElementById(detailsId);
    const list = document.getElementById(listId);
    if (!details || !list) {
        return;
    }
    list.replaceChildren();
    details.hidden = estimates.length === 0;
    details.open = estimates.length > 0;
    estimates.forEach(({ item, index, location }) => {
        const row = document.createElement("li");
        const link = document.createElement("button");
        const quote = document.createElement("small");
        const reference = item.gemini_ref ? ` · [${item.gemini_ref}]` : "";
        const source = item.source ? ` · ${item.source}` : "";
        link.type = "button";
        link.className = "location-estimate-link";
        link.textContent = `${location.name} · ${location.resolution}-level estimate · ${Math.round(location.confidence * 100)}% model-reported confidence${reference}${source}`;
        quote.className = "location-evidence-quote";
        quote.textContent = `Evidence: “${location.evidenceQuote}”`;
        link.addEventListener("click", () => {
            const card = document.querySelector(`[data-evidence-index="${index}"]`);
            card?.scrollIntoView({ behavior: "smooth", block: "center" });
            card?.classList.add("map-highlight");
            window.setTimeout(() => card?.classList.remove("map-highlight"), 1800);
        });
        row.append(link, quote);
        list.appendChild(row);
    });
}

function getEvidenceLocation(item) {
    const candidates = [item.coordinates, item.geo, item.location, item];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            continue;
        }
        const rawLatitude = candidate.latitude ?? candidate.lat;
        const rawLongitude = candidate.longitude ?? candidate.lon ?? candidate.lng;
        if (
            rawLatitude === null
            || rawLatitude === undefined
            || rawLatitude === ""
            || rawLongitude === null
            || rawLongitude === undefined
            || rawLongitude === ""
        ) {
            continue;
        }
        const latitude = Number(rawLatitude);
        const longitude = Number(rawLongitude);
        if (
            Number.isFinite(latitude)
            && Number.isFinite(longitude)
            && latitude >= -90
            && latitude <= 90
            && longitude >= -180
            && longitude <= 180
        ) {
            return { latitude, longitude, kind: "source" };
        }
    }
    const estimate = item.gemini_location;
    if (!estimate || typeof estimate !== "object" || Array.isArray(estimate)) {
        return null;
    }
    const latitude = Number(estimate.latitude);
    const longitude = Number(estimate.longitude);
    const confidence = Number(estimate.confidence);
    const resolution = String(estimate.resolution || "").toLowerCase();
    const locationName = String(estimate.location_name || "").trim();
    const quote = String(estimate.evidence_quote || "").trim();
    const evidenceText = `${item.title || ""}\n${item.description || ""}`;
    if (
        !locationName
        || !quote
        || !evidenceText.toLowerCase().includes(quote.toLowerCase())
        || !quote.toLowerCase().includes(locationName.toLowerCase())
        || !["city", "region", "country"].includes(resolution)
        || !Number.isFinite(confidence)
        || confidence < 0.65
        || confidence > 1
        || !Number.isFinite(latitude)
        || latitude < -90
        || latitude > 90
        || !Number.isFinite(longitude)
        || longitude < -180
        || longitude > 180
    ) {
        return null;
    }
    return {
        latitude,
        longitude,
        confidence,
        resolution,
        name: locationName,
        evidenceQuote: quote,
        kind: "gemini"
    };
}

function renderPublicationTimeline(items) {
    const container = document.getElementById("publicationTimeline");
    const badge = document.getElementById("publicationTimelineCount");
    if (!container) {
        return;
    }

    const byDate = new Map();
    (Array.isArray(items) ? items : []).forEach(item => {
        const value = item.published_at || item.published;
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) {
            return;
        }
        const key = date.toISOString().slice(0, 10);
        byDate.set(key, (byDate.get(key) || 0) + 1);
    });
    const dates = [...byDate.entries()].sort(([first], [second]) => first.localeCompare(second)).slice(-8);
    container.replaceChildren();
    if (dates.length < 2) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const message = document.createElement("p");
        message.textContent = dates.length === 0
            ? "No dated records were returned, so a publication timeline is unavailable."
            : `Only one publication date appears in this scan (${formatTimelineDate(dates[0][0])}); at least two dates are needed to show a timeline.`;
        empty.appendChild(message);
        container.appendChild(empty);
        if (badge) {
            badge.textContent = `${dates.reduce((sum, [, count]) => sum + count, 0)} dated records`;
        }
        return;
    }

    const totalDated = dates.reduce((sum, [, count]) => sum + count, 0);
    if (badge) {
        badge.textContent = `${totalDated} dated records · ${dates.length} dates`;
    }
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", "publication-chart");
    svg.setAttribute("viewBox", "0 0 720 300");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Returned record counts by publication date: ${dates.map(([day, count]) => `${formatTimelineDate(day)}, ${count}`).join("; ")}`);
    const title = document.createElementNS(namespace, "title");
    title.textContent = "Records by publication date";
    svg.appendChild(title);
    const left = 58;
    const right = 694;
    const top = 26;
    const bottom = 228;
    const maximum = Math.max(...dates.map(([, count]) => count));
    const axisMaximum = Math.max(1, Math.ceil(maximum / 4) * 4);
    const points = dates.map(([day, count], index) => ({
        day,
        count,
        x: left + (right - left) * index / (dates.length - 1),
        y: bottom - (bottom - top) * count / axisMaximum
    }));
    for (let line = 0; line <= 4; line += 1) {
        const y = bottom - (bottom - top) * line / 4;
        const gridLine = document.createElementNS(namespace, "line");
        gridLine.setAttribute("x1", String(left));
        gridLine.setAttribute("x2", String(right));
        gridLine.setAttribute("y1", String(y));
        gridLine.setAttribute("y2", String(y));
        gridLine.setAttribute("class", "chart-grid-line");
        svg.appendChild(gridLine);
        const label = document.createElementNS(namespace, "text");
        label.setAttribute("x", String(left - 12));
        label.setAttribute("y", String(y + 4));
        label.setAttribute("text-anchor", "end");
        label.setAttribute("class", "chart-axis-label");
        label.textContent = String(Math.round(axisMaximum * line / 4));
        svg.appendChild(label);
    }
    const fill = document.createElementNS(namespace, "linearGradient");
    fill.setAttribute("id", "publicationChartFill");
    fill.setAttribute("x1", "0");
    fill.setAttribute("x2", "0");
    fill.setAttribute("y1", "0");
    fill.setAttribute("y2", "1");
    const fillTop = document.createElementNS(namespace, "stop");
    fillTop.setAttribute("offset", "0%");
    fillTop.setAttribute("stop-color", "var(--page-accent)");
    fillTop.setAttribute("stop-opacity", ".28");
    const fillBottom = document.createElementNS(namespace, "stop");
    fillBottom.setAttribute("offset", "100%");
    fillBottom.setAttribute("stop-color", "var(--page-accent)");
    fillBottom.setAttribute("stop-opacity", "0");
    fill.append(fillTop, fillBottom);
    const definitions = document.createElementNS(namespace, "defs");
    definitions.appendChild(fill);
    svg.prepend(definitions);
    const linePath = document.createElementNS(namespace, "path");
    const pointsPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    linePath.setAttribute("d", `${pointsPath} L ${right} ${bottom} L ${left} ${bottom} Z`);
    linePath.setAttribute("class", "chart-area");
    svg.appendChild(linePath);
    const line = document.createElementNS(namespace, "path");
    line.setAttribute("d", pointsPath);
    line.setAttribute("class", "chart-line");
    svg.appendChild(line);
    points.forEach(point => {
        const group = document.createElementNS(namespace, "g");
        const circle = document.createElementNS(namespace, "circle");
        circle.setAttribute("cx", String(point.x));
        circle.setAttribute("cy", String(point.y));
        circle.setAttribute("r", "5");
        circle.setAttribute("class", "chart-point");
        const pointTitle = document.createElementNS(namespace, "title");
        pointTitle.textContent = `${formatTimelineDate(point.day)}: ${point.count} returned record${point.count === 1 ? "" : "s"}`;
        circle.appendChild(pointTitle);
        const dateLabel = document.createElementNS(namespace, "text");
        dateLabel.setAttribute("x", String(point.x));
        dateLabel.setAttribute("y", "258");
        dateLabel.setAttribute("text-anchor", "middle");
        dateLabel.setAttribute("class", "chart-axis-label");
        dateLabel.textContent = formatTimelineDate(point.day);
        group.append(circle, dateLabel);
        svg.appendChild(group);
    });
    container.appendChild(svg);
}

function formatTimelineDate(value) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    });
}

function renderGeminiSummary(gemini, recordCount) {
    const summary = document.getElementById("geminiSummary");
    const status = document.getElementById("geminiStatus");
    if (!summary || !status) {
        return;
    }

    if (gemini?.status === "available" && typeof gemini.summary === "string") {
        summary.textContent = gemini.summary;
        const keySource = gemini.key_source === "server" ? "PHP key" : "browser key";
        status.textContent = `${Number(gemini.records_analyzed || 0)} records · ${keySource}`;
        status.classList.add("success");
        return;
    }

    status.classList.remove("success");
    if (gemini?.status === "error") {
        status.textContent = gemini.key_source === "server"
            ? "Unavailable · PHP key"
            : "Unavailable · browser key";
        summary.textContent = `Gemini could not summarize this scan: ${gemini.error || "The API returned no summary."}`;
    } else if (recordCount === 0) {
        status.textContent = "No records";
        summary.textContent = "Gemini was not called because the source APIs returned no records.";
    } else {
        status.textContent = "Not configured";
        summary.textContent = "No Gemini summary was generated. Add GEMINI_API_KEY in Settings and run a new scan.";
    }
}

function renderReportPage(data) {
    setText("reportTarget", data?.keyword || "No investigation selected");
    setText("reportTimestamp", data ? formatDate(data.generated_at) || "Latest scan" : "No scan yet");
    if (!data) {
        return;
    }
    if (getPageSettings().reportExport) {
        generateLocalReport(data);
    } else {
        setPageMessage(document.getElementById("reportStatus"), "Report export is disabled in Settings.", "");
    }
}

function generateLocalReport(data = loadLatestScan()) {
    const output = document.getElementById("pageReportContent");
    const status = document.getElementById("reportStatus");
    if (!getPageSettings().reportExport) {
        setPageMessage(status, "Report export is disabled in Settings.", "error");
        return "";
    }
    if (!data || !output) {
        setPageMessage(status, "Run an investigation before generating a report.", "error");
        return "";
    }

    const items = data.items || [];
    if (items.length === 0) {
        output.textContent = "No report was generated because this investigation returned no public records.";
        setPageMessage(status, "No report generated: the latest scan returned no public records.", "error");
        return "";
    }
    const sentiment = data.sentiment || {};
    const sources = data.sources || {};
    const lines = [
        "SOCMINT-X INVESTIGATION REPORT",
        `Target: ${data.keyword || "Unknown"}`,
        `Generated: ${formatDate(data.generated_at) || new Date().toLocaleString()}`,
        `Total public records: ${items.length}`,
        ...(data.gemini?.status === "available" && typeof data.gemini.summary === "string"
            ? [
                "",
                "GEMINI AI SYNTHESIS (AI-GENERATED; VERIFY AGAINST CITED SOURCES)",
                data.gemini.summary
            ]
            : []),
        ...(getPageSettings().sentimentAnalysis
            ? [
                `Sentiment analyzed: ${Number(sentiment.analyzed || 0)}`,
                `Positive: ${formatPercent(sentiment.positive, sentiment.analyzed)}`,
                `Negative: ${formatPercent(sentiment.negative, sentiment.analyzed)}`
            ]
            : []),
        "",
        "SOURCE COVERAGE",
        `YouTube: ${sourceStatus(sources.youtube)}`,
        `GNews: ${sourceStatus(sources.gnews)}`,
        "",
        "KEY PUBLIC RECORDS",
        ...items.flatMap((item, index) => {
            const reference = item.gemini_ref ? `[${item.gemini_ref}] ` : "";
            const details = [`${index + 1}. ${reference}[${item.source || "Unknown"}] ${item.title || "Untitled"}`];
            if (item.author || item.source_name) {
                details.push(`   Publisher: ${item.author || item.source_name}`);
            }
            if (item.published_at) {
                details.push(`   Published: ${item.published_at}`);
            }
            if (item.description) {
                details.push(`   Summary: ${item.description}`);
            }
            if (getPageSettings().sentimentAnalysis && item.sentiment) {
                details.push(`   Sentiment: ${item.sentiment}${Number(item.confidence || 0) > 0 ? ` (${item.confidence}% confidence)` : ""}`);
            }
            if (item.url) {
                details.push(`   Source: ${item.url}`);
            }
            details.push("");
            return details;
        })
    ];

    output.textContent = lines.join("\n");
    output.classList.add("report-copy");
    setPageMessage(status, `${items.length} records included in this report.`, "success");
    return lines.join("\n");
}

function initializeReportActions() {
    document.getElementById("generatePageReport")?.addEventListener("click", () => {
        generateLocalReport();
    });
    document.getElementById("copyPageReport")?.addEventListener("click", async () => {
        const text = document.getElementById("pageReportContent")?.textContent?.trim();
        if (!text || text.startsWith("No report generated") || text.startsWith("No report was generated")) {
            setPageMessage(document.getElementById("reportStatus"), "Generate a report before copying.", "error");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setPageMessage(document.getElementById("reportStatus"), "Report copied to clipboard.", "success");
        } catch (error) {
            setPageMessage(document.getElementById("reportStatus"), `Unable to copy report: ${error.message}`, "error");
        }
    });
    document.getElementById("downloadPageReport")?.addEventListener("click", () => {
        if (!getPageSettings().reportExport) {
            setPageMessage(document.getElementById("reportStatus"), "Report export is disabled in Settings.", "error");
            return;
        }
        const data = loadLatestScan();
        if (!data) {
            setPageMessage(document.getElementById("reportStatus"), "No PDF created: run an investigation and collect real public records first.", "error");
            return;
        }
        if (data.items.length === 0) {
            setPageMessage(document.getElementById("reportStatus"), "A PDF cannot be created without real public records.", "error");
            return;
        }
        if (!generateLocalReport(data)) {
            return;
        }
        setPageMessage(document.getElementById("reportStatus"), "In the print dialog, choose “Save as PDF” to create your report.", "success");
        window.print();
    });
}

function renderSources(containerId, sources = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    container.textContent = "";
    [
        ["YouTube", sources.youtube],
        ["GNews", sources.gnews]
    ].forEach(([name, source]) => {
        const row = document.createElement("div");
        const details = document.createElement("div");
        const title = document.createElement("strong");
        const message = document.createElement("small");
        const dot = document.createElement("span");
        const available = source?.available === true;
        row.className = `source-row${available ? " available" : ""}`;
        title.textContent = name;
        message.textContent = source?.error || (available
            ? `${Number(source.count || 0)} records returned`
            : "Unavailable; check the API key and service response.");
        dot.className = "health-dot";
        details.append(title, message);
        if (source?.key_source) {
            const keySource = document.createElement("small");
            keySource.className = "source-key-origin";
            keySource.textContent = source.key_source === "server"
                ? "API key: PHP host configuration"
                : source.key_source === "browser"
                    ? "API key: this browser"
                    : "API key: missing";
            details.appendChild(keySource);
        }
        row.append(details, dot);
        container.appendChild(row);
    });
}

function renderSourceBars(data) {
    const container = document.getElementById("analyticsSourceBars");
    if (!container) {
        return;
    }
    container.textContent = "";
    const rows = [
        { label: "YouTube", count: Number(data.sources?.youtube?.count || 0) },
        { label: "GNews", count: Number(data.sources?.gnews?.count || 0) }
    ];
    const maximum = Math.max(1, ...rows.map(row => row.count));
    rows.forEach(row => {
        const element = document.createElement("div");
        element.className = "bar-row";
        element.innerHTML = `<span>${escapePageHtml(row.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(row.count / maximum * 100)}%"></span></span><strong>${row.count}</strong>`;
        container.appendChild(element);
    });
}

function limitEvidence(items, maxResults, dashboardLimit = Number.POSITIVE_INFINITY) {
    const limits = new Map();
    const visible = [];
    const maxPerSource = Math.min(maxResults, dashboardLimit);
    items.forEach(item => {
        const source = String(item.source || "Unknown");
        const count = limits.get(source) || 0;
        if (count < maxPerSource) {
            visible.push(item);
            limits.set(source, count + 1);
        }
    });
    return visible;
}

function renderEvidence(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    container.textContent = "";
    if (!getPageSettings().liveFeed) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = "<h3>Evidence feed is paused</h3><p>Enable the evidence feed in Settings to display collected records.</p>";
        container.appendChild(empty);
        return;
    }
    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = "<h3>No public records</h3><p>Run a scan or check configured source availability.</p>";
        container.appendChild(empty);
        return;
    }

    items.forEach((item, index) => {
        const card = document.createElement("article");
        const top = document.createElement("div");
        const source = document.createElement("span");
        const sentiment = document.createElement("span");
        const title = document.createElement("h3");
        const description = document.createElement("p");
        const meta = document.createElement("div");
        const sourceName = String(item.source || "Unknown");
        const sentimentName = String(item.sentiment || "UNSCORED").toUpperCase();
        card.className = "feed-item";
        card.dataset.evidenceIndex = String(index);
        top.className = "result-top";
        source.className = "source-pill";
        source.textContent = item.gemini_ref
            ? `[${item.gemini_ref}] ${sourceName}`
            : sourceName;
        sentiment.className = `sentiment-pill ${sentimentName === "POSITIVE" ? "positive" : sentimentName === "NEGATIVE" ? "negative" : "neutral"}`;
        sentiment.textContent = sentimentName;
        title.textContent = item.title || "Untitled record";
        description.textContent = item.description || "";
        meta.className = "feed-meta";
        const author = document.createElement("span");
        const publisher = item.author || item.source_name;
        author.textContent = publisher ? `Publisher: ${publisher}` : "Public source";
        if (item.published_at && formatDate(item.published_at)) {
            const published = document.createElement("time");
            published.dateTime = item.published_at;
            published.textContent = `Published: ${formatDate(item.published_at)}`;
            meta.append(author, published);
        } else {
            meta.appendChild(author);
        }
        const linkArea = document.createElement("span");
        const link = document.createElement("a");
        if (isHttpUrl(item.url)) {
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Open source";
            linkArea.appendChild(link);
        } else {
            linkArea.textContent = "No source link";
        }
        meta.append(linkArea);
        top.append(source, sentiment);
        card.append(top, title);
        if (description.textContent) {
            card.appendChild(description);
        }
        card.appendChild(meta);
        container.appendChild(card);
    });
}

function sourceStatus(source) {
    if (!source?.available) {
        return "Unavailable";
    }
    return `${Number(source.count || 0)} records`;
}

function formatPercent(value, analyzed) {
    return Number(analyzed || 0) > 0 ? `${Number(value || 0)}%` : "N/A";
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function formatDate(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = String(value);
    }
}

function setPageMessage(element, message, state) {
    if (element) {
        element.textContent = message;
        element.classList.toggle("error", state === "error");
        element.classList.toggle("success", state === "success");
    }
}

function escapePageHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
