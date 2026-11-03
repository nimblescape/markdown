// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The format of a layout (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-004): a folder, for example `layouts/plain/`, with
// the file `layout.json`, the style sheets of the pages, the templates of the fixed pages such as the cover page, and
// the fonts and images. The format is the format of the layout folder of nimblescape Markdown Paper, in the version
// that `formatVersion` names, so that its layouts work without a change. This file reads and checks `layout.json`,
// fills in the defaults of its language, and gives the JSON schema of the front matter of the documents of a layout
// (docs/editor.md, R-FM-004).

import type { JsonSchemaObject } from '@nimblescape/markdowntext';

/** formatName is the name of the format in the field `format` of `layout.json`. */
export const formatName = 'nimblescape-layout';

/**
 * formatVersion is the version of the format of the layout folder that this version reads. Version 1.1.0 adds the
 * field `frontMatterSchema` (docs/rendering.md, R-LAYOUT-001, proposal).
 */
export const formatVersion = { major: 1, minor: 1, patch: 0 };

/** formatText is the value of the field `format` that a new layout gets. */
export const formatText = `${formatName} ${formatVersion.major}.${formatVersion.minor}.${formatVersion.patch}`;

/** layoutFile is the name of the file of a layout folder that describes the layout. */
export const layoutFile = 'layout.json';

/** layoutName matches a valid name of a layout: the name of a folder. */
export const layoutName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** FieldSpec is a field of the front matter that the layout uses. */
export interface FieldSpec {
  /** description says what the field holds, for the form of the front matter and for the agents that write documents. */
  description: string;
  /** required is true when a document of the layout must have the field. */
  required: boolean;
  /** default is the value that the templates show when the document has no value. */
  default?: string;
  /**
   * values are the names that the author chooses from, for a field that names a variant of the layout; the style
   * sheets read the choice from the attribute `data-field-<field>` and keep how each variant looks to themselves.
   * undefined is a free value.
   */
  values?: string[];
}

/**
 * SectionCode is the code of a special section of a document: TOC the table of contents, LOF the list of figures, LOT
 * the list of tables, LOL the list of listings, BIB the reference list, ADT the affidavit, AST the abstract, ACC the
 * acknowledgments, FWD the foreword, and APX the appendix part with the appendices A, B, …. None of them gets a chapter
 * number, unless the layout says so, and the table of contents does not list itself.
 */
export type SectionCode = 'TOC' | 'LOF' | 'LOT' | 'LOL' | 'BIB' | 'ADT' | 'AST' | 'ACC' | 'FWD' | 'APX';

/** sectionCodes are the codes of the special sections. */
export const sectionCodes: readonly SectionCode[] = ['TOC', 'LOF', 'LOT', 'LOL', 'BIB', 'ADT', 'AST', 'ACC', 'FWD', 'APX'];

/** Terms are the words of a language that the layout writes or finds in the headings of a document. */
export interface Terms {
  /** sections are the headings of each special section; the first one is the one that a new document gets. */
  sections: Record<SectionCode, string[]>;
  /** figure is the word before the number of a figure, for example "Abbildung". */
  figure: string;
  /** table is the word before the number of a table, for example "Tabelle". */
  table: string;
  /** listing is the word before the number of a listing of source code, for example "Listing". */
  listing: string;
  /** appendix is the word before the letter of an appendix, for example "Anhang". */
  appendix: string;
}

/** Layout is a read layout, with the defaults of its language filled in. */
export interface Layout {
  /** id is the name of the folder of the layout, which the field `layout` of a front matter names. */
  id: string;
  /** folder is the URL of the folder of the layout, with a slash at its end. */
  folder: string;
  /** name is the name of the layout for people. */
  name: string;
  /** language is the language of the documents, a tag such as de-AT or en-US. */
  language: string;
  /** citationStyle is the citation style of the documents, for example apa7, when the layout names one. */
  citationStyle?: string;
  /** stylesheets are the files of the style sheets, relative to the folder. */
  stylesheets: string[];
  /** before and after are the templates of the fixed pages before and after the text, relative to the folder. */
  before: string[];
  after: string[];
  /**
   * document is the empty document of the layout, a Markdown file of the folder that a new document of the layout
   * starts from; preview is the PDF of that document, which shows the pages of the layout before a person chooses it.
   */
  document?: string;
  preview?: string;
  /** frontMatterSchema is the file of the JSON schema of the front matter of the documents, if the layout has one. */
  frontMatterSchema?: string;
  /** fields are the fields of the front matter that the layout uses. */
  fields: Record<string, FieldSpec>;
  /** numbered is true when the layout numbers the headings, depth is the deepest numbered level. */
  numbered: boolean;
  depth: number;
  /** unnumbered are regular expressions of headings that get no number, with the headings below them. */
  unnumbered: string[];
  /** numberedSections are the codes of the special sections whose headings get a number as other chapters do. */
  numberedSections: SectionCode[];
  /** contentsDepth is the deepest level of heading in the table of contents. */
  contentsDepth: number;
  /** contentsFront is false when the table of contents leaves out the chapters of the front part. */
  contentsFront: boolean;
  /** hyphenate is true when the layout hyphenates the text by the language. */
  hyphenate: boolean;
  /** references are the options of the reference list: hyphenate is true when it gets soft hyphens as the text does. */
  references: { hyphenate: boolean };
  /** listings are the options of the listings: lineNumbers puts the number of each line, from 1, before the code. */
  listings: { lineNumbers: boolean };
  /** pdfName is the pattern of the name of the PDF file, with fields such as {{title}}. */
  pdfName: string;
  /** terms are the words of the language, changed by the layout. */
  terms: Terms;
}

