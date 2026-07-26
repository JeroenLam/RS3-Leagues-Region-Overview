function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function uniquePush(list, value) {
    if (!list.includes(value)) {
        list.push(value);
    }
}

function parseRegionExpression(region) {
    if (typeof region === "string" && region.trim()) {
        return { kind: "region", name: region.trim() };
    }

    if (!region) {
        return { kind: "none" };
    }

    if (Array.isArray(region)) {
        // Legacy format: top-level OR, nested array means AND.
        const choices = region
            .map((part) => {
                if (typeof part === "string" && part.trim()) {
                    return { kind: "region", name: part.trim() };
                }

                if (Array.isArray(part)) {
                    const andChildren = part
                        .map((value) => parseRegionExpression(value))
                        .filter((value) => value.kind !== "none");
                    if (andChildren.length > 0) {
                        return { kind: "all-of", children: andChildren };
                    }
                }

                return { kind: "none" };
            })
            .filter((value) => value.kind !== "none");

        if (choices.length === 0) {
            return { kind: "none" };
        }
        if (choices.length === 1) {
            return choices[0];
        }
        return { kind: "any-of", children: choices };
    }

    if (typeof region === "object") {
        if (Array.isArray(region.anyOf)) {
            const anyChildren = region.anyOf
                .map((value) => parseRegionExpression(value))
                .filter((value) => value.kind !== "none");
            if (anyChildren.length > 0) {
                if (anyChildren.length === 1) {
                    return anyChildren[0];
                }
                return { kind: "any-of", children: anyChildren };
            }
        }

        if (Array.isArray(region.allOf)) {
            const allChildren = region.allOf
                .map((value) => parseRegionExpression(value))
                .filter((value) => value.kind !== "none");
            if (allChildren.length > 0) {
                if (allChildren.length === 1) {
                    return allChildren[0];
                }
                return { kind: "all-of", children: allChildren };
            }
        }
    }

    return { kind: "none" };
}

function flattenRegions(regionInput) {
    const expression = parseRegionExpression(regionInput);
    const allNames = [];

    const visit = (node) => {
        if (node.kind === "region") {
            uniquePush(allNames, node.name);
            return;
        }
        if (node.kind === "any-of" || node.kind === "all-of") {
            node.children.forEach((child) => visit(child));
        }
    };

    visit(expression);

    return allNames;
}

function formatRegionExpressionText(regionInput) {
    const expression = parseRegionExpression(regionInput);

    const renderNode = (node, parentKind = null) => {
        if (node.kind === "none") {
            return "";
        }

        if (node.kind === "region") {
            return node.name;
        }

        const separator = node.kind === "any-of" ? " / " : " & ";
        const inner = node.children
            .map((child) => renderNode(child, node.kind))
            .filter(Boolean)
            .join(separator);

        if (!inner) {
            return "";
        }

        if (parentKind) {
            return `(${inner})`;
        }

        return inner;
    };

    return renderNode(expression) || "Unknown";
}

function toDefaultEntries(rawData) {
    return Object.entries(rawData || {});
}

function assetUrl(baseUrl, relativePath) {
    return `${baseUrl}${relativePath}`;
}

function renderRegionRequirementIcons(entry, regionImageByName, enabledRegionSet, baseUrl) {
    const expression = parseRegionExpression(entry?.region);
    if (expression.kind === "none") {
        return "<span class=\"muted\">-</span>";
    }

    const renderIcon = (regionName) => {
        const imageName = regionImageByName?.[regionName] || "";
        const selectedClass = enabledRegionSet.has(regionName) ? " region-mini-selected" : "";
        if (imageName) {
            const imagePath = assetUrl(baseUrl, `images/${encodeURIComponent(imageName)}`);
            return `<img class=\"region-mini-icon${selectedClass}\" src=\"${imagePath}\" alt=\"${escapeHtml(regionName)}\" title=\"${escapeHtml(regionName)}\" loading=\"lazy\" onerror=\"this.style.display='none'\" />`;
        }

        const fallback = regionName.slice(0, 2).toUpperCase();
        return `<span class=\"region-mini-fallback${selectedClass}\" title=\"${escapeHtml(regionName)}\">${escapeHtml(fallback)}</span>`;
    };

    const renderOrGroup = (group) => {
        const icons = group.map((regionName) => renderIcon(regionName)).join("");
        return `<span class=\"region-group\">${icons}</span>`;
    };

    const renderNode = (node, parentKind = null) => {
        if (node.kind === "region") {
            return renderOrGroup([node.name]);
        }

        if (node.kind === "none") {
            return "";
        }

        const separator = node.kind === "any-of"
            ? '<span class="region-or">/</span>'
            : '<span class="region-and">&amp;</span>';
        const inner = node.children
            .map((child) => renderNode(child, node.kind))
            .filter(Boolean)
            .join(separator);

        if (!inner) {
            return "";
        }

        if (parentKind && (node.kind === "any-of" || node.kind === "all-of")) {
            return `<span class=\"region-bracket\">(</span>${inner}<span class=\"region-bracket\">)</span>`;
        }

        return inner;
    };

    return `<div class=\"region-expression\">${renderNode(expression)}</div>`;
}

