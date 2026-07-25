import { renderByType } from "./renderers.js";

const REGION_COOKIE_NAME = "enabled_regions";

function readAppData() {
    const raw = document.getElementById("app-data")?.textContent;
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function setToggleState(toggle, isEnabled) {
    toggle.dataset.enabled = isEnabled ? "true" : "false";
    toggle.classList.toggle("disabled", !isEnabled);
    toggle.setAttribute("aria-pressed", isEnabled ? "true" : "false");
}

function readRegionCookie() {
    const cookieEntry = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${REGION_COOKIE_NAME}=`));

    if (!cookieEntry) {
        return [];
    }

    const rawValue = cookieEntry.slice(REGION_COOKIE_NAME.length + 1);
    const decoded = decodeURIComponent(rawValue || "");
    return decoded
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
}

function writeRegionCookie(enabledCsv) {
    if (!enabledCsv) {
        document.cookie = `${REGION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
        return;
    }

    document.cookie =
        `${REGION_COOKIE_NAME}=${encodeURIComponent(enabledCsv)}; ` +
        "path=/; max-age=31536000; samesite=lax";
}

function getEnabledRegions(toggles) {
    return toggles
        .filter((toggle) => toggle.dataset.enabled === "true")
        .map((toggle) => toggle.dataset.regionName)
        .filter(Boolean);
}

function getSelectedGuideIndex(items) {
    const selectedFromUrl = Number.parseInt(new URL(window.location.href).searchParams.get("item") || "", 10);
    if (Number.isNaN(selectedFromUrl) || selectedFromUrl < 0 || selectedFromUrl >= items.length) {
        return -1;
    }
    return selectedFromUrl;
}

function markActiveGuide(guideLinks, selectedIndex) {
    guideLinks.forEach((link) => {
        const index = Number.parseInt(link.dataset.guideIndex || "", 10);
        link.classList.toggle("active", index === selectedIndex);
    });
}

async function loadGuideData(fileName, cache, baseUrl) {
    if (cache.has(fileName)) {
        return cache.get(fileName);
    }

    const response = await fetch(`${baseUrl}data/${fileName}`);
    if (!response.ok) {
        throw new Error(`Could not load ${fileName}`);
    }

    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON in ${fileName}`);
    }

    cache.set(fileName, parsed);
    return parsed;
}

function renderEmpty(contentPane) {
    contentPane.innerHTML = `
    <h1>Select an item to begin</h1>
    <p class="muted">Click one of the elements in the left menu to open its content view.</p>
  `;
}

async function renderSelectedGuide({ items, contentPane, enabledRegionNames, selectedIndex, cache, sortMode, regionImageByName, baseUrl }) {
    if (selectedIndex < 0 || selectedIndex >= items.length) {
        renderEmpty(contentPane);
        return;
    }

    const selectedItem = items[selectedIndex];

    try {
        const data = await loadGuideData(selectedItem.file, cache, baseUrl);
        contentPane.innerHTML = renderByType({
            selectedItem,
            data,
            enabledRegionNames,
            sortMode,
            regionImageByName,
            baseUrl,
        });
    } catch (error) {
        contentPane.innerHTML = `
      <h1>${selectedItem.name}</h1>
      <p class="muted">${error instanceof Error ? error.message : "Failed to render guide."}</p>
    `;
    }
}

function initializeRegions(toggles, defaultRegionNames) {
    const cookieRegions = readRegionCookie();
    if (cookieRegions.length === 0) {
        return defaultRegionNames;
    }

    const cookieSet = new Set(cookieRegions);
    toggles.forEach((toggle) => {
        const name = toggle.dataset.regionName;
        setToggleState(toggle, Boolean(name && cookieSet.has(name)));
    });

    return cookieRegions;
}

async function start() {
    const appData = readAppData();
    if (!appData) {
        return;
    }

    const toggles = Array.from(document.querySelectorAll("[data-region-name]"));
    const guideLinks = Array.from(document.querySelectorAll(".guide-link"));
    const contentPane = document.getElementById("content-pane");
    if (!contentPane) {
        return;
    }

    const dataCache = new Map();
    const baseUrl = appData.baseUrl || "/";
    let sortMode = "default";
    const defaultRegionNames = appData.regions.filter((region) => !!region.default).map((region) => region.name);
    const regionImageByName = Object.fromEntries(
        appData.regions.map((region) => [region.name, region.image || ""]),
    );
    initializeRegions(toggles, defaultRegionNames);

    const sync = async () => {
        const enabledRegionNames = getEnabledRegions(toggles);
        const enabledCsv = enabledRegionNames.join(",");
        writeRegionCookie(enabledCsv);
        contentPane.dataset.enabledRegions = enabledCsv;

        const selectedIndex = getSelectedGuideIndex(appData.items);
        markActiveGuide(guideLinks, selectedIndex);
        await renderSelectedGuide({
            items: appData.items,
            contentPane,
            enabledRegionNames,
            selectedIndex,
            cache: dataCache,
            sortMode,
            regionImageByName,
            baseUrl,
        });

        const sortSelect = contentPane.querySelector("[data-sort-select]");
        if (sortSelect instanceof HTMLSelectElement) {
            sortSelect.value = sortMode;
            sortSelect.addEventListener("change", async () => {
                sortMode = sortSelect.value === "available" ? "available" : "default";
                await sync();
            });
        }
    };

    toggles.forEach((toggle) => {
        toggle.addEventListener("click", async () => {
            const isEnabled = toggle.dataset.enabled === "true";
            setToggleState(toggle, !isEnabled);
            await sync();
        });
    });

    await sync();
}

start();
