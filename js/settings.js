/*
=====================================================
SOCMINT-X
Settings Controller
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

        initializeSettings();

    }
);


/*
=====================================================
INITIALIZE SETTINGS
=====================================================
*/

function initializeSettings() {

    loadSettings();

    initializeSaveButton();

    initializeResetButton();

    initializeToggleControls();

    initializeApiKeySettings();

}


/*
=====================================================
DEFAULT SETTINGS
=====================================================
*/

const SOCMINT_DEFAULT_SETTINGS = {

    autoRefresh: false,

    notifications: false,

    liveFeed: true,

    sentimentAnalysis: true,

    reportExport: true,

    maxResults: 10,

    refreshInterval: 300,

    theme: "dark"

};


/*
=====================================================
LOAD SETTINGS
=====================================================
*/

function loadSettings() {

    const settings = readSOCMINTSettings();


    /*
    -----------------------------------------
    Toggle controls
    -----------------------------------------
    */

    setCheckbox(
        "autoRefresh",
        settings.autoRefresh
    );


    setCheckbox(
        "notifications",
        settings.notifications
    );


    setCheckbox(
        "liveFeed",
        settings.liveFeed
    );


    setCheckbox(
        "sentimentAnalysis",
        settings.sentimentAnalysis
    );


    setCheckbox(
        "reportExport",
        settings.reportExport
    );


    /*
    -----------------------------------------
    Numeric settings
    -----------------------------------------
    */

    setValue(
        "maxResults",
        settings.maxResults
    );


    setValue(
        "refreshInterval",
        settings.refreshInterval
    );

    setValue(
        "theme",
        settings.theme
    );

    applySOCMINTTheme(settings.theme);

    updateSettingsStatus(
        "Settings loaded."
    );
}


/*
=====================================================
SAVE SETTINGS
=====================================================
*/

function saveSettings() {

    const settings = normalizeSOCMINTSettings({

        autoRefresh:
            getCheckbox(
                "autoRefresh"
            ),

        notifications:
            getCheckbox(
                "notifications"
            ),

        liveFeed:
            getCheckbox(
                "liveFeed"
            ),

        sentimentAnalysis:
            getCheckbox(
                "sentimentAnalysis"
            ),

        reportExport:
            getCheckbox(
                "reportExport"
            ),

        maxResults:
            getNumber(
                "maxResults",
                10
            ),

        refreshInterval:
            getNumber(
                "refreshInterval",
                300
            ),

        theme:
            document.getElementById("theme")?.value || "dark"

    });


    /*
    -----------------------------------------
    Save locally
    -----------------------------------------
    */

    if (!writeSOCMINTSettings(settings)) {
        updateSettingsStatus("Settings could not be saved in this browser. Check browser storage permissions.");
        return;
    }


    /*
    -----------------------------------------
    Make settings globally available
    -----------------------------------------
    */

    window.SOCMINT_SETTINGS =
        settings;

    applySOCMINTTheme(settings.theme);

    updateSettingsStatus("Settings saved successfully.");

    if (settings.notifications && "Notification" in window && Notification.permission === "default") {
        try {
            Promise.resolve(Notification.requestPermission()).then(permission => {
                if (permission !== "granted") {
                    updateSettingsStatus("Preferences saved, but browser notifications were not permitted.");
                }
            }).catch(error => {
                updateSettingsStatus(`Preferences saved, but notification permission failed: ${error.message}`);
            });
        } catch (error) {
            updateSettingsStatus(`Preferences saved, but notification permission failed: ${error.message}`);
        }
    } else if (settings.notifications && "Notification" in window && Notification.permission === "denied") {
        updateSettingsStatus("Preferences saved, but notifications are blocked by this browser's permission settings.");
    } else if (settings.notifications && !("Notification" in window)) {
        updateSettingsStatus("Preferences saved, but this browser does not support notifications.");
    }


    /*
    -----------------------------------------
    Notify other scripts
    -----------------------------------------
    */

    window.dispatchEvent(
        new CustomEvent(
            "socmintSettingsChanged",
            {
                detail: settings
            }
        )
    );
}


/*
=====================================================
RESET SETTINGS
=====================================================
*/

