// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The page of a document in its layout (docs/rendering.md, R-LAYOUT-001 to R-LAYOUT-003): one HTML page, which
// Paged.js turns into pages, for the view of the pages and for the PDF alike, so that the two never differ. The steps:
//
// 1. Read the front matter of the file and find its layout: the folder `layouts/<name>/` that the field `layout` names,
//    in the folder of the file or in a folder above it, up to the top folder; a layout that the integrating code finds,
//    for example a layout on GitHub in its clone; else a built-in layout. A file without the field gets the built-in
//    layout `plain`.
// 2. Read the style sheets of the layout, the templates of its fixed pages and the schema of its front matter, and
//    fill the templates with the fields.
// 3. Turn the text into HTML with the renderer and the plugin of the layout (src/text.ts), with soft hyphens by the
//    language of the layout.
// 4. Write the page: a policy that lets only the scripts of the page run, loads nothing from the internet, because a
//    layout can come from a third party and its templates hold the fields, and lets no form send data; the base
//    address of the folder of the file for its images, the style sheets, the fields as CSS variables and as attributes, the fixed pages and the text, the
//    data of the placeholders of the plugins (src/pageRenders.ts), the script of the layout (src/page/handlers.js), and
//    the scripts of the integrating code, with Paged.js.
//
// The integrating code reads the files and maps their addresses to the addresses that the page loads: in VS Code
// through its webview, in a browser through its server, on the command line from the disk. This file uses no API of a
// platform.

import type { JsonSchemaObject } from '@nimblescape/markdowntext';
import type { MarkdownRenderer } from '@nimblescape/markdownrender';
import handlersJs from './page/handlers.js?raw';
import { builtinFile, builtinFolder } from './builtin';
import { fieldValues } from './frontMatter';
import { fieldsOfSchema, type Layout, layoutFile, layoutName, parseLayout, type Problem, schemaOfFields, withLanguage } from './format';
import { hyphenatorOf } from './hyphenate';
import { slotsHtml } from './pageRenders';
import { escapeHtml, fill, pdfNameOf } from './template';
import { type LayoutText, renderText } from './text';

/** Reader reads files by their URLs. */
export interface Reader {
  /** read returns the bytes of a file, or undefined when it does not exist or cannot be read. */
  read(url: string): Promise<Uint8Array | undefined>;
}

/** Script is a script of the page: a file, also an ECMAScript module, or a text. */
export type Script = { src: string; module?: boolean } | { text: string };

/** LayoutPlaces are the places where the layout part finds layouts. */
export interface LayoutPlaces {
  reader: Reader;
  /** top is the URL of the top folder of the search for a layout, for example the folder of the workspace. */
  top?: string;
  /** builtinLayouts is the URL of a folder of more built-in layouts, with a slash at its end, if any. */
  builtinLayouts?: string;
  /**
   * findLayout finds the folder of a layout that only the integrating code knows, for example a layout on GitHub,
   * `<owner>/<repository>/<folder>@<rev>`, in its clone in the project of the document. It returns the URL of the
   * folder with a slash at its end, or a problem.
   */
  findLayout?(document: string, name: string): Promise<{ folder?: string; problem?: string }>;
}

/** Host is what the page needs from the integrating code. */
export interface Host extends LayoutPlaces {
  /** resource maps the URL of a file to the URL from which the page loads it. */
  resource(url: string): string;
  /** sources are the sources of the policy of the page for images, fonts and styles, for example `file:`. */
  sources: string;
  /** scripts are the scripts of the page after the text, for example of the drawings of plugins, and Paged.js last. */
  scripts: Script[];
  /** styles are style sheets as texts before the style sheets of the layout, for example of the drawings of plugins. */
  styles?: string[];
  /** screenStyles are the addresses of more style sheets for the screen only, which Paged.js leaves out. */
  screenStyles?: string[];
  /** nonce is the nonce of the scripts of the page. */
  nonce: string;
}

/** defaultLayout is the built-in layout of a file without the field `layout`. */
export const defaultLayout = 'plain';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * readerOf returns a reader that reads the files of the built-in layouts too.
 * @param reader - The reader of the integrating code.
 */
const readerOf = (reader: Reader): Reader => ({
  read: async (url) => {
    const builtin = builtinFile(url);
    return builtin !== undefined ? encoder.encode(builtin) : url.startsWith(builtinFolder) ? undefined : reader.read(url);
  },
});

