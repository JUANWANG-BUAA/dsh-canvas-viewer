/** Native, read-only Canvas scene. The host owns React and the UI runtime. */
const MAX_LINES = 10000;
const MAX_MATCHES = 10000;
const MAX_TEXT = 200000;
const MAX_SECTIONS = 200;
const PAGE_SIZE = 100;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = value => Array.from(segmenter.segment(value), part => part.segment);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback) => Number.isFinite(value) ? Math.floor(value) : fallback;
const array = value => Array.isArray(value) ? value : [];

/** Strip terminal protocols (OSC clipboard/hyperlinks, DCS images, CSI), C0/C1
 * controls and bidi overrides; preserve combining marks and emoji joiners. */
export function sanitizeText(value) {
  const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value) : '';
  return text
    .replace(/(?:\u001b\]|\u009d)[\s\S]*?(?:\u0007|\u001b\\|\u009c|$)/g, '')
    .replace(/(?:\u001b[P_X^]|[\u0090\u0098\u009e\u009f])[\s\S]*?(?:\u001b\\|\u009c|$)/g, '')
    .replace(/(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[ -/]*[@-~]/g, '')
    .replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, '    ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

function cellWidth(grapheme) {
  if (/^[\p{Mark}\u200b-\u200f\u2060\ufe00-\ufe0f]+$/u.test(grapheme)) return 0;
  if (/\p{Emoji_Presentation}|\p{Regional_Indicator}|\u20e3/u.test(grapheme)
    || (/\p{Extended_Pictographic}/u.test(grapheme) && /[\ufe0f\u200d]/u.test(grapheme))) return 2;
  const code = grapheme.codePointAt(0);
  return code >= 0x1100 && (code <= 0x115f || code === 0x2329 || code === 0x232a
    || (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f)
    || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe10 && code <= 0xfe19) || (code >= 0xfe30 && code <= 0xfe6f)
    || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6)
    || (code >= 0x1b000 && code <= 0x1b2ff) || (code >= 0x20000 && code <= 0x3fffd)) ? 2 : 1;
}

export function displayWidth(value) {
  return graphemes(sanitizeText(value)).reduce((sum, part) => sum + (part === '\n' ? 0 : cellWidth(part)), 0);
}

/** Clip a single display line without slicing a grapheme. */
export function clipText(value, width) {
  width = Math.max(1, integer(width, 80));
  let result = '', used = 0;
  for (const part of graphemes(sanitizeText(value).replace(/\n/g, ' '))) {
    const size = cellWidth(part);
    if (used + size > width) break;
    result += part; used += size;
  }
  return result;
}

function wrapParts(text, width, limit = MAX_LINES) {
  const result = [];
  let line = '', used = 0, start = 0, position = 0;
  for (const { segment: part } of segmenter.segment(text)) {
    if (part === '\n' || (used + cellWidth(part) > width && line)) {
      result.push({ text: line, start, end: position });
      if (result.length >= limit) return { parts: result, truncated: true };
      line = ''; used = 0; start = position;
    }
    if (part === '\n') { position++; start = position; continue; }
    const size = cellWidth(part);
    // A two-cell grapheme cannot fit in a one-column terminal; show a marker.
    line += size > width ? '?' : part;
    used += Math.min(size, width); position += part.length;
  }
  result.push({ text: line, start, end: position });
  return { parts: result, truncated: false };
}

function boundedText(value) {
  const text = sanitizeText(value);
  if (text.length <= MAX_TEXT) return text;
  let result = '';
  for (const part of segmenter.segment(text)) {
    if (part.index + part.segment.length > MAX_TEXT) break;
    result += part.segment;
  }
  return result + '\n[Text truncated at reader safety limit]';
}

/** Pure structured formatting. Plain lines are <= width cells. matches describe
 * occurrences across all sections, including occurrences spanning soft wraps.
 * Any safety truncation is visible; search coverage then becomes 'retained'. */
