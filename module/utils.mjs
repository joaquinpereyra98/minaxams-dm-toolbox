/**
 * Convert a module namespace into a plain object.
 * Strips off default exports and meta-properties.
 *
 * @param {object} module - The imported module namespace.
 * @param {boolean} [includeDefault=false] - Whether to keep the default export.
 * @returns {object} A plain object with only named exports.
 */
export function moduleToObject(module, includeDefault = false) {
  const obj = {};
  for (const [key, value] of Object.entries(module)) {
    if (key === "default" && !includeDefault) continue;
    obj[key] = value;
  }
  return obj;
}

/**
 * Splits a flat boolean array into multiple rows, distributing elements as evenly
 * as possible while ensuring no row exceeds the given max size.
 * @param {Any[]} segments - A flat array of boolean values.
 * @returns {Any[][]}
 */
export function splitSegments(segments) {
  const total = segments.length;
  const rows = Math.ceil(total / 10);
  const base = Math.floor(total / rows);
  const extra = total % rows;
  const result = [];
  let index = 0;

  for (let i = 0; i < rows; i++) {
    const size = base + (i < extra ? 1 : 0);
    result.push(segments.slice(index, index + size));
    index += size;
  }

  return result;
}

/**
 * Helper to render checkbox list
 * @param {any[]} items
 * @param {string[]} selected
 * @param {string} name
 */
export function renderList(items, selected, name) {
  const elements = items.map(
    ({ value, label, icon }) => `
  <label class="flexrow">
    ${icon ? `<img class="skill-icon flex0" src="${icon}">` : ""}
    <span>${label}</span>
    <input class="flex0" type="checkbox" value="${value}" name="${name}" ${
      selected.includes(value) ? "checked" : ""
    }>
  </label>`
  );

  return elements.join("");
}

/**
 * Parses a height string written in feet and inches and converts it to meters.
 * @param {string} str - The height string to parse.
 * @returns {number} Height in meters.
 * @throws {Error} If the string cannot be interpreted as a valid height.
 */
export function parseHeight(str) {
  str = str
    .trim()
    .toLowerCase()
    .replace(/"/g, "in")
    .replace(/''/g, "in")
    .replace(/′/g, "'")
    .replace(/ft/g, "'")
    .replace(/in/g, "");

  const match = str.match(/(\d+)\s*'?\s*(\d+)?/);
  if (!match) throw new Error("Could not parse height: " + str);

  const feet = parseInt(match[1], 10);
  const inches = match[2] ? parseInt(match[2], 10) : 0;
  
  return feet + (inches / 12);
}
