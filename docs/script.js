document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadSection = document.getElementById('upload-section');
    const processingSection = document.getElementById('processing-section');
    const resultsSection = document.getElementById('results-section');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const resultsBody = document.getElementById('results-body');
    const resetBtn = document.getElementById('reset-btn');
    const backLink = document.getElementById('back-link');
    const runningToggle = document.getElementById('running-toggle');
    const extrasToggleWrapper = document.getElementById('extras-toggle-wrapper');
    const extrasToggle = document.getElementById('extras-toggle');
    const countHeader = document.getElementById('count-header');
    const readingTimeEl = document.getElementById('reading-time');
    const readingTimeLabel = document.getElementById('reading-time-label');
    const wpmControl = document.getElementById('wpm-control');
    const wpmInput = document.getElementById('wpm-input');
    const wpmApply = document.getElementById('wpm-apply');

    let baseResults = null;
    let currentResults = null;
    let wpm = 250;
    let showRunningTotals = false;
    let includeExtras = false;
    let historyStatePushed = false;

    // Drag and Drop handlers
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    resetBtn.addEventListener('click', goBack);
    backLink.addEventListener('click', goBack);

    window.addEventListener('popstate', () => {
        historyStatePushed = false;
        resetApp();
    });

    function goBack() {
        if (historyStatePushed) {
            history.back();
        } else {
            resetApp();
        }
    }
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
        wpmControl.classList.add('hidden');
    });

    wpmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            wpmApply.click();
        }
    });

    function resetApp() {
        fileInput.value = '';
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        progressBar.style.width = '0%';
        resultsBody.innerHTML = '';
        baseResults = null;
        currentResults = null;
        showRunningTotals = false;
        runningToggle.checked = false;
        wpmControl.classList.add('hidden');
        includeExtras = false;
        extrasToggle.checked = false;
        extrasToggleWrapper.classList.add('hidden');
    }

    window.handleFile = handleFile;

    document.getElementById('try-example').addEventListener('click', async (e) => {
        e.preventDefault();
        const res = await fetch('example/The Bat (1920).epub');
        const blob = await res.blob();
        const file = new File([blob], 'The Bat (1920).epub', { type: 'application/epub+zip' });
        handleFile(file);
    });

    async function handleFile(file) {
        if (file.type !== 'application/epub+zip' && !file.name.endsWith('.epub')) {
            alert('Please upload a valid EPUB file.');
            return;
        }

        uploadSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        statusText.textContent = 'Unzipping file...';

        try {
            const parser = new EPubParser();
            await parser.parse(file, (progress, message) => {
                progressBar.style.width = `${progress}%`;
                statusText.textContent = message;
            });

            displayResults(parser.results);
        } catch (error) {
            console.error(error);
            alert('Error parsing EPUB: ' + error.message);
            resetApp();
        } finally {
            processingSection.classList.add('hidden');
        }
    }

    function displayResults(results) {
        baseResults = results;
        // If the TOC covers <=20% of the spine's total words, the TOC is
        // almost certainly incomplete (e.g. only points at the titlepage) —
        // default to including extras so the user sees the real total.
        const tocCoverage = results.totalWordsAll > 0
            ? results.totalWords / results.totalWordsAll
            : 1;
        includeExtras = !results.tocAvailable || tocCoverage <= 0.20;
        extrasToggle.checked = includeExtras;
        if (results.tocAvailable && results.hasNonTocItems) {
            extrasToggleWrapper.classList.remove('hidden');
        } else {
            extrasToggleWrapper.classList.add('hidden');
        }

        // Show book info
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
        refreshResultsView(true);

        if (!historyStatePushed) {
            history.pushState({ view: 'results' }, '');
            historyStatePushed = true;
        }
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
            return;
        }
        document.getElementById('total-words').textContent = results.totalWords.toLocaleString();
        document.getElementById('total-chapters').textContent = results.chapters.length.toLocaleString();
    }

    function updateReadingTime() {
        if (!currentResults) return;
        const minutes = Math.ceil(currentResults.totalWords / wpm);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        let timeString = `${minutes}m`;
        if (hours > 0) {
            timeString = `${hours}h ${remainingMinutes}m`;
        }
        readingTimeEl.textContent = timeString;
        readingTimeLabel.textContent = `Reading Time (${wpm} wpm)`;
    }

    function renderTable(results) {
        resultsBody.innerHTML = '';
        countHeader.textContent = showRunningTotals ? 'Running Total' : 'Word Count';
        let runningTotal = 0;

        results.chapters.forEach(chapter => {
            runningTotal += chapter.wordCount;
            const displayCount = showRunningTotals ? runningTotal : chapter.wordCount;
            const percentage = ((displayCount / results.totalWords) * 100).toFixed(1);
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${chapter.title}</td>
                <td class="text-right">${displayCount.toLocaleString()}</td>
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

    async parse(file, onProgress) {
        onProgress(10, 'Reading file structure...');
        this.zip = await JSZip.loadAsync(file);

        const containerXml = await this.zip.file('META-INF/container.xml').async('text');
        const opfPath = this.getOpfPath(containerXml);

        onProgress(20, 'Parsing metadata...');
        const opfContent = await this.zip.file(opfPath).async('text');
        const opfDoc = new DOMParser().parseFromString(opfContent, 'application/xml');
        const metadata = this.parseMetadata(opfDoc);
        const { spine, manifest, tocId } = this.parseOpf(opfContent, opfPath);

        // Try to get chapter titles from TOC if available
        let tocMap = {};
        let tocOrder = [];
        if (tocId && manifest[tocId]) {
            try {
                const tocPath = this.resolvePath(opfPath, manifest[tocId].href);
                const tocContent = await this.zip.file(tocPath).async('text');
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
                const content = await file.async('text');
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

        const tocChapters = [];
        const allChapters = [];
        const included = new Set();

        if (tocOrder.length > 0) {
            tocOrder.forEach(path => {
                const chapter = spineMap.get(path);
                if (!chapter || chapter.wordCount <= 0 || included.has(path)) return;
                tocChapters.push(chapter);
                allChapters.push(chapter);
                included.add(path);
            });
        }

        spineOrder.forEach(path => {
            if (included.has(path)) return;
            const chapter = spineMap.get(path);
            if (!chapter || chapter.wordCount <= 0) return;
            allChapters.push(chapter);
        });

        const totalWordsToc = tocChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
        const totalWordsAll = allChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
        const tocAvailable = tocOrder.length > 0;

        this.results = {
            fileName: file.name,
            bookTitle: metadata.title || null,
            bookAuthor: metadata.author || null,
            totalWords: tocAvailable ? totalWordsToc : totalWordsAll,
            totalWordsAll,
            chapters: tocAvailable ? tocChapters : allChapters,
            chaptersAll: allChapters,
            tocAvailable,
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

        // Handle NCX (EPUB 2)
        const ncxDoc = parser.parseFromString(tocContent, 'application/xml');
        const navPoints = Array.from(ncxDoc.getElementsByTagName('navPoint'));
        if (navPoints.length > 0) {
            navPoints.forEach(point => {
                const labelNode = point.querySelector('navLabel > text');
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