export function formatReport(report, { width = 80, sectionIndex = 0, query = '' } = {}) {
  width = clamp(integer(width, 80), 1, 500);
  const sections = array(report?.sections).slice(0, MAX_SECTIONS);
  const valid = report?.schemaVersion === 1 && Array.isArray(report.sections);
  const sectionCount = Math.max(1, sections.length);
  const active = clamp(integer(sectionIndex, 0), 0, sectionCount - 1);
  const needle = clipText(sanitizeText(query).replace(/\n/g, ' '), 256).toLowerCase();
  const pages = Array.from({ length: sectionCount }, () => []);
  const matches = [];
  let count = 0, truncated = false, matchesTruncated = false;
  const recordMatches = (index, raw, parts, base, columnOffset = 0) => {
    if (!needle) return;
    if (matchesTruncated) return;
    const haystack = raw.toLowerCase();
    let row = 0;
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
      while (row < parts.length && at >= parts[row].end) row++;
      if (row >= parts.length || base + row >= pages[index].length) break;
      if (at < parts[row].start) continue;
      if (matches.length >= MAX_MATCHES) { matchesTruncated = true; break; }
      matches.push({ sectionIndex: index, line: base + row, column: columnOffset + at - parts[row].start, length: needle.length });
    }
  };
  const add = (index, value, searchable = true) => {
    if (count >= MAX_LINES) { truncated = true; return; }
    const raw = boundedText(value);
    if (raw.endsWith('[Text truncated at reader safety limit]')) truncated = true;
    const wrapped = wrapParts(raw, width, MAX_LINES - count);
    const base = pages[index].length;
    const retained = wrapped.parts;
    pages[index].push(...retained.map(part => part.text));
    count += retained.length;
    if (wrapped.truncated) truncated = true;
    if (searchable) recordMatches(index, raw, retained, base);
  };
  const table = (index, block) => {
    const headers = array(block.columns).map(boundedText);
    const rows = array(block.rows);
    let columnCount = headers.length;
    for (const row of rows) columnCount = Math.max(columnCount, array(row).length);
    while (headers.length < columnCount) headers.push('Column ' + (headers.length + 1));
    const widths = headers.map((header, i) => Math.min(36, Math.max(6, displayWidth(header),
      ...rows.slice(0, 100).map(row => displayWidth(boundedText(row?.[i]))))));
    const wide = columnCount > 0 && widths.reduce((sum, size) => sum + size, 0) + (columnCount - 1) * 3 <= width;
    if (!rows.length) { add(index, headers.join(' | ')); add(index, '(No rows)'); return; }
    if (wide) {
      const emit = row => {
        const raw = headers.map((_, i) => boundedText(row?.[i]));
        const wrapped = raw.map((value, i) => wrapParts(value, widths[i]));
        if (wrapped.some(cell => cell.truncated) || raw.some(value => value.endsWith('[Text truncated at reader safety limit]'))) truncated = true;
        const base = pages[index].length;
        for (let line = 0; line < Math.max(...wrapped.map(cell => cell.parts.length)); line++) {
          add(index, wrapped.map((cell, i) => { const text = cell.parts[line]?.text ?? ''; return text + ' '.repeat(widths[i] - displayWidth(text)); }).join(' | '), false);
          if (count >= MAX_LINES) { truncated = true; break; }
        }
        let offset = 0;
        raw.forEach((value, i) => { recordMatches(index, value, wrapped[i].parts, base, offset); offset += widths[i] + 3; });
      };
      emit(headers);
      add(index, widths.map(size => '-'.repeat(size)).join('-+-'));
      for (const row of rows) { emit(row); if (count >= MAX_LINES) { truncated = true; break; } }
    } else {
      for (let row = 0; row < rows.length; row++) {
        add(index, 'Row ' + (row + 1));
        for (let column = 0; column < columnCount; column++) add(index, headers[column] + ': ' + boundedText(rows[row]?.[column]));
        if (!columnCount) add(index, '(Empty row)');
        if (count >= MAX_LINES) { truncated = true; break; }
      }
    }
  };
  if (!valid) add(0, 'Unsupported Canvas report schema (expected schemaVersion: 1).');
  else {
    add(0, report.title || 'Untitled Canvas');
    if (report.summary) add(0, report.summary);
    if (!sections.length) add(0, '(No sections)');
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      add(index, (index + 1) + '. ' + (sanitizeText(section?.title) || 'Untitled section'));
      for (const block of array(section?.blocks)) {
        if (count >= MAX_LINES) { truncated = true; break; }
        switch (block?.type) {
          case 'text': add(index, block.text); break;
          case 'callout':
            add(index, '[' + (sanitizeText(block.tone) || 'info') + ']' + (block.title ? ' ' + sanitizeText(block.title) : ''));
            add(index, block.text); break;
          case 'metrics':
            for (const item of array(block.items)) { add(index, sanitizeText(item?.label) + ': ' + sanitizeText(item?.value) + (item?.detail ? ' — ' + sanitizeText(item.detail) : '')); if (count >= MAX_LINES) { truncated = true; break; } }
            break;
          case 'table': table(index, block); break;
          case 'list':
            array(block.items).some((item, i) => { add(index, (block.ordered ? (i + 1) + '.' : '•') + ' ' + sanitizeText(item)); if (count >= MAX_LINES) truncated = true; return count >= MAX_LINES; }); break;
          case 'bar-chart': {
            const items = array(block.items);
            const max = Math.max(1, ...items.slice(0, MAX_LINES).map(item => Math.abs(Number(item?.value)) || 0));
            for (const item of items) {
              const value = Number(item?.value);
              const bar = Number.isFinite(value) ? '█'.repeat(Math.round(Math.abs(value) / max * Math.min(24, Math.max(1, width - 12)))) : '';
              add(index, sanitizeText(item?.label) + ': ' + sanitizeText(item?.value) + ' ' + (value < 0 ? '-' : '') + bar);
              if (count >= MAX_LINES) { truncated = true; break; }
            }
            break;
          }
          case 'unsupported': add(index, '[Unsupported: ' + (sanitizeText(block.label) || 'block') + '] ' + sanitizeText(block.reason)); break;
          default: add(index, '[Unsupported block: ' + (sanitizeText(block?.type) || 'unknown') + '] No source code is executed.');
        }
        add(index, '');
      }
    }
  }
  if (array(report?.sections).length > MAX_SECTIONS) truncated = true;
  if (truncated) for (const page of pages) page.push(...wrapParts('[Reader safety limit: content truncated; search covers retained text only.]', width).parts.map(part => part.text));
  if (matchesTruncated) for (const page of pages) page.push(...wrapParts('[Search safety limit: first 10000 matches shown; refine the query.]', width).parts.map(part => part.text));
  return { lines: pages[active], width, sectionIndex: active, sectionCount,
    sections: sections.map((section, index) => ({ id: sanitizeText(section?.id), title: sanitizeText(section?.title), index })),
    matches, matchCount: matches.length, matchesTruncated, truncated, searchCoverage: truncated || matchesTruncated ? 'retained' : 'complete' };
}