/** Problem is a problem of a layout or of a document. */
export interface Problem {
  /** severity is "error" when the layout cannot use the file, else "warning". */
  severity: 'error' | 'warning';
  message: string;
  /** file is the URL of the file of the problem; line is its line, counted from 0, when known. */
  file?: string;
  line?: number;
  /** column and length mark the text of the problem in its line, when known. */
  column?: number;
  length?: number;
}

/** termsOf maps the first part of a language tag to its terms. English is the default. */
const termsOf: Record<string, Terms> = {
  de: {
    sections: {
      TOC: ['Inhaltsverzeichnis', 'Inhalt'],
      LOF: ['Abbildungsverzeichnis'],
      LOT: ['Tabellenverzeichnis'],
      LOL: ['Listingverzeichnis', 'Verzeichnis der Listings'],
      BIB: ['Literaturverzeichnis', 'Literatur', 'Quellenverzeichnis', 'Quellen', 'Bibliographie', 'Bibliografie'],
      ADT: ['Eidesstattliche Erklärung', 'Eidesstattliche Versicherung'],
      AST: ['Abstrakt', 'Abstract', 'Kurzfassung', 'Zusammenfassung'],
      ACC: ['Danksagung', 'Dank'],
      FWD: ['Vorwort'],
      APX: ['Anhang', 'Anhänge'],
    },
    figure: 'Abbildung',
    table: 'Tabelle',
    listing: 'Listing',
    appendix: 'Anhang',
  },
  en: {
    sections: {
      TOC: ['Table of Contents', 'Contents'],
      LOF: ['List of Figures', 'List of Illustrations'],
      LOT: ['List of Tables'],
      LOL: ['List of Listings'],
      BIB: ['Bibliography', 'References', 'Works Cited'],
      ADT: ['Affidavit', 'Statutory Declaration', 'Declaration'],
      AST: ['Abstract', 'Summary'],
      ACC: ['Acknowledgments', 'Acknowledgements'],
      FWD: ['Foreword', 'Preface'],
      APX: ['Appendix', 'Appendices'],
    },
    figure: 'Figure',
    table: 'Table',
    listing: 'Listing',
    appendix: 'Appendix',
  },
};

/**
 * termsFor returns the terms of a language tag, the English terms for a language without terms.
 * @param language - The language tag, for example de-AT.
 */
export const termsFor = (language: string): Terms => termsOf[language.toLowerCase().split('-')[0]] ?? termsOf.en;

/** languageTag matches a language tag such as de-AT or en-US. */
export const languageTag = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/i;

/**
 * parseVersion reads the version of the format from the field `format`, or returns undefined for another format.
 * @param value - The value of the field.
 */
