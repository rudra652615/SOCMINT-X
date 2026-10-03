"use strict";

const API_ENDPOINT = "backend/api/analyze.php";

const state = {
    filter: "all",
    lastData: null,
    lastResponse: null
};
let scanInProgress = false;
let appRefreshTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeIcons();
    initializeClock();
    bindEvents();
    renderSourceHealth();
    applyAppPreferences();
    restoreLatestScan();
    initializeAppAutoRefresh();
    window.addEventListener("storage", event => {
        if (event.key === "socmint_latest_scan") {
            restoreLatestScan();
        } else if (event.key === "socmint_settings") {
            applyAppPreferences();
            initializeAppAutoRefresh();
        }
    });
    window.addEventListener("socmintSettingsChanged", () => {
        applyAppPreferences();
        initializeAppAutoRefresh();
    });
});

function initializeIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function initializeClock() {
    const clock = document.getElementById("clock");
    const today = document.getElementById("todayLabel");

    function tick() {
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
    }

    tick();
    window.setInterval(tick, 1000);
}

function bindEvents() {
    document.getElementById("searchForm")?.addEventListener("submit", event => {
        event.preventDefault();
        runInvestigation();
    });

    document.querySelectorAll("[data-query]").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById("searchInput");
            input.value = button.dataset.query || "";
            runInvestigation();
        });
    });

    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            state.filter = button.dataset.filter || "all";
            document.querySelectorAll("[data-filter]").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            renderFeed(getItems());
        });
    });

    document.getElementById("copyReportButton")?.addEventListener("click", copyReport);
    document.getElementById("exportJsonButton")?.addEventListener("click", exportJson);
    document.getElementById("exportCsvButton")?.addEventListener("click", exportCsv);
}

async function runInvestigation(options = {}) {
    if (scanInProgress) {
        return;
    }
    const input = document.getElementById("searchInput");
    const keyword = (input?.value || "").trim();
    const settings = getAppSettings();

    if (!keyword) {
        toast("Enter a target keyword first.");
        input?.focus();
        return;
    }

    scanInProgress = true;
    if (!options.silent) {
        setLoading(true);
        clearFeed();
        setText("summaryText", "Collecting public intelligence signals...");
    }
    setText("systemStatus", "Scanning");
    setText("scanBadge", "Scanning");

    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                keyword,
                max_results: settings.maxResults,
                api_keys: window.getSOCMINTApiKeys()
            })
        });

        const payload = await parseJson(response);

        if (!response.ok || payload.success !== true) {
            renderDashboard(payload);
            if (payload?.data?.keyword && Array.isArray(payload.data.items)) {
                payload.data.generated_at = payload.data.generated_at || new Date().toISOString();
                payload.data.requested_limit = settings.maxResults;
                try {
                    localStorage.setItem("socmint_latest_scan", JSON.stringify(payload.data));
                } catch (error) {
                    console.error("Unable to share investigation with other pages:", error);
                }
            }
            throw new Error(payload.message || "Analysis request failed.");
        }

        renderDashboard(payload);
        if (payload?.data?.keyword && Array.isArray(payload.data.items)) {
            payload.data.generated_at = payload.data.generated_at || new Date().toISOString();
            payload.data.requested_limit = settings.maxResults;
            try {
                localStorage.setItem("socmint_latest_scan", JSON.stringify(payload.data));
            } catch (error) {
                console.error("Unable to share investigation with other pages:", error);
            }
        }
        if (!options.silent) {
            toast("Analysis completed.");
        }
        notifyAppScanComplete(payload.data);
    } catch (error) {
        if (!options.silent) {
            setText("summaryText", `Scan did not complete: ${error.message}`);
            toast(error.message);
        }
        setText("systemStatus", "Needs attention");
        setText("scanBadge", "Offline");
    } finally {
        scanInProgress = false;
        if (!options.silent) {
            setLoading(false);
        }
    }
}

async function parseJson(response) {
    try {
        return await response.json();
    } catch {
        return {
            success: false,
            message: "The backend returned a non-JSON response.",
            data: {}
        };
    }
}

