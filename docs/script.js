document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadSection = document.getElementById('upload-section');
    const processingSection = document.getElementById('processing-section');
    const resultsSection = document.getElementById('results-section');
    const librarySection = document.getElementById('library-section');
    const libraryBody = document.getElementById('library-body');
    const libraryBackLink = document.getElementById('library-back-link');
    const libraryCsvBtn = document.getElementById('library-csv-btn');
    const libraryFilenamesToggle = document.getElementById('library-filenames-toggle');
    const detailCsvBtn = document.getElementById('detail-csv-btn');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const resultsBody = document.getElementById('results-body');
    const resetBtn = document.getElementById('reset-btn');
    const backLink = document.getElementById('back-link');
    const runningToggle = document.getElementById('running-toggle');
    const extrasToggleWrapper = document.getElementById('extras-toggle-wrapper');
    const extrasToggle = document.getElementById('extras-toggle');
    const countHeader = document.getElementById('count-header');
    const pagesHeader = document.getElementById('pages-header');
    const pagesLabel = document.getElementById('pages-label');
    const readingTimeEl = document.getElementById('reading-time');
    const readingTimeLabel = document.getElementById('reading-time-label');
    const wpmControl = document.getElementById('wpm-control');
    const wpmInput = document.getElementById('wpm-input');
    const wpmApply = document.getElementById('wpm-apply');
    const totalPagesEl = document.getElementById('total-pages');
    const pagesControl = document.getElementById('pages-control');
    const pagesInput = document.getElementById('pages-input');
    const pagesApply = document.getElementById('pages-apply');

    // library: [{ file, results?, error? }, ...] — populated by handleFiles,
    // survives library ⇄ detail navigation so back-button restores the table.
    let library = [];
    let baseResults = null;
    let currentResults = null;
    let cameFromLibrary = false;
    let wpm = 250;
    let words_per_page = 275;
    let showRunningTotals = false;
    let includeExtras = false;
    let showLibraryFilenames = false;

    updatePagesLabel();

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    resetBtn.addEventListener('click', () => history.back());
    backLink.addEventListener('click', () => history.back());
    libraryBackLink.addEventListener('click', () => history.back());
    libraryCsvBtn.addEventListener('click', exportLibraryCSV);
    libraryFilenamesToggle.addEventListener('change', () => {
        showLibraryFilenames = libraryFilenamesToggle.checked;
        renderLibrary();
    });
    detailCsvBtn.addEventListener('click', exportDetailCSV);

    window.addEventListener('popstate', (e) => {
        const state = e.state;
        if (!state) {
            showUploadView();
            return;
        }
        if (state.view === 'library') {
            cameFromLibrary = false;
            showLibraryView();
        } else if (state.view === 'detail') {
            const idx = state.bookIndex;
            if (idx != null && library[idx] && library[idx].results) {
                cameFromLibrary = true;
                showDetailView(library[idx].results, false);
            } else if (library.length === 1 && library[0].results) {
                cameFromLibrary = false;
                showDetailView(library[0].results, false);
            } else {
                showUploadView();
            }
        }
    });

    runningToggle.addEventListener('change', () => {
        showRunningTotals = runningToggle.checked;
        if (currentResults) {
            renderTable(currentResults);
        }
    });

    extrasToggle.addEventListener('change', () => {
        includeExtras = extrasToggle.checked;
        refreshResultsView(false);
    });

    readingTimeEl.addEventListener('click', () => {
        wpmControl.classList.toggle('hidden');
        if (!wpmControl.classList.contains('hidden')) {
            wpmInput.focus();
            wpmInput.select();
        }
    });

    wpmApply.addEventListener('click', () => {
        const nextValue = Number.parseInt(wpmInput.value, 10);
        if (!Number.isFinite(nextValue) || nextValue <= 0) {
            return;
        }
        wpm = Math.min(Math.max(nextValue, 100), 1000);
        wpmInput.value = wpm;
        updateReadingTime();
        if (library.length > 1) renderLibrary();
        wpmControl.classList.add('hidden');
    });

    wpmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            wpmApply.click();
        }
    });

    totalPagesEl.addEventListener('click', () => {
        pagesControl.classList.toggle('hidden');
        if (!pagesControl.classList.contains('hidden')) {
            pagesInput.focus();
            pagesInput.select();
        }
    });

    pagesApply.addEventListener('click', () => {
        const nextValue = Number.parseInt(pagesInput.value, 10);
        if (!Number.isFinite(nextValue) || nextValue <= 0) {
            return;
        }
        words_per_page = Math.min(Math.max(nextValue, 100), 1000);
        pagesInput.value = words_per_page;
        updatePagesLabel();
        if (currentResults) {
            updateSummary(currentResults, false);
            renderTable(currentResults);
        }
        pagesControl.classList.add('hidden');
    });

    pagesInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            pagesApply.click();
        }
    });

    function showUploadView() {
        fileInput.value = '';
        resultsSection.classList.add('hidden');
        librarySection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        progressBar.style.width = '0%';
        wpmControl.classList.add('hidden');
        pagesControl.classList.add('hidden');
        cameFromLibrary = false;
        // Leave library/baseResults intact so forward-nav still works.
    }

    function showLibraryView() {
        uploadSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        librarySection.classList.remove('hidden');
        renderLibrary();
    }

    function showDetailView(results, animate) {
        uploadSection.classList.add('hidden');
        librarySection.classList.add('hidden');
        backLink.textContent = cameFromLibrary ? '← Back to books' : '← Choose another book';
        resetBtn.textContent = cameFromLibrary ? 'Back to books' : 'Analyze Another Book';
        displayResults(results, animate);
    }

    window.handleFile = (file) => handleFiles([file]);
    window.handleFiles = handleFiles;

    document.getElementById('try-example').addEventListener('click', async (e) => {
        e.preventDefault();
        const res = await fetch('example/The Bat (1920).epub');
        const blob = await res.blob();
        const file = new File([blob], 'The Bat (1920).epub', { type: 'application/epub+zip' });
        handleFiles([file]);
    });

    async function handleFiles(fileList) {
        const epubs = Array.from(fileList).filter(
            f => f.type === 'application/epub+zip' || f.name.toLowerCase().endsWith('.epub')
        );
        if (epubs.length === 0) {
            alert('Please drop one or more EPUB files.');
            return;
        }

        uploadSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        statusText.textContent = 'Unzipping file...';
        progressBar.style.width = '0%';

        library = [];
        const multi = epubs.length > 1;

        for (let i = 0; i < epubs.length; i++) {
            const file = epubs[i];
            const prefix = multi ? `(${i + 1}/${epubs.length}) ` : '';
            try {
                const parser = new EPubParser();
                await parser.parse(file, (progress, message) => {
                    const overall = multi
                        ? ((i + progress / 100) / epubs.length) * 100
                        : progress;
                    progressBar.style.width = `${overall}%`;
                    statusText.textContent = prefix + message;
                });
                library.push({ file, results: parser.results });
            } catch (err) {
                console.error(err);
                if (!multi) {
                    const errPrefix = err.code === 'EPUB_DRM' ? '' : 'Error parsing EPUB: ';
                    alert(errPrefix + err.message);
                    processingSection.classList.add('hidden');
                    showUploadView();
                    return;
                }
                library.push({ file, error: err });
            }
        }

        processingSection.classList.add('hidden');

        const successful = library.filter(b => b.results);
        if (successful.length === 1 && library.length === 1) {
            cameFromLibrary = false;
            showDetailView(library[0].results, true);
            history.pushState({ view: 'detail', bookIndex: null }, '');
        } else {
            cameFromLibrary = false;
            showLibraryView();
            history.pushState({ view: 'library' }, '');
        }
    }

    function renderLibrary() {
        libraryBody.innerHTML = '';
        let totalWords = 0;
        let totalChapters = 0;

        library.forEach((entry, idx) => {
            const tr = document.createElement('tr');
            if (entry.error) {
                tr.classList.add('error-row');
                const msg = entry.error.code === 'EPUB_DRM' ? 'DRM-protected' : (entry.error.message || 'Failed to parse');
                tr.innerHTML = `
                    <td>
                        <div class="book-cell-title">${escapeHtml(entry.file.name)}</div>
                        <div class="book-cell-filename">${escapeHtml(msg)}</div>
                    </td>
                    <td></td>
                    <td class="text-right">&mdash;</td>
                    <td class="text-right">&mdash;</td>
                    <td class="text-right">&mdash;</td>
                `;
            } else {
                const r = entry.results;
                const words = r.totalWords;
                const chapters = r.chapters.length;
                totalWords += words;
                totalChapters += chapters;
                const title = r.bookTitle || r.fileName;
                const showFilename = showLibraryFilenames && r.bookTitle && r.fileName && r.fileName !== r.bookTitle;
                tr.innerHTML = `
                    <td>
                        <div class="book-cell-title">${escapeHtml(title)}</div>
                        ${showFilename ? `<div class="book-cell-filename">${escapeHtml(r.fileName)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(r.bookAuthor || '')}</td>
                    <td class="text-right">${words.toLocaleString()}</td>
                    <td class="text-right">${chapters.toLocaleString()}</td>
                    <td class="text-right">${formatReadingTime(Math.ceil(words / wpm))}</td>
                `;
                tr.addEventListener('click', () => openBookFromLibrary(idx));
            }
            libraryBody.appendChild(tr);
        });

        document.getElementById('library-total-words').textContent = totalWords.toLocaleString();
        document.getElementById('library-total-chapters').textContent = totalChapters.toLocaleString();
        document.getElementById('library-total-time').textContent = formatReadingTime(Math.ceil(totalWords / wpm));
    }

    function openBookFromLibrary(idx) {
        const entry = library[idx];
        if (!entry || !entry.results) return;
        cameFromLibrary = true;
        showDetailView(entry.results, true);
        history.pushState({ view: 'detail', bookIndex: idx }, '');
    }

    function displayResults(results, animate = true) {
        baseResults = results;
        // If the TOC has only 1–2 entries against a much larger spine, it's
        // almost certainly broken (e.g. points only at the titlepage) —
        // default to including extras so the user sees the real chapters.
        const tocLooksBroken = results.tocAvailable
            && results.uniqueTocEntries < 3
            && results.spineItemCount >= 5;
        includeExtras = !results.tocAvailable || tocLooksBroken;
        extrasToggle.checked = includeExtras;
        if (results.tocAvailable && results.hasNonTocItems) {
            extrasToggleWrapper.classList.remove('hidden');
        } else {
            extrasToggleWrapper.classList.add('hidden');
        }

        const titleEl = document.getElementById('book-title');
        const authorEl = document.getElementById('book-author');
        const filenameEl = document.getElementById('book-filename');

        titleEl.textContent = results.bookTitle || '';
        titleEl.classList.toggle('hidden', !results.bookTitle);

        authorEl.textContent = results.bookAuthor ? `by ${results.bookAuthor}` : '';
        authorEl.classList.toggle('hidden', !results.bookAuthor);

        filenameEl.textContent = results.fileName || '';
        filenameEl.classList.toggle('hidden', !results.fileName);

        resultsSection.classList.remove('hidden');
        refreshResultsView(animate);
    }

    function refreshResultsView(animate) {
        currentResults = getActiveResults();
        if (!currentResults) return;
        updateSummary(currentResults, animate);
        updateReadingTime();
        renderTable(currentResults);
    }

    function getActiveResults() {
        if (!baseResults) return null;
        if (!baseResults.tocAvailable || !includeExtras) {
            return baseResults;
        }
        return {
            ...baseResults,
            chapters: baseResults.chaptersAll,
            totalWords: baseResults.totalWordsAll
        };
    }

    function updateSummary(results, animate) {
        if (animate) {
            animateValue('total-words', 0, results.totalWords, 1000);
            animateValue('total-chapters', 0, results.chapters.length, 1000);
            animateValue('total-pages', 0, estimatePages(results.totalWords), 1000);
            return;
        }
        document.getElementById('total-words').textContent = results.totalWords.toLocaleString();
        document.getElementById('total-chapters').textContent = results.chapters.length.toLocaleString();
        document.getElementById('total-pages').textContent = estimatePages(results.totalWords).toLocaleString();
    }

    function updateReadingTime() {
        if (!currentResults) return;
        readingTimeEl.textContent = formatReadingTime(Math.ceil(currentResults.totalWords / wpm));
        readingTimeLabel.innerHTML = `Reading Time <span class="nowrap">(${wpm} wpm)</span>`;
    }

    function formatReadingTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const rem = minutes % 60;
        return hours > 0 ? `${hours}h ${rem}m` : `${minutes}m`;
    }

    function estimatePages(words) {
        return Math.ceil(words / words_per_page);
    }

    function updatePagesLabel() {
        pagesLabel.innerHTML = `Pages <span class="nowrap">(${words_per_page} words/page)</span>`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toCSV(rows) {
        return rows.map(row => row.map(cell => {
            const s = cell == null ? '' : String(cell);
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')).join('\r\n');
    }

    function downloadCSV(filename, csvText) {
        const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function safeFilename(s) {
        return String(s).replace(/[/\\?%*:|"<>]/g, '_').trim() || 'export';
    }

    function exportLibraryCSV() {
        if (library.length === 0) return;
        const rows = [['Filename', 'Title', 'Author', 'Words', 'Chapters', 'Reading Time (min)']];
        let totalW = 0, totalC = 0;
        library.forEach(entry => {
            if (entry.error) {
                rows.push([entry.file.name, '', '', 'ERROR', entry.error.message || '', '']);
                return;
            }
            const r = entry.results;
            totalW += r.totalWords;
            totalC += r.chapters.length;
            rows.push([
                r.fileName,
                r.bookTitle || '',
                r.bookAuthor || '',
                r.totalWords,
                r.chapters.length,
                Math.ceil(r.totalWords / wpm)
            ]);
        });
        rows.push(['Total', '', '', totalW, totalC, Math.ceil(totalW / wpm)]);
        downloadCSV('epub-library.csv', toCSV(rows));
    }

    function exportDetailCSV() {
        if (!baseResults) return;
        // Always export every spine item with words, regardless of the
        // include-extras toggle or the running-total view: the CSV is the
        // raw data, not the current view.
        const rows = [['Chapter', 'Words', 'in_toc']];
        let total = 0;
        baseResults.chaptersAll.forEach(ch => {
            total += ch.wordCount;
            rows.push([ch.title, ch.wordCount, ch.inToc ? 'true' : 'false']);
        });
        rows.push(['Total', total, '']);
        const base = baseResults.bookTitle || baseResults.fileName || 'book';
        downloadCSV(`${safeFilename(base)}.csv`, toCSV(rows));
    }

    function renderTable(results) {
        resultsBody.innerHTML = '';
        countHeader.textContent = showRunningTotals ? 'Running Total' : 'Word Count';
        pagesHeader.textContent = showRunningTotals ? 'Running Pages (est.)' : 'Pages (est.)';
        let runningTotal = 0;

        results.chapters.forEach(chapter => {
            runningTotal += chapter.wordCount;
            const displayCount = showRunningTotals ? runningTotal : chapter.wordCount;
            const displayPages = estimatePages(displayCount);
            const percentage = ((displayCount / results.totalWords) * 100).toFixed(1);
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${chapter.title}</td>
                <td class="text-right">${displayCount.toLocaleString()}</td>
                <td class="text-right">${displayPages.toLocaleString()}</td>
                <td class="text-right">${percentage}%</td>
            `;
            resultsBody.appendChild(tr);
        });
    }

    function animateValue(id, start, end, duration) {
        const obj = document.getElementById(id);
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});