export function parseVersion(value: unknown): { major: number; minor: number; patch: number } | undefined {
  const match = typeof value === 'string' ? new RegExp(`^${formatName} (\\d+)\\.(\\d+)\\.(\\d+)$`).exec(value.trim()) : null;
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * strings returns a value as a list of texts: a text gives a list of one, a list keeps its texts.
 * @param value - The value.
 */
const strings = (value: unknown): string[] | undefined =>
  typeof value === 'string' ? [value] : Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : undefined;

/**
 * relativeFile tells whether a path names a file inside the layout folder: relative, with no `..` and no scheme.
 * @param path - The path.
 */
export const relativeFile = (path: string): boolean =>
  path !== '' && !path.startsWith('/') && !path.startsWith('\\') && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.split(/[\\/]/).includes('..');

/**
 * parseLayout reads the text of a `layout.json` and returns the layout with the defaults of its language, and the
 * problems of the file. The layout is undefined when the file cannot be used: no JSON, another format, or a major
 * version of the format that this version does not read.
 * @param text - The text of the file.
 * @param id - The name of the folder of the layout.
 * @param folder - The URL of the folder, with a slash at its end.
 */
export function parseLayout(text: string, id: string, folder: string): { layout?: Layout; problems: Problem[] } {
  const file = `${folder}${layoutFile}`;
  const problems: Problem[] = [];
  const problem = (severity: Problem['severity'], message: string): void => {
    problems.push({ severity, message, file });
  };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    problem('error', `The file ${layoutFile} of the layout "${id}" is no JSON: ${(error as Error).message}`);
    return { problems };
  }
  if (!isObject(json)) {
    problem('error', `The file ${layoutFile} of the layout "${id}" is no JSON object.`);
    return { problems };
  }
  const version = parseVersion(json.format);
  if (!version) {
    problem('error', `The field "format" of the layout "${id}" must be "${formatText}".`);
    return { problems };
  }
  if (version.major !== formatVersion.major) {
    problem('error', `The layout "${id}" has the format ${version.major}.${version.minor}.${version.patch}; this version of nimblescape Markdown reads the format ${formatVersion.major}.x.`);
    return { problems };
  }
  if (version.minor > formatVersion.minor) {
    problem('warning', `The layout "${id}" has the newer format ${version.major}.${version.minor}.${version.patch}; this version reads ${formatText} and leaves the newer parts out.`);
  }
  const language = typeof json.language === 'string' && languageTag.test(json.language) ? json.language : 'en-US';
  if (json.language !== undefined && language !== json.language) {
    problem('warning', `The field "language" of the layout "${id}" is no language tag such as de-AT; the layout uses en-US.`);
  }
  const files = (key: string, fallback: string[]): string[] => {
    const value = json[key];
    if (value === undefined) {
      return fallback;
    }
    const list = strings(value);
    if (!list) {
      problem('warning', `The field "${key}" of the layout "${id}" must be a list of file names.`);
      return fallback;
    }
    const outside = list.filter((path) => !relativeFile(path));
    if (outside.length > 0) {
      problem('warning', `The field "${key}" of the layout "${id}" names files outside the layout folder: ${outside.join(', ')}.`);
    }
    return list.filter(relativeFile);
  };
  const fields: Record<string, FieldSpec> = {};
  if (json.fields !== undefined && !isObject(json.fields)) {
    problem('warning', `The field "fields" of the layout "${id}" must be an object of fields.`);
  }
  for (const [key, spec] of Object.entries(isObject(json.fields) ? json.fields : {})) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      problem('warning', `The field name "${key}" of the layout "${id}" may hold only letters, digits, "-" and "_", after a letter.`);
      continue;
    }
    if (typeof spec === 'string') {
      fields[key] = { description: spec, required: false };
    } else if (isObject(spec)) {
      const values = spec.values === undefined ? undefined : strings(spec.values);
      if (spec.values !== undefined && (!values || values.length === 0 || typeof spec.values === 'string')) {
        problem('warning', `The field "${key}" of the layout "${id}" must give "values" as a list of texts.`);
      }
      const choices = values && values.length > 0 && typeof spec.values !== 'string' ? values : undefined;
      if (choices && spec.default !== undefined && !choices.includes(String(spec.default))) {
        problem('warning', `The default "${String(spec.default)}" of the field "${key}" of the layout "${id}" is not one of its values: ${choices.join(', ')}.`);
      }
      fields[key] = {
        description: typeof spec.description === 'string' ? spec.description : '',
        required: spec.required === true,
        ...(spec.default !== undefined ? { default: String(spec.default) } : {}),
        ...(choices ? { values: choices } : {}),
      };
    } else {
      problem('warning', `The field "${key}" of the layout "${id}" must be a description or an object with "description".`);
    }
  }
  for (const key of ['document', 'preview', 'frontMatterSchema'] as const) {
    const value = json[key];
    if (value !== undefined && (typeof value !== 'string' || !relativeFile(value))) {
      problem('warning', `The field "${key}" of the layout "${id}" must name a file of the layout folder.`);
    }
  }
  const defaults = termsFor(language);
  const terms: Terms = { ...defaults, sections: { ...defaults.sections } };
  if (isObject(json.terms)) {
    for (const [key, value] of Object.entries(json.terms)) {
      const list = strings(value);
      if (!list || list.length === 0) {
        problem('warning', `The term "${key}" of the layout "${id}" must be a text or a list of texts.`);
      } else if ((sectionCodes as readonly string[]).includes(key)) {
        terms.sections[key as SectionCode] = list;
      } else if (key === 'figure' || key === 'table' || key === 'listing' || key === 'appendix') {
        terms[key] = list[0];
      } else {
        problem('warning', `The layout "${id}" has the unknown term "${key}"; the terms are ${[...sectionCodes, 'figure', 'table', 'listing', 'appendix'].join(', ')}.`);
      }
    }
  }
  const headings = isObject(json.headings) ? json.headings : {};
  const count = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6 ? value : fallback);
  const fileField = (key: 'document' | 'preview' | 'frontMatterSchema'): Partial<Layout> => {
    const value = json[key];
    return typeof value === 'string' && relativeFile(value) ? { [key]: value } : {};
  };
  const layout: Layout = {
    id,
    folder,
    name: typeof json.name === 'string' && json.name.trim() !== '' ? json.name : id,
    language,
    ...(typeof json.citationStyle === 'string' ? { citationStyle: json.citationStyle } : {}),
    stylesheets: files('stylesheets', ['page.css']),
    before: files('before', []),
    after: files('after', []),
    ...fileField('document'),
    ...fileField('preview'),
    ...fileField('frontMatterSchema'),
    fields,
    numbered: headings.numbered !== false,
    depth: count(headings.depth, 3),
    unnumbered: [],
    numberedSections: [],
    contentsDepth: count(isObject(json.contents) ? json.contents.depth : undefined, 3),
    contentsFront: !(isObject(json.contents) && json.contents.front === false),
    hyphenate: json.hyphenate !== false,
    references: { hyphenate: isObject(json.references) && json.references.hyphenate === true },
    listings: { lineNumbers: isObject(json.listings) && json.listings.lineNumbers === true },
    pdfName: typeof json.pdfName === 'string' && json.pdfName.trim() !== '' ? json.pdfName : '{{file}}',
    terms,
  };
  for (const pattern of strings(headings.unnumbered) ?? []) {
    try {
      new RegExp(pattern, 'iu');
      layout.unnumbered.push(pattern);
    } catch {
      problem('warning', `The pattern "${pattern}" of "headings.unnumbered" of the layout "${id}" is no regular expression.`);
    }
  }
  for (const code of strings(headings.numberedSections) ?? []) {
    if ((sectionCodes as readonly string[]).includes(code.toUpperCase())) {
      layout.numberedSections.push(code.toUpperCase() as SectionCode);
    } else {
      problem('warning', `The layout "${id}" has the unknown section "${code}" in "headings.numberedSections"; the sections are ${sectionCodes.join(', ')}.`);
    }
  }
  return { layout, problems };
}