function renderDashboard(response) {
    const data = response?.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const sentiment = data.sentiment || {};
    const sources = data.sources || {};
    const total = Number(data.total || items.length || 0);
    const positive = Number(sentiment.positive || 0);
    const negative = Number(sentiment.negative || 0);
    const analyzed = Number(sentiment.analyzed || 0);
    const sourceTotal = countAvailableSources(sources);
    const settings = getAppSettings();

    state.lastResponse = response;
    state.lastData = {
        ...data,
        items
    };

    setText("mentionCount", data.total ?? items.length);
    setText("mentionDelta", total > 0 ? `${items.length} real source records` : "No public records");
    setText("positiveCount", analyzed > 0 ? `${positive}%` : "N/A");
    setText("negativeCount", analyzed > 0 ? `${negative}%` : "N/A");
    setText("positiveMeta", analyzed > 0 ? `${analyzed} analyzed` : "Not analyzed");
    setText("sourceCount", `${sourceTotal}/2`);
    setText("topSourceResult", getTopSource(sources));
    setText("keywordResult", data.keyword || "-");
    setText("sourceResult", buildSourceText(sources));
    setText("updateResult", formatDate(data.generated_at) || "Scan time unavailable");
    setText("riskResult", analyzed > 0 ? `Risk ${calculateRisk(negative, analyzed).toLowerCase()}` : "Not assessed");
    setText("systemStatus", response?.success ? "Online" : "Limited");
    setText("scanBadge", total > 0 ? "Active" : "No Data");
    setText("sentimentBadge", analyzed > 0 ? `${analyzed} analyzed` : "No predictions");
    setText("geoNote", getGeoNoteText(total));

    renderDonut(positive, negative, analyzed);
    renderSourceBars(sources);
    renderSourceHealth(sources);
    const visibleItems = limitAppEvidence(items, settings.maxResults);
    renderFeed(visibleItems);
    renderSummary(data, response);
    renderCommandLocationMap(visibleItems);
    initializeIcons();
}

function renderCommandLocationMap(items) {
    const markers = document.getElementById("commandMapMarkers");
    const note = document.getElementById("geoNote");
    if (!markers) {
        return;
    }
    markers.replaceChildren();
    const located = items
        .map((item, index) => ({ item, index, location: getAppMapLocation(item) }))
        .filter(result => result.location !== null);
    let estimateNumber = 0;
    located.forEach(({ item, location }) => {
        const recordIndex = getItems().indexOf(item);
        const marker = document.createElement("button");
        const evidenceLabel = `${item.source || "Source record"} · ${item.author || item.source_name || item.title || "Source item"}`;
        const estimate = location.kind === "gemini";
        if (estimate) {
            estimateNumber += 1;
        }
        const label = estimate
            ? `${location.name} · approximate ${location.resolution}-level Gemini estimate · ${Math.round(location.confidence * 100)}% confidence`
            : `Source-provided coordinates · ${evidenceLabel}`;
        marker.type = "button";
        marker.className = `location-marker${estimate ? " gemini-location-marker" : " source-location-marker"}`;
        marker.style.left = `${((location.longitude + 180) / 360) * 100}%`;
        marker.style.top = `${((90 - location.latitude) / 180) * 100}%`;
        if (estimate) {
            marker.textContent = String(estimateNumber);
        }
        marker.title = `${label} · ${evidenceLabel}`;
        marker.setAttribute("aria-label", `${estimate ? "Gemini-estimated location" : "Source-provided location"}: ${marker.title}. Select to open record.`);
        marker.addEventListener("click", () => {
            const card = document.querySelector(`#postsContainer [data-evidence-index="${recordIndex}"]`);
            card?.scrollIntoView({ behavior: "smooth", block: "center" });
            card?.classList.add("map-highlight");
            window.setTimeout(() => card?.classList.remove("map-highlight"), 1800);
        });
        markers.appendChild(marker);
    });
    if (note) {
        const sourceCount = located.filter(entry => entry.location.kind === "source").length;
        const estimateCount = located.length - sourceCount;
        note.textContent = located.length > 0
            ? `${sourceCount} source-provided · ${estimateCount} approximate Gemini estimate${estimateCount === 1 ? "" : "s"}. AI pins are not post geolocation. Select to view a record.`
            : items.length > 0
                ? "No source coordinates or evidence-backed Gemini estimates. AI estimates require an explicitly named place."
                : "No records were returned, so there are no source locations or Gemini estimates to map.";
    }
    renderAppGeminiLocationList(located.filter(entry => entry.location.kind === "gemini"));
}