class EPubParser {
    constructor() {
        this.zip = null;
        this.results = {
            totalWords: 0,
            chapters: []
        };
    }

    async readText(zipEntry) {
        // Strip a leading UTF-8 BOM — DOMParser treats U+FEFF before <?xml as
        // a stray character and produces a parsererror, which then makes
        // querySelector return null and downstream getAttribute throw.
        const text = await zipEntry.async('text');
        return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    }

    async parse(file, onProgress) {
        onProgress(10, 'Reading file structure...');
        this.zip = await JSZip.loadAsync(file);

        // Detect DRM before trying to read scrambled chapters (which would fail)
        // Font-only obfuscation leaves text readable,
        // so only flag when an actual content file is encrypted.
        const encFile = this.zip.file('META-INF/encryption.xml');
        if (encFile) {
            const encXml = await this.readText(encFile);
            const encryptsContent = /CipherReference\s+URI="[^"]*\.(x?html?|opf|ncx)"/i.test(encXml);
            if (encryptsContent) {
                const isAdept = encXml.includes('http://ns.adobe.com/adept');
                const flavor = isAdept ? 'Adobe Adept DRM' : 'DRM';
                const err = new Error(
                    `This EPUB is protected by ${flavor}: its text content is encrypted, ` +
                    `so we can't count words. You'll need to remove the DRM first ` +
                    `(e.g. by opening it in a tool that can decrypt your purchased copy).`
                );
                err.code = 'EPUB_DRM';
                throw err;
            }
        }

