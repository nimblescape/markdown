// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The templates of a layout (docs/rendering.md, R-LAYOUT-001): HTML files of the fixed pages, for example the cover
// page, and the pattern of the name of the PDF file, with the fields of the front matter. A template holds no script
// and no logic: `{{title}}` is the value of the field `title`, `{{#subtitle}}…{{/subtitle}}` shows only when the field
// `subtitle` has a value, and `{{^subtitle}}…{{/subtitle}}` only when it has none.

/**
 * escapeHtml returns a text with the characters that HTML reads as markup written as entities.
 * @param text - The text.
 */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** section matches a section of a template, `{{#name}}…{{/name}}` or `{{^name}}…{{/name}}`, without a nested one of the same name. */
const section = /\{\{([#^])\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g;

/** placeholder matches a field of a template, `{{name}}`. */
const placeholder = /\{\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}\}/g;

/**
 * fill returns a template with the values of the fields. A field without a value gives an empty text.
 * @param template - The template.
 * @param values - The values of the fields.
 * @param escape - The function that writes a value into the template; HTML templates escape it.
 */
export function fill(template: string, values: Readonly<Record<string, string>>, escape: (value: string) => string = escapeHtml): string {
  let text = template;
  // Sections can contain other sections; each round removes the innermost ones.
  for (let round = 0; round < 8; round++) {
    const next = text.replace(section, (_all, kind: string, name: string, body: string) => {
      const has = (values[name] ?? '').trim() !== '';
      return (kind === '#') === has ? body : '';
    });
    if (next === text) {
      break;
    }
    text = next;
  }
  return text.replace(placeholder, (_all, name: string) => escape(values[name] ?? ''));
}

/**
 * fileName returns a value as a part of a file name: without accents, with "-" for spaces, and only with letters,
 * digits, "-", "_" and ".".
 * @param value - The value.
 */
export const fileName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');

/**
 * pdfNameOf returns the name of the PDF file of a document from the pattern of its layout, with ".pdf". Parts of the
 * name that are empty because a field has no value fall away with their separator; when no field has a value, the
 * name of the Markdown file is the name.
 * @param pattern - The pattern of the layout, for example `{{matrikelnummer}}_{{author}}`.
 * @param values - The values of the fields; `file` is the name of the Markdown file without its extension.
 */
export function pdfNameOf(pattern: string, values: Readonly<Record<string, string>>): string {
  const name = fill(pattern, values, fileName)
    .replace(/[_-]{2,}/g, (separators) => separators[0])
    .replace(/^[_.-]+|[_.-]+$/g, '');
  return `${name === '' ? fileName(values.file ?? 'document') || 'document' : name}.pdf`;
}