function getAvailability(entry, enabledRegionSet) {
    const expression = parseRegionExpression(entry?.region);
    if (expression.kind === "none") {
        return "available";
    }

    const evaluate = (node) => {
        if (node.kind === "none") {
            return "full";
        }

        if (node.kind === "region") {
            return enabledRegionSet.has(node.name) ? "full" : "none";
        }

        const childStates = node.children.map((child) => evaluate(child));

        if (node.kind === "any-of") {
            if (childStates.includes("full")) {
                return "full";
            }
            if (childStates.includes("partial")) {
                return "partial";
            }
            return "none";
        }

        // all-of
        if (childStates.every((state) => state === "full")) {
            return "full";
        }
        if (childStates.every((state) => state === "none")) {
            return "none";
        }
        return "partial";
    };

    const state = evaluate(expression);
    if (state === "full") {
        return "available";
    }
    if (state === "partial") {
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

function levelTimeline(entry, isUnlocked) {
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
        <div class="level-timeline ${isUnlocked ? "" : "level-timeline-locked"}" title="Level ${min} to ${max}">
            <div class="level-track"></div>
            <div class="level-fill" style="left:${left}%; width:${Math.max(width, 2)}%;"></div>
        </div>
    `;
}

function levelRangeText(entry) {
    const start = typeof entry.level_start === "number" ? entry.level_start : null;
    const end = typeof entry.level_end === "number" ? entry.level_end : null;
    if (start === null || end === null) {
        return "-";
    }

    const min = Math.max(1, Math.min(start, end));
    const max = Math.max(1, Math.max(start, end));
    return `${min}-${max}`;
}

function renderSkillTable({ selectedItem, entries, enabledRegionSet, sortMode, regionImageByName, baseUrl }) {
    const orderedEntries = getEntriesBySort(entries, sortMode, enabledRegionSet);

    const rows = orderedEntries
        .map(([name, entry]) => {
            const availability = getAvailability(entry, enabledRegionSet);
            const image = entry.image ? assetUrl(baseUrl, `images/${encodeURIComponent(entry.image)}`) : "";
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
                    <td>${renderRegionRequirementIcons(entry, regionImageByName, enabledRegionSet, baseUrl)}</td>
                    <td>${escapeHtml(levelRangeText(entry))}</td>
                    <td>${levelTimeline(entry, availability === "available")}</td>
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
                <table class="guide-table skill-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Image</th>
                            <th>Unlocked</th>
                            <th>Regions</th>
                            <th>Level Range</th>
                            <th>Level Graph</th>
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

function renderBossTable({ selectedItem, entries, enabledRegionSet, sortMode, baseUrl }) {
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
        const image = entry.image ? assetUrl(baseUrl, `images/${encodeURIComponent(entry.image)}`) : "";
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
            <div class="table-wrap ${hasSelectedRegions ? "" : "regionless"} ${escapeHtml(selectedItem.render_type || "")}-view">
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

function getGearLevel(entry) {
    return typeof entry.level === "number" ? entry.level : -1;
}

function getGearBucketKey(entry) {
    const level = getGearLevel(entry);
    if (level < 0) {
        return "0-9";
    }

    const start = Math.max(0, Math.min(90, Math.floor(level / 10) * 10));
    const end = start + 9;
    return `${start}-${end}`;
}

function getGearEntriesBySort(entries, sortMode, enabledRegionSet) {
    const withIndex = entries.map(([name, entry], index) => ({ name, entry, index }));
    const byLevel = (left, right) => {
        const levelDiff = getGearLevel(left.entry) - getGearLevel(right.entry);
        if (levelDiff !== 0) {
            return levelDiff;
        }
        return left.index - right.index;
    };

    if (sortMode === "available") {
        const buckets = {
            available: [],
            almost: [],
            not: [],
        };

        withIndex.forEach((item) => {
            const availability = getAvailability(item.entry, enabledRegionSet);
            buckets[availability].push(item);
        });

        return [
            ...buckets.available.sort(byLevel),
            ...buckets.almost.sort(byLevel),
            ...buckets.not.sort(byLevel),
        ];
    }

    return withIndex.sort(byLevel);
}

function renderGearTable({ selectedItem, entries, enabledRegionSet, sortMode, baseUrl }) {
    const orderedEntries = getGearEntriesBySort(entries, sortMode, enabledRegionSet);
    const levelBuckets = Array.from({ length: 10 }, (_, index) => `${index * 10}-${index * 10 + 9}`);
    const hasSelectedRegions = enabledRegionSet.size > 0;
    const typeOrder = [];
    const itemsByType = new Map();

    orderedEntries.forEach((item) => {
        const typeName = typeof item.entry.type === "string" && item.entry.type.trim() ? item.entry.type.trim() : "Other";
        if (!itemsByType.has(typeName)) {
            itemsByType.set(typeName, []);
            typeOrder.push(typeName);
        }
        itemsByType.get(typeName).push(item);
    });

    const headerCells = levelBuckets.map((bucket) => `<th>${bucket}</th>`).join("");
    const tables = typeOrder
        .map((typeName) => {
            const statusRows = new Map([
                ["Unlocked", Object.fromEntries(levelBuckets.map((bucket) => [bucket, []]))],
                ["Locked", Object.fromEntries(levelBuckets.map((bucket) => [bucket, []]))],
            ]);

            itemsByType.get(typeName).forEach(({ name, entry }) => {
                const bucket = getGearBucketKey(entry);
                const availability = getAvailability(entry, enabledRegionSet);
                const rowKey = availability === "available" ? "Unlocked" : "Locked";
                const image = entry.image ? assetUrl(baseUrl, `images/${encodeURIComponent(entry.image)}`) : "";
                const source = entry.source ? String(entry.source) : "Unknown source";
                const regionText = formatRegionExpressionText(entry.region);
                const itemHtml = `
                    <div class="bucket-item gear-bucket-item availability-${availability}">
                        <div class="gear-bucket-image">
                            ${image ? `<img class="bucket-icon" src="${image}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'" />` : "<span>?</span>"}
                        </div>
                        <div class="gear-tooltip" role="tooltip">
                            <strong>${escapeHtml(name)}</strong><br />
                            ${escapeHtml(source)}<br />
                            ${escapeHtml(regionText)}
                        </div>
                    </div>
                `;

                statusRows.get(rowKey)[bucket].push(itemHtml);
            });

            const rows = ["Unlocked", "Locked"]
                .map((rowName) => {
                    const row = statusRows.get(rowName);
                    const bucketCells = levelBuckets
                        .map((bucket) => `<td><div class="bucket-list">${row[bucket].join("")}</div></td>`)
                        .join("");

                    return `
                        <tr>
                            <td>${escapeHtml(rowName)}</td>
                            ${bucketCells}
                        </tr>
                    `;
                })
                .join("");

            return `
                <section class="gear-type-section">
                    <h2 class="gear-type-heading">${escapeHtml(typeName)}</h2>
                    <div class="table-wrap ${hasSelectedRegions ? "" : "regionless"} gear-view">
                        <table class="guide-table gear-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    ${headerCells}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </section>
            `;
        })
        .join("");

    const noItems = tables.trim().length === 0;

    return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        ${renderSortControls(sortMode)}
        ${noItems ? `<p class="muted">No entries found.</p>` : tables}
    `;
}

export function renderByType({ selectedItem, data, enabledRegionNames, sortMode, regionImageByName, baseUrl = "/" }) {
    const entries = toDefaultEntries(data);
    const enabledSet = new Set(enabledRegionNames);

    switch (selectedItem.render_type) {
        case "":
            return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        <p class="muted">Work in progress, this page is not yet implemented</p>
      `;
        case "skill":
            return renderSkillTable({
                selectedItem,
                entries,
                enabledRegionSet: enabledSet,
                sortMode,
                regionImageByName,
                baseUrl,
            });
        case "boss":
            return renderBossTable({ selectedItem, entries, enabledRegionSet: enabledSet, sortMode, baseUrl });
        case "gear":
            return renderGearTable({ selectedItem, entries, enabledRegionSet: enabledSet, sortMode, baseUrl });
        default:
            return `
        <h1>${escapeHtml(selectedItem.name)}</h1>
        <h1>${escapeHtml(selectedItem.file)}</h1>
        ${renderSortControls(sortMode)}
        <p class="muted">Debug renderer enabled. Render type: ${escapeHtml(selectedItem.render_type || "unknown")}</p>
      `;
    }
}