        const containerXml = await this.readText(this.zip.file('META-INF/container.xml'));
        const opfPath = this.getOpfPath(containerXml);

        onProgress(20, 'Parsing metadata...');
        const opfContent = await this.readText(this.zip.file(opfPath));
        const opfDoc = new DOMParser().parseFromString(opfContent, 'application/xml');
        const metadata = this.parseMetadata(opfDoc);
        const { spine, manifest, tocId } = this.parseOpf(opfContent, opfPath);

        // Try to get chapter titles from TOC if available
        let tocMap = {};
        let tocOrder = [];
        if (tocId && manifest[tocId]) {
            try {
                const tocPath = this.resolvePath(opfPath, manifest[tocId].href);
                const tocContent = await this.readText(this.zip.file(tocPath));
                const tocData = this.parseToc(tocContent, tocPath);
                tocMap = tocData.map;
                tocOrder = tocData.order;
            } catch (e) {
                console.warn('Could not parse TOC', e);
            }
        }

        onProgress(30, 'Counting words...');
        const totalItems = spine.length;
        const spineMap = new Map();
        const spineOrder = [];

        for (let i = 0; i < totalItems; i++) {
            const itemId = spine[i];
            const item = manifest[itemId];
            if (!item) continue;

            const itemPath = this.resolvePath(opfPath, item.href);
            const normalizedPath = this.normalizePath(itemPath);
            const file = this.zip.file(itemPath);

            if (file) {
                const content = await this.readText(file);
                const wordCount = this.countWordsInHtml(content);
                const title = tocMap[normalizedPath] || `Chapter ${i + 1}`;

                spineMap.set(normalizedPath, {
                    title,
                    wordCount,
                    href: item.href
                });
                spineOrder.push(normalizedPath);
            }

            const percent = 30 + Math.floor(((i + 1) / totalItems) * 70);
            onProgress(percent, `Analyzing chapter ${i + 1} of ${totalItems}...`);
        }