/**
 * parentOf returns the URL of the folder above a folder, or undefined at the top.
 * @param folder - The URL of the folder, with a slash at its end.
 */
function parentOf(folder: string): string | undefined {
  const parent = new URL('..', folder).href;
  return parent === folder ? undefined : parent;
}

/**
 * folderOf returns the URL of the folder of a file, with a slash at its end.
 * @param file - The URL of the file.
 */
export const folderOf = (file: string): string => new URL('.', file).href;

/**
 * foldersAbove returns the URL of the folder of a document and of each folder above it, up to the top folder of the
 * search.
 * @param places - The places with the top folder.
 * @param document - The URL of the document.
 */
function foldersAbove(places: Pick<LayoutPlaces, 'top'>, document: string): string[] {
  const top = places.top && !places.top.endsWith('/') ? `${places.top}/` : places.top;
  const folders: string[] = [];
  for (let folder: string | undefined = folderOf(document); folder; folder = folder === top ? undefined : parentOf(folder)) {
    folders.push(folder);
    if (top && !folder.startsWith(top)) {
      break;
    }
  }
  return folders;
}

/**
 * findLayout finds the layout that a document names, and reads it: a folder of `layouts/` of the folder of the document
 * or of a folder above it, a layout that the integrating code finds, or a built-in layout.
 * @param places - The places of the layouts.
 * @param document - The URL of the document.
 * @param name - The name of the layout, or a reference that the integrating code finds, such as a layout on GitHub.
 */
export async function findLayout(places: LayoutPlaces, document: string, name: string): Promise<{ layout?: Layout; problems: Problem[] }> {
  const reader = readerOf(places.reader);
  if (name.includes('/')) {
    const found = places.findLayout ? await places.findLayout(document, name) : { problem: `The layout "${name}" is no name of a folder, and no program here finds it.` };
    if (!found.folder) {
      return { problems: [{ severity: 'error', message: found.problem ?? `The layout "${name}" was not found.` }] };
    }
    const folder = found.folder.endsWith('/') ? found.folder : `${found.folder}/`;
    const bytes = await reader.read(`${folder}${layoutFile}`);
    const id = folder.replace(/\/$/, '').split('/').pop() || name;
    return bytes ? parseLayout(decoder.decode(bytes), id, folder) : { problems: [{ severity: 'error', message: `The layout "${name}" has no file ${layoutFile}.` }] };
  }
  if (!layoutName.test(name)) {
    return { problems: [{ severity: 'error', message: `The layout "${name}" is no name of a folder: letters, digits, ".", "-" and "_".` }] };
  }
  for (const folder of foldersAbove(places, document)) {
    const candidate = `${folder}layouts/${name}/`;
    const bytes = await reader.read(`${candidate}${layoutFile}`);
    if (bytes) {
      return parseLayout(decoder.decode(bytes), name, candidate);
    }
  }
  for (const folder of [...(places.builtinLayouts ? [places.builtinLayouts] : []), builtinFolder]) {
    const builtin = `${folder}${name}/`;
    const bytes = await reader.read(`${builtin}${layoutFile}`);
    if (bytes) {
      return parseLayout(decoder.decode(bytes), name, builtin);
    }
  }
  return { problems: [{ severity: 'error', message: `The layout "${name}" is neither in a folder layouts/ of the repository nor built in.` }] };
}

/**
 * documentLayout finds the layout of a document, or the layout plain when the named one does not exist. The field
 * `lang` of the front matter changes the language of the layout, with its terms.
 * @param places - The places of the layouts.
 * @param document - The URL of the document.
 * @param values - The values of the fields of the front matter of the document.
 */
export async function documentLayout(places: LayoutPlaces, document: string, values: Readonly<Record<string, string>>): Promise<{ layout: Layout; problems: Problem[] }> {
  const problems: Problem[] = [];
  const name = values.layout?.trim() || defaultLayout;
  let found = await findLayout(places, document, name);
  problems.push(...found.problems.map((problem) => ({ ...problem, file: problem.file ?? document })));
  if (!found.layout && name !== defaultLayout) {
    found = await findLayout(places, document, defaultLayout);
  }
  if (!found.layout) {
    throw new Error(`The built-in layout "${defaultLayout}" is missing: ${problems.map((problem) => problem.message).join(' ')}`);
  }
  return { layout: withLanguage(found.layout, values.lang), problems };
}