function resetSettings() {

    const confirmed =
        window.confirm(
            "Reset all SOCMINT-X settings to default?"
        );


    if (!confirmed) {

        return;

    }


    if (!writeSOCMINTSettings(SOCMINT_DEFAULT_SETTINGS)) {
        updateSettingsStatus("Settings could not be reset because browser storage is unavailable.");
        return;
    }


    loadSettings();


    window.SOCMINT_SETTINGS =
        {
            ...SOCMINT_DEFAULT_SETTINGS
        };

    applySOCMINTTheme(SOCMINT_DEFAULT_SETTINGS.theme);

    window.dispatchEvent(
        new CustomEvent(
            "socmintSettingsChanged",
            {
                detail:
                    SOCMINT_DEFAULT_SETTINGS
            }
        )
    );


    updateSettingsStatus(
        "Settings restored to default."
    );
}


/*
=====================================================
SAVE BUTTON
=====================================================
*/

function initializeSaveButton() {

    const button =
        document.getElementById(
            "saveSettingsButton"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        saveSettings
    );
}


/*
=====================================================
RESET BUTTON
=====================================================
*/

function initializeResetButton() {

    const button =
        document.getElementById(
            "resetSettingsButton"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        resetSettings
    );
}


/*
=====================================================
TOGGLE CONTROLS
=====================================================
*/

function initializeToggleControls() {

    const controls =
        document.querySelectorAll(
            "[data-setting]"
        );


    controls.forEach(
        (control) => {

            control.addEventListener(
                "change",
                () => {

                    const setting =
                        control.dataset.setting;


                    if (!setting) {

                        return;

                    }


                    /*
                    ---------------------------------
                    Do not automatically save.
                    User explicitly clicks Save.
                    ---------------------------------
                    */

                    updateSettingsStatus(
                        "Unsaved changes."
                    );

                }
            );

        }
    );
}


/*
=====================================================
CHECKBOX HELPERS
=====================================================
*/

function setCheckbox(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element &&
        element.type === "checkbox"
    ) {

        element.checked =
            Boolean(value);

    }
}


function getCheckbox(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (
        !element ||
        element.type !== "checkbox"
    ) {

        return false;

    }


    return element.checked;
}


/*
=====================================================
VALUE HELPERS
=====================================================
*/

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value;

    }
}


function getNumber(
    id,
    fallback
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return fallback;

    }

    const value =
        Number(
            element.value
        );


    if (
        Number.isNaN(value)
    ) {

        return fallback;

    }


    return value;
}

function normalizeSOCMINTSettings(settings) {
    return {
        autoRefresh: settings.autoRefresh === true,
        notifications: settings.notifications === true,
        liveFeed: settings.liveFeed !== false,
        sentimentAnalysis: settings.sentimentAnalysis !== false,
        reportExport: settings.reportExport !== false,
        maxResults: Math.max(1, Math.min(50, Math.trunc(Number(settings.maxResults) || SOCMINT_DEFAULT_SETTINGS.maxResults))),
        refreshInterval: Math.max(10, Math.min(3600, Math.trunc(Number(settings.refreshInterval) || SOCMINT_DEFAULT_SETTINGS.refreshInterval))),
        theme: settings.theme === "light" ? "light" : "dark"
    };
}

function readSOCMINTSettings() {
    try {
        const stored = localStorage.getItem("socmint_settings");
        const parsed = stored ? JSON.parse(stored) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Stored preferences are not an object.");
        }
        if (parsed.reportExport === undefined && parsed.aiReports !== undefined) {
            parsed.reportExport = parsed.aiReports;
        }
        return normalizeSOCMINTSettings({
            ...SOCMINT_DEFAULT_SETTINGS,
            ...parsed
        });
    } catch (error) {
        console.error("Unable to load settings:", error);
        return { ...SOCMINT_DEFAULT_SETTINGS };
    }
}

function writeSOCMINTSettings(settings) {
    try {
        localStorage.setItem("socmint_settings", JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent("socmintSettingsChanged", { detail: settings }));
        return true;
    } catch (error) {
        console.error("Unable to save settings:", error);
        return false;
    }
}

function applySOCMINTTheme(theme) {
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}