        // Walk spine in order. TOC entries define chapter boundaries; any
        // spine item NOT in the TOC folds into the preceding TOC chapter
        // (e.g. Calibre splits chapters into a heading file + body file but
        // only links the heading from the TOC — without folding, the body
        // would orphan into extras and the TOC chapter would show 1 word).
        const tocPathSet = new Set(tocOrder);
        const tocChapters = [];
        const allChapters = [];
        let currentTocChapter = null;

        for (const path of spineOrder) {
            const item = spineMap.get(path);
            if (!item) continue;

            const inToc = tocPathSet.has(path);

            if (inToc) {
                if (currentTocChapter && currentTocChapter.wordCount > 0) {
                    tocChapters.push(currentTocChapter);
                }
                currentTocChapter = {
                    title: tocMap[path] || item.title,
                    wordCount: item.wordCount,
                    href: item.href
                };
            } else if (currentTocChapter) {
                currentTocChapter.wordCount += item.wordCount;
            }

            if (item.wordCount > 0) {
                // Non-TOC items inherit the preceding TOC chapter's title so
                // the CSV (and the include-extras view) shows which TOC
                // chapter the split-off file belongs to, instead of an
                // opaque "Chapter N".
                const allTitle = inToc
                    ? (tocMap[path] || item.title)
                    : (currentTocChapter ? currentTocChapter.title : item.title);
                allChapters.push({
                    title: allTitle,
                    wordCount: item.wordCount,
                    href: item.href,
                    inToc
                });
            }
        }
        if (currentTocChapter && currentTocChapter.wordCount > 0) {
            tocChapters.push(currentTocChapter);
        }