function renderAppGeminiLocationList(estimates) {
    const details = document.getElementById("commandLocationEstimateDetails");
    const list = document.getElementById("commandLocationEstimates");
    if (!details || !list) {
        return;
    }
    list.replaceChildren();
    details.hidden = estimates.length === 0;
    details.open = estimates.length > 0;
    estimates.forEach(({ item }) => {
        const row = document.createElement("li");
        const link = document.createElement("button");
        const quote = document.createElement("small");
        const location = item.gemini_location;
        const reference = item.gemini_ref ? ` · [${item.gemini_ref}]` : "";
        const source = item.source ? ` · ${item.source}` : "";
        link.type = "button";
        link.className = "location-estimate-link";
        link.textContent = `${location.location_name} · ${location.resolution}-level estimate · ${Math.round(location.confidence * 100)}% model-reported confidence${reference}${source}`;
        quote.className = "location-evidence-quote";
        quote.textContent = `Evidence: “${location.evidence_quote}”`;
        link.addEventListener("click", () => {
            const recordIndex = getItems().indexOf(item);
            const card = document.querySelector(`#postsContainer [data-evidence-index="${recordIndex}"]`);
            card?.scrollIntoView({ behavior: "smooth", block: "center" });
            card?.classList.add("map-highlight");
            window.setTimeout(() => card?.classList.remove("map-highlight"), 1800);
        });
        row.append(link, quote);
        list.appendChild(row);
    });
}

function getAppMapLocation(item) {
    for (const candidate of [item.coordinates, item.geo, item.location, item]) {
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
    const name = String(estimate.location_name || "").trim();
    const quote = String(estimate.evidence_quote || "").trim();
    const evidence = `${item.title || ""}\n${item.description || ""}`;
    if (
        !name
        || !quote
        || !evidence.toLowerCase().includes(quote.toLowerCase())
        || !quote.toLowerCase().includes(name.toLowerCase())
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
        name,
        evidenceQuote: quote,
        kind: "gemini"
    };
}

function renderDonut(positive, negative, analyzed) {
    const donut = document.getElementById("sentimentDonut");
    const center = document.getElementById("donutCenter");
    const positiveDegrees = analyzed > 0 ? Math.round((positive / 100) * 360) : 0;
    const negativeDegrees = analyzed > 0 ? Math.round((negative / 100) * 360) : 0;
    const startNegative = positiveDegrees;
    const endNegative = positiveDegrees + negativeDegrees;

    if (donut) {
        donut.style.background = `conic-gradient(var(--green) 0deg ${positiveDegrees}deg, var(--red) ${startNegative}deg ${endNegative}deg, #3a4247 ${endNegative}deg 360deg)`;
    }

    if (center) {
        center.textContent = analyzed > 0 ? `${positive}%` : "N/A";
    }
}

function renderSourceBars(sources = {}) {
    const container = document.getElementById("sourceBars");
    if (!container) {
        return;
    }

    const rows = [
        { name: "YouTube", count: Number(sources.youtube?.count || 0) },
        { name: "GNews", count: Number(sources.gnews?.count || 0) }
    ];
    const max = Math.max(1, ...rows.map(row => row.count));

    container.textContent = "";
    rows.forEach(row => {
        const element = document.createElement("div");
        element.className = "bar-row";
        element.innerHTML = `
            <span>${escapeHtml(row.name)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${Math.round((row.count / max) * 100)}%"></span></span>
            <strong>${row.count}</strong>
        `;
        container.appendChild(element);
    });
}

function renderSourceHealth(sources = {}) {
    const container = document.getElementById("sourceHealth");
    if (!container) {
        return;
    }

    const rows = [
        {
            name: "YouTube",
            source: sources.youtube,
            idle: "Waiting for scan"
        },
        {
            name: "GNews",
            source: sources.gnews,
            idle: "Waiting for scan"
        }
    ];

    container.textContent = "";
    rows.forEach(row => {
        const available = row.source?.available === true;
        const count = Number(row.source?.count || 0);
        const error = row.source?.error;
        const keySource = row.source?.key_source;
        const element = document.createElement("div");
        element.className = `source-row ${available ? "available" : ""}`;

        element.innerHTML = `
            <div>
                <strong>${escapeHtml(row.name)}</strong>
                <small>${escapeHtml(error || (available ? `${count} results` : row.idle))}</small>
                ${keySource ? `<small class="source-key-origin">API key: ${escapeHtml(keySource === "server" ? "PHP host configuration" : keySource === "browser" ? "this browser" : "missing")}</small>` : ""}
            </div>
            <span class="health-dot" aria-hidden="true"></span>
        `;

        container.appendChild(element);
    });
}

function renderFeed(items) {
    const container = document.getElementById("postsContainer");
    if (!container) {
        return;
    }

    const filtered = filterItems(items);
    container.textContent = "";

    if (!getAppSettings().liveFeed) {
        const paused = document.createElement("div");
        paused.className = "empty-state";
        paused.innerHTML = "<h3>Evidence feed is paused</h3><p>Enable the evidence feed in Settings to display collected records.</p>";
        container.appendChild(paused);
        return;
    }

    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
            <i data-lucide="database-zap"></i>
            <h3>No matching evidence</h3>
            <p>Try another source filter or run a new investigation.</p>
        `;
        container.appendChild(empty);
        initializeIcons();
        return;
    }

    const allItems = getItems();
    filtered.forEach((item, index) => {
        const element = document.createElement("article");
        const sentiment = String(item.sentiment || "UNSCORED").toUpperCase();
        const sentimentClass = sentiment === "POSITIVE" ? "positive" : sentiment === "NEGATIVE" ? "negative" : "neutral";
        const source = item.source || "Unknown";
        const date = formatDate(item.published_at || item.published || "");
        const confidence = Number(item.confidence || item.sentiment_confidence || 0);
        const sourceLabel = item.gemini_ref
            ? `[${item.gemini_ref}] ${source}`
            : source;
        const description = item.description ? `<p>${escapeHtml(item.description)}</p>` : "";
        const link = item.url ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">Open source</a>` : "<span>No link</span>";

        element.className = "feed-item";
        element.dataset.evidenceIndex = String(Math.max(0, allItems.indexOf(item)));
        element.innerHTML = `
            <div class="result-top">
                <span class="source-pill">${escapeHtml(sourceLabel)}</span>
                <span class="sentiment-pill ${sentimentClass}">${escapeHtml(sentiment)}</span>
            </div>
            <h3>${escapeHtml(item.title || "Untitled result")}</h3>
            ${description}
            <div class="feed-meta">
                <span>${escapeHtml(item.author || item.source_name ? `Publisher: ${item.author || item.source_name}` : "Public source")}</span>
                ${date ? `<time datetime="${escapeAttribute(item.published_at || item.published || "")}">Published: ${escapeHtml(date)}</time>` : ""}
                <span>${confidence > 0 ? `${confidence}%` : "Unscored"} · ${link}</span>
            </div>
        `;
        container.appendChild(element);
    });
}

