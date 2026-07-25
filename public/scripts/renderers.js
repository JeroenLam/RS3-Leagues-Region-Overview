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

function toDefaultEntries(rawData) {
    return Object.entries(rawData || {});
}

function normalizeRegionRequirements(region) {
    if (!Array.isArray(region)) {
        return [];
    }

    const requirements = [];
    region.forEach((part) => {
        if (typeof part === "string" && part.trim()) {
            requirements.push([part.trim()]);
            return;
        }

        if (Array.isArray(part)) {
            const options = part
                .map((option) => (typeof option === "string" ? option.trim() : ""))
                .filter(Boolean);
            if (options.length > 0) {
                requirements.push(options);
            }
        }
    });

    return requirements;
}

function renderRegionRequirementIcons(entry, regionImageByName) {
    const requirements = normalizeRegionRequirements(entry?.region);
    if (requirements.length === 0) {
        return "<span class=\"muted\">-</span>";
    }

    const groups = requirements.map((group) => {
        const icons = group
            .map((regionName) => {
                const imageName = regionImageByName?.[regionName] || "";
                if (imageName) {
                    const imagePath = `/images/${encodeURIComponent(imageName)}`;
                    return `<img class=\"region-mini-icon\" src=\"${imagePath}\" alt=\"${escapeHtml(regionName)}\" title=\"${escapeHtml(regionName)}\" loading=\"lazy\" onerror=\"this.style.display='none'\" />`;
                }

                const fallback = regionName.slice(0, 2).toUpperCase();
                return `<span class=\"region-mini-fallback\" title=\"${escapeHtml(regionName)}\">${escapeHtml(fallback)}</span>`;
            })
            .join("");

        return `<span class=\"region-group\">${icons}</span>`;
    });

    return `<div class=\"region-expression\">${groups.join('<span class="region-or">/</span>')}</div>`;
}

function getAvailability(entry, enabledRegionSet) {
    const requirements = normalizeRegionRequirements(entry?.region);
    if (requirements.length === 0) {
        return "available";
    }

    let hasPartial = false;
    for (const optionGroup of requirements) {
        const matchedCount = optionGroup.filter((name) => enabledRegionSet.has(name)).length;

        if (matchedCount === optionGroup.length) {
            return "available";
        }

        if (matchedCount > 0) {
            hasPartial = true;
        }
    }

    if (hasPartial) {
        return "almost";
    }
    return "not";
}

function sortByAvailability(entries, enabledRegionSet) {
    const buckets = {
        available: [],
        almost: [],
        not: [],
    };

    entries.forEach(([name, entry]) => {
        const availability = getAvailability(entry, enabledRegionSet);
        buckets[availability].push([name, entry]);
    });

    return [
        ...buckets.available,
        ...buckets.almost,
        ...buckets.not,
    ];
}

function getEntriesBySort(entries, sortMode, enabledRegionSet) {
    if (sortMode === "available") {
        return sortByAvailability(entries, enabledRegionSet);
    }
    return entries;
}

function renderSortControls(sortMode) {
    return `
        <div class="sort-controls">
            <label for="sort-mode" class="sort-label">Sorting</label>
            <select id="sort-mode" class="sort-select" data-sort-select>
                <option value="default" ${sortMode === "default" ? "selected" : ""}>Default</option>
                <option value="available" ${sortMode === "available" ? "selected" : ""}>Available</option>
            </select>
        </div>
    `;
}

function availabilityDot(availability) {
    if (availability === "available") {
        return "🟢";
    }
    if (availability === "almost") {
        return "🟡";
    }
    return "🔴";
}

function levelTimeline(entry) {
    const start = typeof entry.level_start === "number" ? entry.level_start : null;
    const end = typeof entry.level_end === "number" ? entry.level_end : null;
    if (start === null || end === null) {
        return "<span class=\"muted\">-</span>";
    }

    const min = Math.max(1, Math.min(start, end));
    const max = Math.max(1, Math.max(start, end));
    const maxLevel = 120;
    const left = ((min - 1) / (maxLevel - 1)) * 100;
    const width = ((max - min) / (maxLevel - 1)) * 100;

    return `
        <div class="level-timeline" title="Level ${min} to ${max}">
            <div class="level-track"></div>
            <div class="level-fill" style="left:${left}%; width:${Math.max(width, 2)}%;"></div>
            <span class="level-label">${min}-${max}</span>
        </div>
    `;
}