/** LoadedLayout is a layout with the text of its style sheets, of its templates and of the schema of its front matter. */
export interface LoadedLayout {
  /** layout is the layout, in the language of the field `lang` of the document when it names one. */
  layout: Layout;
  /** styles are the style sheets of the layout, with their URLs. */
  styles: { url: string; css: string }[];
  /** before and after are the templates of the fixed pages before and after the text, with their URLs. */
  before: { url: string; name: string; text: string }[];
  after: { url: string; name: string; text: string }[];
  /** schema is the JSON schema of the front matter of the documents of the layout (docs/editor.md, R-FM-004). */
  schema: JsonSchemaObject;
  problems: Problem[];
}

/**
 * loadLayout finds the layout of a document and reads its style sheets, its templates and the schema of its front
 * matter. A layout with the file of a schema gets its fields from the schema when `layout.json` gives none; a layout
 * without it gets the schema of its fields.
 * @param places - The places of the layouts.
 * @param document - The URL of the document.
 * @param values - The values of the fields of the front matter of the document.
 */
export async function loadLayout(places: LayoutPlaces, document: string, values: Readonly<Record<string, string>>): Promise<LoadedLayout> {
  const found = await documentLayout(places, document, values);
  const problems = found.problems;
  let layout = found.layout;
  const reader = readerOf(places.reader);
  const read = async (file: string): Promise<{ url: string; text: string } | undefined> => {
    const url = `${layout.folder}${file}`;
    const bytes = await reader.read(url);
    if (!bytes) {
      problems.push({ severity: 'warning', message: `The layout "${layout.id}" names the file ${file}, which does not exist.`, file: `${layout.folder}${layoutFile}` });
    }
    return bytes && { url, text: decoder.decode(bytes) };
  };
  let schema: JsonSchemaObject | undefined;
  if (layout.frontMatterSchema) {
    const file = await read(layout.frontMatterSchema);
    if (file) {
      try {
        const json: unknown = JSON.parse(file.text);
        if (json === null || typeof json !== 'object' || Array.isArray(json)) {
          throw new Error('no JSON object');
        }
        schema = json as JsonSchemaObject;
        if (Object.keys(layout.fields).length === 0) {
          layout = { ...layout, fields: fieldsOfSchema(schema) };
        }
      } catch (error) {
        problems.push({ severity: 'warning', message: `The schema ${layout.frontMatterSchema} of the layout "${layout.id}" is no JSON schema: ${(error as Error).message}`, file: file.url });
      }
    }
  }
  const styles: LoadedLayout['styles'] = [];
  for (const file of layout.stylesheets) {
    const style = await read(file);
    if (style) {
      styles.push({ url: style.url, css: style.text });
    }
  }
  const templates = async (files: readonly string[]): Promise<LoadedLayout['before']> => {
    const parts: LoadedLayout['before'] = [];
    for (const file of files) {
      const template = await read(file);
      if (template) {
        parts.push({ ...template, name: file.replace(/^.*\//, '').replace(/\.[^.]*$/, '') });
      }
    }
    return parts;
  };
  return { layout, styles, before: await templates(layout.before), after: await templates(layout.after), schema: schema ?? schemaOfFields(layout), problems };
}

/**
 * valuesOf returns the values of the fields of a document: the defaults of the layout, the fields of the front matter,
 * and `file`, the name of the file without its extension.
 * @param layout - The layout.
 * @param fields - The values of the fields of the front matter.
 * @param document - The URL of the document.
 */
export function valuesOf(layout: Layout, fields: Readonly<Record<string, string>>, document: string): Record<string, string> {
  const file = decodeURIComponent(document.split('/').pop() ?? 'document').replace(/\.[^.]*$/, '').replace(/\.paper$/i, '');
  const defaults = Object.fromEntries(Object.entries(layout.fields).flatMap(([key, spec]) => (spec.default !== undefined ? [[key, spec.default]] : [])));
  const values: Record<string, string> = { ...defaults, file };
  for (const [key, value] of Object.entries(fields)) {
    if (value.trim() !== '' || values[key] === undefined) {
      values[key] = value;
    }
  }
  return values;
}

/** relativeAddress tells whether an address is relative to its file: no scheme, no anchor and no root. */
const relativeAddress = (address: string): boolean => !/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(address);

/**
 * rewriteCss returns a style sheet whose relative addresses in `url()` name the files of the folder of the style sheet,
 * as the page loads them.
 * @param css - The style sheet.
 * @param base - The URL of the style sheet.
 * @param resource - The mapping of a URL to the URL that the page loads.
 */
export function rewriteCss(css: string, base: string, resource: (url: string) => string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, quote: string, address: string) =>
    relativeAddress(address.trim()) ? `url(${quote || '"'}${resource(new URL(address.trim(), base).href)}${quote || '"'})` : all,
  );
}

/**
 * rewriteHtml returns a template whose relative addresses in `src` and `href` name the files of the layout folder.
 * @param html - The template.
 * @param base - The URL of the template.
 * @param resource - The mapping of a URL to the URL that the page loads.
 */
export function rewriteHtml(html: string, base: string, resource: (url: string) => string): string {
  return html.replace(/\b(src|href)=(["'])([^"']*)\2/gi, (all, name: string, quote: string, address: string) =>
    address !== '' && relativeAddress(address) ? `${name}=${quote}${resource(new URL(address, base).href)}${quote}` : all,
  );
}

/**
 * withoutScripts returns HTML without script elements and without attributes of events, for the templates of a
 * layout: a layout holds no logic, and the policy of the page would block them anyway.
 * @param html - The HTML.
 */
const withoutScripts = (html: string): string => html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/\s+on[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, '');

/**
 * cssString returns a text as a string of CSS.
 * @param text - The text.
 */
const cssString = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\A ')}"`;

/**
 * attributesHtml returns attributes as the text of an HTML start tag, each with a space before it.
 * @param attributes - The names and the values of the attributes.
 */
const attributesHtml = (attributes: Readonly<Record<string, string>>): string =>
  Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');

/** Composed is the part of a page that comes from the layout and the fields of a document. */
export interface Composed {
  /** styles are the style sheets of the layout, whose addresses name the files as the page loads them. */
  styles: string[];
  /** before and after are the HTML of the filled templates. */
  before: string;
  after: string;
  /** variables is the style sheet of the fields as CSS variables, and attributes their attributes. */
  variables: string;
  attributes: Record<string, string>;
}

/**
 * compose fills the templates of a layout with the fields of a document, and maps the addresses of the style sheets
 * and of the templates to the addresses that the page loads.
 * @param loaded - The layout with its files.
 * @param values - The values of the fields.
 * @param resource - The mapping of a URL to the URL that the page loads.
 */
export function compose(loaded: LoadedLayout, values: Readonly<Record<string, string>>, resource: (url: string) => string): Composed {
  const fieldNames = Object.keys(values).filter((key) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(key));
  const attributes = Object.fromEntries(fieldNames.map((key) => [`data-field-${key.toLowerCase()}`, values[key]]));
  // Each template section has the fields as attributes too, as the text has them: Paged.js applies the breaks and the
  // named pages to the content without its body, so a rule such as `body[data-field-x] h1 { break-before: auto; }`
  // never matches there, and `.paper-text[data-field-x] > h1` does.
  const templates = (files: LoadedLayout['before']): string =>
    files
      .map(
        (template) =>
          `<section class="paper-template paper-template-${escapeHtml(template.name)}" data-template="${escapeHtml(template.name)}"${attributesHtml(attributes)}>\n${rewriteHtml(withoutScripts(fill(template.text, values)), template.url, resource)}\n</section>`,
      )
      .join('\n');
  return {
    styles: loaded.styles.map((style) => rewriteCss(style.css, style.url, resource)),
    before: templates(loaded.before),
    after: templates(loaded.after),
    variables: `:root {\n${fieldNames.map((key) => `  --field-${key}: ${cssString(values[key])};`).join('\n')}\n}`,
    attributes,
  };
}

/** baseCss is the style sheet of the layout part before the style sheets of the layout: only the rules without which a
 * part of the layout does not work in Paged.js. A footnote goes to the foot of its page with its number in the text,
 * the generated lists show the page of each entry, the number of a line of a listing shows, and the comments of the
 * tables of the editor show (docs/editor.md, R-EDIT-010). A link has the color of the text without a mark, a long
 * address breaks at the end of a line, and a reference to a place in a source stays on one line. The code blocks have the syntax colors of the editor (docs/rendering.md,
 * R-REN-001), with the colors of its light theme as the defaults of the variables --nsmd-syntax-*. A layout changes the
 * look of each of them with its own rules, and decides whether a template is a page of its own. */
export const baseCss = `.footnote {
  float: footnote;
}
a {
  color: inherit;
  text-decoration: none;
}
.link-address {
  overflow-wrap: anywhere;
}
/* A reference to a place in a source, such as "S. 18 – 19", and a range of numbers stay on one line (keepReferences). */
.nsmd-nowrap {
  white-space: nowrap;
}
/* Paged.js sets the number of a footnote in the text with font-variant-position, which most fonts do not have. */
[data-footnote-call]::after {
  vertical-align: super;
  font-size: 65%;
  line-height: 0;
  font-variant-position: normal;
}
nav.contents a::after,
nav.list-of-figures a::after,
nav.list-of-tables a::after,
nav.list-of-listings a::after {
  content: target-counter(attr(href), page);
}
img {
  max-width: 100%;
}
/* The number of a line of a listing is an element without text, so that a copy of the code leaves it out. */
.line-number::before {
  content: attr(data-number);
}
/* The widths of the columns and the colors of the cells of the tables, from their comments. */
table.nsmd-table-fixed {
  table-layout: fixed;
  width: 100%;
}
[data-color="gray"] { background: #f0efec; }
[data-color="red"] { background: #fbebeb; }
[data-color="orange"] { background: #f9ece7; }
[data-color="yellow"] { background: #f9eeda; }
[data-color="green"] { background: #e5f4e4; }
[data-color="blue"] { background: #e7f1fb; }
[data-color="purple"] { background: #efedff; }
/* The syntax colors of code, as in the editor; a layout sets the variables --nsmd-syntax-*, for example to the color of the text. */
pre :is(.hljs-keyword, .hljs-selector-tag, .hljs-template-tag, .hljs-doctag, .hljs-deletion) {
  color: var(--nsmd-syntax-keyword, #d1242f);
}
pre :is(.hljs-string, .hljs-regexp, .hljs-char, .hljs-addition) {
  color: var(--nsmd-syntax-string, #1a7f37);
}
pre :is(.hljs-number, .hljs-literal, .hljs-symbol, .hljs-attr, .hljs-attribute, .hljs-property, .hljs-selector-id, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-link, .hljs-code) {
  color: var(--nsmd-syntax-constant, #0969da);
}
pre :is(.hljs-title, .hljs-section, .hljs-name) {
  color: var(--nsmd-syntax-title, #8250df);
}
pre :is(.hljs-built_in, .hljs-type, .hljs-variable, .hljs-template-variable, .hljs-bullet) {
  color: var(--nsmd-syntax-type, #bc4c00);
}
pre :is(.hljs-comment, .hljs-quote, .hljs-meta) {
  color: var(--nsmd-syntax-comment, #59636e);
}
pre .hljs-emphasis {
  font-style: italic;
}
pre .hljs-strong {
  font-weight: 600;
}
`;

/**
 * screenCss is the style sheet of the pages on a screen, which the page holds for the screen only: Paged.js leaves out
 * a style sheet for the screen, and the PDF has the media of print. The pages stand on a grey background, with a
 * shadow and a gap between them, in the middle of the width.
 */
export const screenCss = `html {
  background: #7a7d80;
}
body.paper {
  margin: 0;
}
.pagedjs_pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  min-width: 100%;
  padding: 16px 0;
  gap: 16px;
}
.pagedjs_page {
  background: white;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  margin: 0 !important;
  flex: none;
}
`;

/**
 * layoutScript is the text of the script of the layout (src/page/handlers.js), which every page of renderPage holds:
 * the start of Paged.js when the content is complete, the page numbers and the last lines of the justified paragraphs.
 * Code that makes the pages itself, without renderPage, loads it into its page before Paged.js, for example the pages in
 * the Markdown preview of VS Code of nimblescape Markdown Paper.
 */
export const layoutScript: string = handlersJs;

/** Page is the page of a document in its layout. */
export interface Page {
  html: string;
  /** title is the title of the document: the field `title`, else the name of the file. */
  title: string;
  /** pdfName is the name of its PDF file. */
  pdfName: string;
  layout: Layout;
  /** schema is the JSON schema of the front matter of the documents of the layout. */
  schema: JsonSchemaObject;
  /** values are the values of the fields, with the defaults of the layout. */
  values: Record<string, string>;
  text: LayoutText;
  problems: Problem[];
  /** held is true when Paged.js waits for `release` of the integrating code (the option `hold`). */
  held: boolean;
}

/** PageOptions are the options of a page. */
export interface PageOptions {
  /**
   * hold keeps Paged.js from starting until the integrating code calls `window.paperHandlers.release()` in the page,
   * for code that fills the page after it loaded, for example with the functions of plugins (showPages). Without it,
   * the page fills the placeholders of the plugins itself with the functions that a script of the page registers
   * (registerRenders), as the page of a PDF does.
   */
  hold?: boolean;
  /** env holds values that the plugins find in the environment of markdown-it, as in the Markdown preview of VS Code. */
  env?: Readonly<Record<string, unknown>>;
}

/**
 * renderPage makes the page of a document in its layout.
 * @param host - The integrating code.
 * @param renderer - The renderer of the text, from createLayoutRenderer.
 * @param document - The URL of the file.
 * @param text - The text of the file, with its unsaved changes.
 * @param options - The options of the page.
 */
export async function renderPage(host: Host, renderer: MarkdownRenderer, document: string, text: string, options: PageOptions = {}): Promise<Page> {
  const problems: Problem[] = [];
  const fields = fieldValues(text);
  if (fields.error) {
    problems.push({ severity: 'warning', message: `Front matter: ${fields.error}`, file: document, line: 0 });
  }
  const loaded = await loadLayout(host, document, fields.values);
  problems.push(...loaded.problems);
  const layout = loaded.layout;
  const values = valuesOf(layout, fields.values, document);
  const hyphenate = layout.hyphenate ? hyphenatorOf(layout.language) : undefined;
  const body = renderText(renderer, text, layout, hyphenate, options.env);
  problems.push(...body.problems.map((problem) => ({ ...problem, file: problem.file ?? document })));
  const composed = compose(loaded, values, host.resource);
  const attributes = attributesHtml(composed.attributes);
  const title = values.title?.trim() || values.file;
  const policy = [
    "default-src 'none'",
    `img-src ${host.sources} data: blob:`,
    `font-src ${host.sources} data: blob:`,
    `style-src ${host.sources} 'unsafe-inline'`,
    `script-src 'nonce-${host.nonce}'`,
    "form-action 'none'",
  ].join('; ');
  const nonce = escapeHtml(host.nonce);
  const scripts = host.scripts.map((script) =>
    'src' in script ? `<script nonce="${nonce}"${script.module ? ' type="module"' : ''} src="${escapeHtml(script.src)}"></script>` : `<script nonce="${nonce}">${script.text.replace(/<\/script/gi, '<\\/script')}</script>`,
  );
  const style = (name: string, css: string, file = ''): string => `<style data-paper="${name}"${file ? ` data-file="${escapeHtml(file)}"` : ''}>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  // The style sheets of the integrating code and of the plugins come first, so that the layout can change what they set.
  // The element of the styles of a plugin has the attribute of the renderer, so that the renderer finds it in the page.
  const pluginStyles = renderer.plugins.flatMap((plugin) =>
    plugin.styles ? [`<style data-nsmd-plugin="${escapeHtml(plugin.name)}">\n${plugin.styles.replace(/<\/style/gi, '<\\/style')}\n</style>`] : [],
  );
  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(layout.language)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<title>${escapeHtml(title)}</title>
<base href="${escapeHtml(host.resource(folderOf(document)))}">
<style media="screen" data-paper="screen">\n${screenCss}</style>
${(host.screenStyles ?? []).map((href) => `<link rel="stylesheet" media="screen" href="${escapeHtml(href)}">`).join('\n')}
${[...(host.styles ?? []).map((css) => style('host', css)), ...pluginStyles, style('base', baseCss)].join('\n')}
${composed.styles.map((css, index) => style('layout', css, loaded.styles[index].url.slice(layout.folder.length))).join('\n')}
${style('fields', composed.variables)}
<script nonce="${nonce}">
${handlersJs.replace(/<\/script/gi, '<\\/script')}
${options.hold ? 'window.paperHandlers.hold();\n' : ''}window.PagedConfig = { auto: true, before: window.paperHandlers.before, after: window.paperHandlers.after };
</script>
</head>
<body class="paper" data-layout="${escapeHtml(layout.id)}"${attributes}>
${composed.before}
<main class="paper-text"${attributes}>
${body.html}
</main>
${slotsHtml(body.slots)}
${composed.after}
${scripts.join('\n')}
</body>
</html>
`;
  return { html, title, pdfName: pdfNameOf(layout.pdfName, values), layout, schema: loaded.schema, values, text: body, problems, held: options.hold === true };
}