function renderSummary(data, response) {
    const items = Array.isArray(data.items) ? data.items : [];
    const keyword = data.keyword || "the selected target";
    const sentiment = data.sentiment || {};
    const positive = Number(sentiment.positive || 0);
    const negative = Number(sentiment.negative || 0);
    const total = Number(data.total || items.length || 0);
    const sourceText = buildSourceText(data.sources || {});

    if (!response?.success && response?.message) {
        setText("summaryText", `${response.message} Source details are shown in the health panel.`);
        return;
    }

    if (total === 0) {
        setText("summaryText", `No public intelligence items were returned for "${keyword}". Check API keys, quota, source availability, or try a broader keyword.`);
        return;
    }

    if (Number(sentiment.analyzed || 0) === 0) {
        setText(
            "summaryText",
            `Investigation for "${keyword}" collected ${total} real public records from ${sourceText}. No usable sentiment predictions were returned, so sentiment and risk are not assessed. The strongest collection source is ${getTopSource(data.sources || {})}. Map pins are hidden because these sources do not return reliable item-level geolocation.`
        );
        return;
    }

    const risk = calculateRisk(negative, Number(sentiment.analyzed || 0));
    const top = getTopSource(data.sources || {});

    setText(
        "summaryText",
        `Investigation for "${keyword}" collected ${total} real public records from ${sourceText}. Sentiment was analyzed for ${Number(sentiment.analyzed || 0)} records: ${positive}% positive and ${negative}% negative. The strongest collection source is ${top}. Current risk posture is ${risk}. Map pins are hidden because these sources do not return reliable item-level geolocation.`
    );
}

function getGeoNoteText(total) {
    if (total > 0) {
        return "No reliable item-level geolocation in returned source data";
    }

    return "No geolocation returned yet";
}

function filterItems(items) {
    const sourceItems = Array.isArray(items) ? items : getItems();
    if (state.filter === "all") {
        return sourceItems;
    }
    return sourceItems.filter(item => item.source === state.filter);
}

function getItems() {
    return Array.isArray(state.lastData?.items) ? state.lastData.items : [];
}

function clearFeed() {
    const container = document.getElementById("postsContainer");
    if (!container) {
        return;
    }
    container.innerHTML = `
        <div class="empty-state">
            <i data-lucide="loader-circle"></i>
            <h3>Scanning sources</h3>
            <p>Collecting public intelligence from configured services.</p>
        </div>
    `;
    initializeIcons();
}

function setLoading(loading) {
    const button = document.getElementById("searchButton");
    if (!button) {
        return;
    }

    button.disabled = loading;
    button.innerHTML = loading
        ? `<i data-lucide="loader-circle"></i><span>Scanning</span>`
        : `<i data-lucide="scan-search"></i><span>Start Scan</span>`;
    initializeIcons();
}