function renderSkillTable({ selectedItem, entries, enabledRegionSet, sortMode, regionImageByName }) {
    const orderedEntries = getEntriesBySort(entries, sortMode, enabledRegionSet);

    const rows = orderedEntries
        .map(([name, entry]) => {
            const availability = getAvailability(entry, enabledRegionSet);
            const image = entry.image ? `/images/${encodeURIComponent(entry.image)}` : "";
            const flatRegions = flattenRegions(entry.region).join(", ");
            const hoverText = entry.hover_text ? String(entry.hover_text) : "No note";
            const title = `Regions: ${flatRegions || "None"} | ${hoverText}`;

            return `
                <tr>
                    <td>${escapeHtml(name)}</td>
                    <td>
                        ${image ? `<img class="table-item-icon" src="${image}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'" />` : "-"}
                    </td>
                    <td class="status-cell" title="${escapeHtml(title)}">${availabilityDot(availability)}</td>
                    <td>${renderRegionRequirementIcons(entry, regionImageByName)}</td>
                    <td>${levelTimeline(entry)}</td>
                </tr>
            `;
        })
        .join("");

    const noItems = rows.trim().length === 0;

    return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        ${renderSortControls(sortMode)}
        ${noItems ? `<p class="muted">No entries found.</p>` : `
            <div class="table-wrap">
                <table class="guide-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Image</th>
                            <th>Unlocked</th>
                            <th>Regions</th>
                            <th>Level Range</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `}
    `;
}

function getPhaseBucket(entry) {
    const tier = typeof entry.tier === "number" ? entry.tier : 1;
    if (tier <= 1) {
        return "early";
    }
    if (tier === 2) {
        return "mid";
    }
    if (tier === 3) {
        return "late";
    }
    return "end";
}

function renderBossGearTable({ selectedItem, entries, enabledRegionSet, sortMode }) {
    const orderedEntries = getEntriesBySort(entries, sortMode, enabledRegionSet);
    const regionRowOrder = [];
    const regionRows = new Map();

    const ensureRegionRow = (regionName) => {
        if (!regionRows.has(regionName)) {
            regionRows.set(regionName, {
                early: [],
                mid: [],
                late: [],
                end: [],
            });
            regionRowOrder.push(regionName);
        }
        return regionRows.get(regionName);
    };

    orderedEntries.forEach(([name, entry]) => {
        const regions = flattenRegions(entry.region);
        if (regions.length === 0) {
            regions.push("Unknown");
        }
        const bucket = getPhaseBucket(entry);
        const availability = getAvailability(entry, enabledRegionSet);
        const image = entry.image ? `/images/${encodeURIComponent(entry.image)}` : "";
        const itemHtml = `
            <div class="bucket-item availability-${availability}" title="${escapeHtml(name)}">
                ${image ? `<img class="bucket-icon" src="${image}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'" />` : "<span>?</span>"}
            </div>
        `;

        regions.forEach((regionName) => {
            const row = ensureRegionRow(regionName);
            row[bucket].push(itemHtml);
        });
    });

    const hasSelectedRegions = enabledRegionSet.size > 0;
    const rows = regionRowOrder
        .map((regionName) => {
            const row = regionRows.get(regionName);
            return `
                <tr>
                    <td>${escapeHtml(regionName)}</td>
                    <td><div class="bucket-list">${row.early.join("")}</div></td>
                    <td><div class="bucket-list">${row.mid.join("")}</div></td>
                    <td><div class="bucket-list">${row.late.join("")}</div></td>
                    <td><div class="bucket-list">${row.end.join("")}</div></td>
                </tr>
            `;
        })
        .join("");

    const noItems = rows.trim().length === 0;

    return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        ${renderSortControls(sortMode)}
        ${noItems ? `<p class="muted">No entries found.</p>` : `
            <div class="table-wrap ${hasSelectedRegions ? "" : "regionless"}">
                <table class="guide-table phase-table">
                    <thead>
                        <tr>
                            <th>Region</th>
                            <th>Early game</th>
                            <th>Mid game</th>
                            <th>Late game</th>
                            <th>End game</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `}
    `;
}
export function renderByType({ selectedItem, data, enabledRegionNames, sortMode, regionImageByName }) {
    const entries = toDefaultEntries(data);
    const enabledSet = new Set(enabledRegionNames);

    switch (selectedItem.render_type) {
        case "skill":
            return renderSkillTable({
                selectedItem,
                entries,
                enabledRegionSet: enabledSet,
                sortMode,
                regionImageByName,
            });
        case "boss":
        case "gear":
            return renderBossGearTable({ selectedItem, entries, enabledRegionSet: enabledSet, sortMode });
        default:
            return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        <h1>${escapeHtml(selectedItem.file)}</h1>
        ${renderSortControls(sortMode)}
        <p class="muted">Debug renderer enabled. Render type: ${escapeHtml(selectedItem.render_type || "unknown")}</p>
      `;
    }
}
