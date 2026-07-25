function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function flattenRegions(input, result = []) {
    if (Array.isArray(input)) {
        input.forEach((value) => flattenRegions(value, result));
        return result;
    }
    if (typeof input === "string" && input.trim()) {
        result.push(input.trim());
    }
    return result;
}

function matchesEnabledRegions(entry, enabledRegionSet) {
    if (!entry || !entry.region) {
        return true;
    }
    const entryRegions = flattenRegions(entry.region);
    if (entryRegions.length === 0) {
        return true;
    }
    if (enabledRegionSet.size === 0) {
        return false;
    }
    return entryRegions.some((name) => enabledRegionSet.has(name));
}

function toSortedEntries(rawData) {
    return Object.entries(rawData || {}).sort((a, b) => {
        const aWeight = typeof a[1]?.sort_weight === "number" ? a[1].sort_weight : 0;
        const bWeight = typeof b[1]?.sort_weight === "number" ? b[1].sort_weight : 0;
        return aWeight - bWeight;
    });
}

function cardMetaForType(renderType, entry) {
    if (renderType === "skill") {
        if (typeof entry.level_start === "number" && typeof entry.level_end === "number") {
            return `Level ${entry.level_start} - ${entry.level_end}`;
        }
    }

    if (renderType === "boss") {
        if (typeof entry.tier === "number") {
            return `Boss tier ${entry.tier}`;
        }
    }

    if (renderType === "gear") {
        if (typeof entry.tier === "number") {
            return `Gear tier ${entry.tier}`;
        }
    }

    return "";
}

function renderCards({ selectedItem, data, enabledRegionNames }) {
    const renderType = selectedItem.render_type || "unknown";
    const enabledSet = new Set(enabledRegionNames);
    const visibleEntries = toSortedEntries(data).filter(([, entry]) =>
        matchesEnabledRegions(entry, enabledSet),
    );

    if (visibleEntries.length === 0) {
        return `
      <h1>${escapeHtml(selectedItem.name)}</h1>
      <p class="muted">No entries match your selected regions.</p>
    `;
    }

    const cards = visibleEntries
        .map(([name, entry]) => {
            const meta = cardMetaForType(renderType, entry);
            const image = entry.image ? `/images/${encodeURIComponent(entry.image)}` : "";
            const imageTag = image
                ? `<img class="guide-card-image" src="${image}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'" />`
                : `<div class="guide-card-image"></div>`;

            const hoverText = entry.hover_text ? `<p class="guide-card-text">${escapeHtml(entry.hover_text)}</p>` : "";
            const link = entry.link
                ? `<p class="guide-card-text"><a class="guide-card-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer">Open guide link</a></p>`
                : "";

            return `
        <article class="guide-card">
          ${imageTag}
          <div>
            <h2 class="guide-card-title">${escapeHtml(name)}</h2>
            ${meta ? `<p class="guide-card-meta">${escapeHtml(meta)}</p>` : ""}
            ${hoverText}
            ${link}
          </div>
        </article>
      `;
        })
        .join("");

    return `
    <h1>${escapeHtml(selectedItem.name)}</h1>
    <div class="guide-list">${cards}</div>
  `;
}

export function renderByType({ selectedItem, data, enabledRegionNames }) {
    switch (selectedItem.render_type) {
        case "skill":
        case "boss":
        case "gear":
            return renderCards({ selectedItem, data, enabledRegionNames });
        default:
            return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        <h1>${escapeHtml(selectedItem.file)}</h1>
        <p class="muted">Debug renderer enabled. Render type: ${escapeHtml(selectedItem.render_type || "unknown")}</p>
      `;
    }
}