function countAvailableSources(sources = {}) {
    return ["youtube", "gnews"].filter(source => sources[source]?.available === true).length;
}

function buildSourceText(sources = {}) {
    const labels = [];
    if (sources.youtube?.available) {
        labels.push("YouTube");
    }
    if (sources.gnews?.available) {
        labels.push("GNews");
    }
    return labels.length ? labels.join(", ") : "-";
}

function getTopSource(sources = {}) {
    const youtube = Number(sources.youtube?.count || 0);
    const gnews = Number(sources.gnews?.count || 0);

    if (youtube === 0 && gnews === 0) {
        return "Awaiting data";
    }

    return youtube >= gnews ? "YouTube" : "GNews";
}

function calculateRisk(negative, total) {
    if (total <= 0) {
        return "UNASSESSED";
    }
    if (negative >= 65) {
        return "HIGH";
    }
    if (negative >= 35) {
        return "MEDIUM";
    }
    return "LOW";
}

function getAppSettings() {
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
        const saved = localStorage.getItem("socmint_settings");
        const parsed = saved ? JSON.parse(saved) : {};
        const reportExport = parsed.reportExport === undefined ? parsed.aiReports : parsed.reportExport;
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
        console.error("Unable to load dashboard preferences:", error);
        return defaults;
    }
}

function applyAppPreferences() {
    const settings = getAppSettings();
    document.documentElement.dataset.theme = settings.theme;
    document.body.classList.toggle("hide-sentiment", !settings.sentimentAnalysis);
}

function restoreLatestScan() {
    try {
        const stored = localStorage.getItem("socmint_latest_scan");
        const data = stored ? JSON.parse(stored) : null;
        if (
            data
            && typeof data === "object"
            && typeof data.keyword === "string"
            && Array.isArray(data.items)
        ) {
            const input = document.getElementById("searchInput");
            if (input) {
                input.value = data.keyword;
            }
            renderDashboard({ success: true, data });
        }
    } catch (error) {
        console.error("Unable to restore the latest dashboard scan:", error);
        setText("summaryText", "The saved investigation could not be read. Run a new scan to replace it.");
    }
}

function limitAppEvidence(items, maxResults) {
    const counts = new Map();
    return items.filter(item => {
        const source = String(item.source || "Unknown");
        const count = counts.get(source) || 0;
        if (count >= maxResults) {
            return false;
        }
        counts.set(source, count + 1);
        return true;
    });
}

function initializeAppAutoRefresh() {
    if (appRefreshTimer !== null) {
        window.clearInterval(appRefreshTimer);
        appRefreshTimer = null;
    }
    const settings = getAppSettings();
    if (!settings.autoRefresh) {
        return;
    }
    appRefreshTimer = window.setInterval(() => {
        if (scanInProgress) {
            return;
        }
        try {
            const data = JSON.parse(localStorage.getItem("socmint_latest_scan") || "null");
            if (data?.keyword) {
                const input = document.getElementById("searchInput");
                if (input) {
                    input.value = data.keyword;
                }
                runInvestigation({ silent: true });
            }
        } catch (error) {
            console.error("Unable to refresh the latest investigation:", error);
            setText("summaryText", `Automatic refresh stopped: ${error.message}`);
        }
    }, settings.refreshInterval * 1000);
}

function notifyAppScanComplete(data) {
    const settings = getAppSettings();
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

function copyReport() {
    const text = document.getElementById("summaryText")?.textContent || "";
    if (!text.trim()) {
        toast("No report text to copy.");
        return;
    }

    navigator.clipboard?.writeText(text)
        .then(() => toast("Report copied."))
        .catch(() => toast("Clipboard access was blocked."));
}

function exportJson() {
    if (!state.lastData) {
        toast("Run a scan before exporting.");
        return;
    }
    downloadFile(
        `socmint-${slugify(state.lastData.keyword || "investigation")}.json`,
        JSON.stringify(state.lastData, null, 2),
        "application/json"
    );
}

function exportCsv() {
    const items = getItems();
    if (items.length === 0) {
        toast("No evidence rows to export.");
        return;
    }

    const headers = ["source", "title", "sentiment", "confidence", "published_at", "url"];
    const rows = items.map(item => headers.map(header => csvCell(item[header] ?? "")).join(","));
    downloadFile(
        `socmint-${slugify(state.lastData?.keyword || "evidence")}.csv`,
        [headers.join(","), ...rows].join("\n"),
        "text/csv"
    );
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(`${filename} exported.`);
}

function csvCell(value) {
    return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "investigation";
}

function formatDate(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function toast(message) {
    const element = document.getElementById("toast");
    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
        element.classList.remove("show");
    }, 3200);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