/*
=====================================================
STATUS
=====================================================
*/

function updateSettingsStatus(
    message
) {

    const element =
        document.getElementById(
            "settingsStatus"
        );


    if (element) {

        element.textContent =
            message;

    }
}


/*
=====================================================
BROWSER API KEYS
=====================================================
*/

const SOCMINT_API_KEY_FIELDS = [
    {
        name: "YOUTUBE_API_KEY",
        label: "YouTube Data API",
        description: "Searches public YouTube videos."
    },
    {
        name: "GNEWS_API_KEY",
        label: "GNews",
        description: "Searches public news articles."
    },
    {
        name: "HUGGINGFACE_API_KEY",
        label: "Hugging Face",
        description: "Classifies sentiment for returned records."
    },
    {
        name: "GEMINI_API_KEY",
        label: "Google Gemini",
        description: "Creates a cited synthesis and cautious, approximate map estimates for explicitly named places in returned records."
    }
];

function initializeApiKeySettings() {
    const keyForm = document.getElementById("apiKeyForm");
    keyForm?.addEventListener("submit", async event => {
        event.preventDefault();
        const keys = {};
        SOCMINT_API_KEY_FIELDS.forEach(field => {
            const input = document.getElementById(`key-${field.name}`);
            const value = input?.value.trim() || "";
            if (value) {
                keys[field.name] = value;
            }
        });

        const saveButton = document.getElementById("saveApiKeysButton");
        if (saveButton) saveButton.disabled = true;
        try {
            localStorage.setItem(SOCMINT_API_KEYS_STORAGE_KEY, JSON.stringify(keys));
            setApiKeyStatus("API keys saved in this browser. They will be used for your next scan.", "success");
        } catch (error) {
            console.error("Unable to save browser API keys:", error);
            setApiKeyStatus("API keys could not be saved. Check this browser's storage settings.", "error");
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    });

    document.getElementById("clearApiKeysButton")?.addEventListener("click", () => {
        try {
            localStorage.removeItem(SOCMINT_API_KEYS_STORAGE_KEY);
            SOCMINT_API_KEY_FIELDS.forEach(field => {
                const input = document.getElementById(`key-${field.name}`);
                if (input) input.value = "";
            });
            setApiKeyStatus("Browser API keys removed.", "success");
        } catch (error) {
            console.error("Unable to remove browser API keys:", error);
            setApiKeyStatus("API keys could not be removed. Check this browser's storage settings.", "error");
        }
    });

    renderApiKeySettings();
}

function renderApiKeySettings() {
    const fields = document.getElementById("apiKeyFields");
    if (!fields) return;

    const savedKeys = window.getSOCMINTApiKeys();
    fields.textContent = "";
    SOCMINT_API_KEY_FIELDS.forEach(field => {
        const row = document.createElement("section");
        row.className = "api-key-card";

        const label = document.createElement("label");
        label.className = "field-label";
        label.htmlFor = `key-${field.name}`;
        label.textContent = field.label;

        const description = document.createElement("p");
        description.className = "key-description";
        description.textContent = field.description;

        const input = document.createElement("input");
        input.className = "api-key-input";
        input.id = `key-${field.name}`;
        input.name = field.name;
        input.type = "password";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.placeholder = "Paste API key";
        input.value = savedKeys[field.name] || "";

        row.append(label, description, input);
        fields.appendChild(row);
    });
    setApiKeyStatus(
        Object.keys(savedKeys).length
            ? "Saved keys are stored only in this browser."
            : "No browser API keys saved yet.",
        ""
    );
}

function setApiKeyStatus(message, state) {
    const status = document.getElementById("apiKeyStatus");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.classList.toggle("error", state === "error");
    status.classList.toggle("success", state === "success");
}


/*
=====================================================
GLOBAL SETTINGS ACCESS
=====================================================
*/

window.getSOCMINTSettings =
    function () {

        return readSOCMINTSettings();

    };


/*
=====================================================
INITIAL GLOBAL SETTINGS
=====================================================
*/

window.SOCMINT_SETTINGS =
    window.getSOCMINTSettings();

applySOCMINTTheme(window.SOCMINT_SETTINGS.theme);