        const totalWordsToc = tocChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
        const totalWordsAll = allChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
        const tocAvailable = tocOrder.length > 0;
        const uniqueTocEntries = new Set(tocOrder).size;

        this.results = {
            fileName: file.name,
            bookTitle: metadata.title || null,
            bookAuthor: metadata.author || null,
            totalWords: tocAvailable ? totalWordsToc : totalWordsAll,
            totalWordsAll,
            chapters: tocAvailable ? tocChapters : allChapters,
            chaptersAll: allChapters,
            tocAvailable,
            uniqueTocEntries,
            spineItemCount: spineOrder.length,
            hasNonTocItems: tocAvailable && allChapters.length > tocChapters.length
        };

        onProgress(100, 'Done!');
    }

    getOpfPath(containerXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, 'application/xml');
        return doc.querySelector('rootfile').getAttribute('full-path');
    }

    parseMetadata(opfDoc) {
        const meta = {};
        // Try namespace-aware lookup first, fall back to getElementsByTagName
        const getTag = (tag) => {
            const els = opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
            return els.length > 0 ? els[0].textContent.trim() : null;
        };
        meta.title = getTag('title');
        meta.author = getTag('creator');
        // Fallback: non-namespaced search (some EPUBs use plain tags)
        if (!meta.title) {
            const t = opfDoc.getElementsByTagName('dc:title')[0];
            if (t) meta.title = t.textContent.trim();
        }
        if (!meta.author) {
            const a = opfDoc.getElementsByTagName('dc:creator')[0];
            if (a) meta.author = a.textContent.trim();
        }
        return meta;
    }

    parseOpf(opfContent, opfPath) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(opfContent, 'application/xml');

        // Use namespace-wildcard lookup: some EPUBs prefix manifest/spine tags
        // (e.g. <opf:item>), which getElementsByTagName won't match in XML mode.
        const manifestItems = Array.from(doc.getElementsByTagNameNS('*', 'item'))
            .filter(el => el.parentNode && el.parentNode.localName === 'manifest');
        const manifest = {};
        let tocId = null;

        manifestItems.forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            const properties = item.getAttribute('properties') || '';

            manifest[id] = { href, mediaType };

            if (properties.includes('nav')) {
                tocId = id; // EPUB 3 Navigation Document
            }
        });

        // Fallback for EPUB 2 NCX
        if (!tocId) {
            const spine = doc.getElementsByTagNameNS('*', 'spine')[0];
            if (spine) tocId = spine.getAttribute('toc');
        }

        const spineItems = Array.from(doc.getElementsByTagNameNS('*', 'itemref'));
        const spine = spineItems.map(item => item.getAttribute('idref'));

        return { spine, manifest, tocId };
    }

    resolvePath(base, relative) {
        const stack = base.split('/');
        stack.pop(); // Remove filename

        const parts = relative.split('/');
        for (const part of parts) {
            if (part === '.') continue;
            if (part === '..') {
                stack.pop();
            } else {
                stack.push(part);
            }
        }
        return stack.join('/');
    }

    parseToc(tocContent, tocPath) {
        const parser = new DOMParser();
        const map = {};
        const order = [];

        // Handle NCX (EPUB 2). Try XML first; if the NCX is malformed
        // (mismatched/duplicate navPoint tags happen in the wild), fall back
        // to the forgiving HTML parser so we don't lose chapter titles.
        const ncxXmlDoc = parser.parseFromString(tocContent, 'application/xml');
        const ncxHasError = ncxXmlDoc.getElementsByTagName('parsererror').length > 0;
        const ncxDoc = ncxHasError
            ? parser.parseFromString(tocContent, 'text/html')
            : ncxXmlDoc;
        // HTML parser lowercases tag names; XML preserves case.
        const navPointTag = ncxHasError ? 'navpoint' : 'navPoint';
        const navPoints = Array.from(ncxDoc.getElementsByTagName(navPointTag));
        if (navPoints.length > 0) {
            navPoints.forEach(point => {
                const labelNode = point.querySelector(ncxHasError ? 'navlabel > text' : 'navLabel > text');
                const contentNode = point.querySelector('content');
                if (!labelNode || !contentNode) return;
                let src = contentNode.getAttribute('src') || '';
                src = src.split('#')[0];
                const resolved = this.resolvePath(tocPath, src);
                const normalized = this.normalizePath(resolved);
                map[normalized] = labelNode.textContent.trim();
                order.push(normalized);
            });
            return { map, order };
        }

        // Handle HTML Nav (EPUB 3)
        const navDoc = parser.parseFromString(tocContent, 'text/html');
        let anchors = Array.from(navDoc.querySelectorAll('nav[epub\\:type~="toc"] a, nav[role="doc-toc"] a'));
        if (anchors.length === 0) {
            // Some parsers don't match the colon-in-attribute selector; fall back to manual scan.
            const navs = Array.from(navDoc.getElementsByTagName('nav'));
            const tocNav = navs.find(n => {
                const epubType = n.getAttribute('epub:type') || '';
                if (epubType.split(/\s+/).includes('toc')) return true;
                if (n.getAttribute('role') === 'doc-toc') return true;
                return false;
            }) || (navs.length === 1 ? navs[0] : null);
            if (tocNav) {
                anchors = Array.from(tocNav.getElementsByTagName('a'));
            }
        }
        anchors.forEach(a => {
            let href = a.getAttribute('href') || '';
            href = href.split('#')[0];
            if (!href) return;
            const resolved = this.resolvePath(tocPath, href);
            const normalized = this.normalizePath(resolved);
            map[normalized] = a.textContent.trim();
            order.push(normalized);
        });

        return { map, order };
    }

    normalizePath(path) {
        let normalized = path.replace(/\\/g, '/');
        try {
            normalized = decodeURIComponent(normalized);
        } catch (e) {
            // ignore decode errors
        }
        return normalized.replace(/\/+/g, '/');
    }

    countWordsInHtml(htmlContent) {
        const text = this.extractBodyText(htmlContent);
        const words = text.trim().split(/\s+/);
        return words.length === 1 && words[0] === '' ? 0 : words.length;
    }

    extractBodyText(content) {
        const parser = new DOMParser();
        // Try XML first: XHTML chapters often use self-closing tags like <title/>,
        // which the HTML parser misinterprets as a rawtext opener that swallows
        // the rest of the document.
        const xmlDoc = parser.parseFromString(content, 'application/xhtml+xml');
        if (!xmlDoc.getElementsByTagName('parsererror').length) {
            const body = xmlDoc.getElementsByTagName('body')[0];
            if (body) return body.textContent || '';
            return xmlDoc.documentElement ? (xmlDoc.documentElement.textContent || '') : '';
        }
        // Fall back to HTML parser for content that isn't well-formed XML.
        const htmlDoc = parser.parseFromString(content, 'text/html');
        return htmlDoc.body ? (htmlDoc.body.textContent || '') : '';
    }
}