function initialState(store) {
  const path = store.getSnapshot()?.path;
  return { mode: path ? 'reader' : 'library', path, document: null, loading: true,
    error: '', reload: 0, sectionIndex: 0, scroll: 0, reportQuery: '', matchIndex: -1,
    libraryQuery: '', pageOffset: 0, pageHistory: [], items: [], total: 0, nextOffset: null,
    selected: 0, searching: false };
}

/** @param {{list:Function,open:Function,subscribe:Function,getSnapshot:Function}} store
 * Returns a TuiSceneProps component for dsh-tui 0.16.1. No durable state, source
 * execution, network, images, browser, filesystem writes or global listeners. */
export function createCanvasScene(store) {
  return function CanvasScene(props) {
    const { React, ui } = props;
    const { createElement: h, useState, useEffect, useMemo } = React;
    const [state, setState] = useState(() => initialState(store));
    const size = ui.useTerminalSize();
    const width = clamp(integer(size.columns, 80), 1, 500);
    const height = clamp(integer(size.rows, 24), 1, 500);
    const headerRows = height >= 6 ? 3 : height >= 3 ? 1 : 0;
    const footerRows = height >= 7 && width < 60 ? 3 : height >= 4 ? 2 : height >= 2 ? 1 : 0;
    const viewport = Math.max(1, height - headerRows - footerRows);
    const patch = value => setState(current => ({ ...current, ...value }));

    useEffect(() => {
      let alive = true;
      const listen = () => {
        if (!alive) return;
        const path = store.getSnapshot()?.path;
        setState(current => ({ ...current, path, mode: path ? 'reader' : 'library', document: null,
          loading: true, error: '', searching: false, sectionIndex: 0, scroll: 0,
          reportQuery: '', matchIndex: -1, reload: current.reload + 1 }));
      };
      const dispose = store.subscribe(listen);
      // Subscribe before reading again, closing the render-to-effect request gap.
      const path = store.getSnapshot()?.path;
      if (path !== state.path) listen();
      return () => { alive = false; dispose(); };
    }, [store]);

    useEffect(() => {
      let alive = true;
      if (state.mode === 'reader') {
        patch({ loading: true, error: '', document: null });
        Promise.resolve().then(() => store.open(state.path)).then(document => {
          if (alive) patch({ loading: false, document, error: '' });
        }, error => { if (alive) patch({ loading: false, error: sanitizeText(error?.message || error) || 'Could not open report.' }); });
      } else {
        patch({ loading: true, error: '', items: [], selected: 0 });
        Promise.resolve().then(() => store.list({ q: state.libraryQuery, offset: state.pageOffset, limit: PAGE_SIZE })).then(page => {
          if (!alive) return;
          const items = array(page?.items).slice(0, PAGE_SIZE);
          const nextOffset = Number.isSafeInteger(page?.nextOffset) && page.nextOffset > state.pageOffset ? page.nextOffset : null;
          patch({ loading: false, items, total: Math.max(items.length, integer(page?.total, items.length)), nextOffset, scanComplete: page?.scanComplete !== false, error: '' });
        }, error => { if (alive) patch({ loading: false, error: sanitizeText(error?.message || error) || 'Could not list reports.' }); });
      }
      return () => { alive = false; };
    }, [store, state.mode, state.path, state.reload, state.libraryQuery, state.pageOffset]);

    const formatted = useMemo(() => state.document?.report
      ? formatReport(state.document.report, { width, sectionIndex: state.sectionIndex, query: state.reportQuery })
      : null, [state.document, width, state.sectionIndex, state.reportQuery]);
    const sectionIndex = formatted?.sectionIndex ?? 0;
    const sectionCount = formatted?.sectionCount ?? 1;
    const warnings = array(state.document?.warnings).map(value => 'Warning: ' + sanitizeText(value));
    let lines;
    if (state.loading) lines = ['Loading…'];
    else if (state.error) lines = wrapParts('Error: ' + boundedText(state.error) + '\nPress r to retry; Esc to go back.', width).parts.map(part => part.text);
    else if (state.mode === 'reader') {
      if (state.document?.legacy) lines = wrapParts('Legacy .canvas.tsx report — unsupported in the native reader.\n'
        + 'Only structured .canvas.json reports can be read here. No TSX/source code is evaluated.\n'
        + 'Title: ' + sanitizeText(state.document.title) + '\nPath: ' + sanitizeText(state.document.path)
        + (warnings.length ? '\n' + warnings.join('\n') : ''), width).parts.map(part => part.text);
      else if (formatted) lines = formatted.lines;
      else lines = ['Unsupported report: no structured data was returned.'];
    } else lines = [];
    const maxScroll = Math.max(0, lines.length - viewport);
    const scroll = clamp(state.scroll, 0, maxScroll);
    const selected = clamp(state.selected, 0, Math.max(0, state.items.length - 1));
    const libraryTop = Math.floor(selected / viewport) * viewport;

    const jump = direction => {
      if (!formatted?.matchCount) return;
      const index = state.matchIndex < 0 ? (direction < 0 ? formatted.matchCount - 1 : 0)
        : (state.matchIndex + direction + formatted.matchCount) % formatted.matchCount;
      const match = formatted.matches[index];
      patch({ matchIndex: index, sectionIndex: match.sectionIndex, scroll: match.line });
    };
    const nextPage = () => {
      if (state.nextOffset === null || state.loading) return;
      patch({ pageHistory: [...state.pageHistory, state.pageOffset], pageOffset: state.nextOffset, selected: 0 });
    };
    const previousPage = () => {
      if (!state.pageHistory.length || state.loading) return;
      patch({ pageOffset: state.pageHistory.at(-1), pageHistory: state.pageHistory.slice(0, -1), selected: 0 });
    };
    const back = () => {
      if (state.mode === 'reader') patch({ mode: 'library', document: null, loading: true, error: '', searching: false, scroll: 0 });
      else props.close();
    };
    const updateQuery = transform => setState(current => {
      const previous = current.mode === 'reader' ? current.reportQuery : current.libraryQuery;
      const query = clipText(sanitizeText(transform(previous)).replace(/\n/g, ' '), 256);
      return current.mode === 'reader'
        ? { ...current, reportQuery: query, matchIndex: -1, scroll: 0 }
        : { ...current, libraryQuery: query, pageOffset: 0, pageHistory: [], selected: 0 };
    });
    ui.useInput((input, key, event) => {
      // Full-screen scene owns input, but Ctrl+C still belongs to the host.
      if (key.ctrl || key.super || (key.meta && !key.escape)) return;
      event?.stopImmediatePropagation?.();
      if (state.searching) {
        if (key.escape) { patch({ searching: false }); return; }
        if (key.return && !key.isPasted && !event?.isPasted) {
          patch({ searching: false });
          if (state.mode === 'reader' && formatted?.matchCount) {
            const match = formatted.matches[0];
            patch({ sectionIndex: match.sectionIndex, scroll: match.line, matchIndex: 0 });
          }
          return;
        }
        if (key.backspace || key.delete) { updateQuery(query => graphemes(query).slice(0, -1).join('')); return; }
        if (input && !key.escape && !key.return) updateQuery(query => query + input);
        return;
      }
      if (key.isPasted || event?.isPasted) return;
      if (key.escape) { back(); return; }
      if (input === '/') { patch({ searching: true }); return; }
      if (input === 'r') { patch({ reload: state.reload + 1, loading: true }); return; }
      if (state.mode === 'reader') {
        if (key.leftArrow || key.rightArrow) {
          patch({ sectionIndex: clamp(sectionIndex + (key.rightArrow ? 1 : -1), 0, sectionCount - 1), scroll: 0, matchIndex: -1 }); return;
        }
        if (input === 'n' || input === 'N') { jump(input === 'N' ? -1 : 1); return; }
        if (key.home) patch({ scroll: 0 });
        else if (key.end) patch({ scroll: maxScroll });
        else if (key.upArrow || key.downArrow || key.pageUp || key.pageDown) patch({ scroll: clamp(scroll + (key.upArrow ? -1 : key.downArrow ? 1 : key.pageUp ? -viewport : viewport), 0, maxScroll) });
      } else if (!state.loading && !state.error) {
        if (key.return && state.items[selected]) {
          patch({ mode: 'reader', path: state.items[selected].path, document: null, loading: true,
            error: '', sectionIndex: 0, scroll: 0, reportQuery: '', matchIndex: -1 });
        } else if (key.home) patch({ pageOffset: 0, pageHistory: [], selected: 0 });
        else if (key.end) patch({ selected: Math.max(0, state.items.length - 1) });
        else if (key.pageDown) {
          if (selected + viewport >= state.items.length) nextPage();
          else patch({ selected: selected + viewport });
        } else if (key.pageUp) {
          if (selected === 0) previousPage();
          else patch({ selected: Math.max(0, selected - viewport) });
        } else if (key.downArrow || input === 'n') {
          if (selected === state.items.length - 1) nextPage();
          else patch({ selected: Math.min(state.items.length - 1, selected + 1) });
        } else if (key.upArrow || input === 'N') {
          if (selected === 0) previousPage();
          else patch({ selected: selected - 1 });
        }
      }
    }, { isActive: true, prepend: true });

    const title = state.mode === 'reader' ? 'Canvas · ' + (sanitizeText(state.document?.title || state.document?.report?.title) || sanitizeText(state.path)) : 'Canvas Library';
    const query = state.mode === 'reader' ? state.reportQuery : state.libraryQuery;
    const status = state.mode === 'reader'
      ? 'Section ' + (sectionIndex + 1) + '/' + sectionCount + ' · Lines ' + (scroll + 1) + '–' + Math.min(lines.length, scroll + viewport) + '/' + lines.length
      : (state.items.length ? state.pageOffset + selected + 1 : 0) + '/' + state.total + ' reports' + (state.nextOffset !== null ? ' · PgDn more' : '') + (state.scanComplete === false ? ' · PARTIAL SCAN (safety limit)' : '');
    const search = (state.searching ? '/' : 'Search: ') + query + (state.searching ? '▏' : '') + (state.mode === 'reader' && query ? ' · ' + (formatted?.matchCount ?? 0) + (formatted?.matchesTruncated ? '+' : '') + ' matches (n/N)' : state.mode === 'library' && query ? ' · ' + state.total + ' matches' : '');
    const help = state.mode === 'reader'
      ? '↑↓ PgUp/PgDn Home/End scroll · ←→ sections · / search · n/N match · r refresh · Esc library'
      : '↑↓ PgUp/PgDn Home/End select · Enter open · / search · r refresh · Esc close';
    const output = [];
    if (headerRows) output.push(title);
    if (headerRows > 1) output.push(status, warnings.length && !state.document?.legacy ? warnings.join(' · ') : width < 60 ? 'Read-only · no source execution' : state.document?.legacy ? 'Read-only · legacy TSX · no source execution' : 'Read-only · structured Canvas · no source execution');
    if (state.mode === 'library' && !state.loading && !state.error) {
      const visible = state.items.slice(libraryTop, libraryTop + viewport);
      output.push(...visible.map((item, index) => (libraryTop + index === selected ? '› ' : '  ')
        + '[' + (item.error ? 'invalid' : item.format === 'legacy' ? (width < 60 ? 'legacy' : 'legacy / unsupported') : 'structured') + '] ' + sanitizeText(item.title || item.path) + ' · ' + sanitizeText(item.shortPath || item.path)));
      if (!visible.length) output.push('No reports found. / search · r refresh');
    } else output.push(...lines.slice(scroll, scroll + viewport));
    while (output.length < headerRows + viewport) output.push('');
    if (footerRows > 1) output.push(search + ' · ' + status);
    if (footerRows > 2) {
      output.push(state.searching ? 'Type search · Enter apply' : state.mode === 'reader' ? '↑↓ scroll · ←→ section · / search' : '↑↓ select · Enter open · / search');
      output.push(state.searching ? 'Backspace delete · Esc finish' : state.mode === 'reader' ? 'PgUp/Dn · n/N · r refresh · Esc back' : 'PgUp/Dn · r refresh · Esc close');
    } else if (footerRows) output.push(state.searching ? 'Search: type text · Enter apply · Esc finish · Backspace delete' : help);
    return h(ui.Box, { flexDirection: 'column', width, height, overflow: 'hidden' },
      ...output.slice(0, height).map((line, index) => h(ui.Text, { key: index, wrap: 'truncate-end', height: 1 }, clipText(line, width) || ' ')));
  };
}