/**
 * withLanguage returns a layout in the language of the field `lang` of a document, with the terms of that language,
 * or the layout itself when the field names no other language. A dialect of the language of the layout keeps the
 * terms of the layout.
 * @param layout - The layout.
 * @param lang - The value of the field `lang`, if any.
 */
export function withLanguage(layout: Layout, lang: string | undefined): Layout {
  const tag = lang?.trim();
  if (!tag || !languageTag.test(tag) || tag.toLowerCase() === layout.language.toLowerCase()) {
    return layout;
  }
  const same = tag.split('-')[0].toLowerCase() === layout.language.split('-')[0].toLowerCase();
  return { ...layout, language: tag, terms: same ? layout.terms : termsFor(tag) };
}

/**
 * fieldsOfSchema returns the fields of the front matter that a JSON schema of a layout defines: each property with
 * its description, whether it is required, its default and the values of its `enum`.
 * @param schema - The JSON schema of the front matter.
 */
export function fieldsOfSchema(schema: JsonSchemaObject): Record<string, FieldSpec> {
  const required = new Set(schema.required ?? []);
  const fields: Record<string, FieldSpec> = {};
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) || key === 'layout') {
      continue;
    }
    const spec = isObject(property) ? (property as JsonSchemaObject) : {};
    const values = Array.isArray(spec.enum) ? spec.enum.map(String) : undefined;
    fields[key] = {
      description: typeof spec.description === 'string' ? spec.description : '',
      required: required.has(key),
      ...(spec.default !== undefined ? { default: String(spec.default) } : {}),
      ...(values && values.length > 0 ? { values } : {}),
    };
  }
  return fields;
}

/**
 * schemaOfFields returns the JSON schema of the front matter of a layout without a file of its own: an object with the
 * field `layout` and a property of the type text for each field of the layout, with its description, its default and
 * its values, and the required fields (docs/editor.md, R-FM-004). Other keys are allowed, because other plugins and
 * other programs keep their keys in the front matter too.
 * @param layout - The layout.
 */
export function schemaOfFields(layout: Pick<Layout, 'name' | 'fields'>): JsonSchemaObject {
  const properties: Record<string, JsonSchemaObject> = {
    layout: { type: 'string', title: 'Layout', description: `The layout of the document: ${layout.name}.` },
  };
  for (const [key, field] of Object.entries(layout.fields)) {
    properties[key] = {
      type: 'string',
      ...(field.description ? { description: field.description } : {}),
      ...(field.default !== undefined ? { default: field.default } : {}),
      ...(field.values ? { enum: field.values } : {}),
    };
  }
  const required = Object.entries(layout.fields).flatMap(([key, field]) => (field.required ? [key] : []));
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
}
