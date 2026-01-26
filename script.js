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

    resetBtn.addEventListener('click', resetApp);

    function resetApp() {
        fileInput.value = '';
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        progressBar.style.width = '0%';
        resultsBody.innerHTML = '';
    }

    window.handleFile = handleFile;

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
        resultsSection.classList.remove('hidden');

        // Animate numbers
        animateValue('total-words', 0, results.totalWords, 1000);
        animateValue('total-chapters', 0, results.chapters.length, 1000);

        // Calculate reading time (avg 250 wpm)
        const minutes = Math.ceil(results.totalWords / 250);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        let timeString = `${minutes}m`;
        if (hours > 0) {
            timeString = `${hours}h ${remainingMinutes}m`;
        }
        document.getElementById('reading-time').textContent = timeString;

        // Populate table
        resultsBody.innerHTML = '';
        results.chapters.forEach(chapter => {
            const tr = document.createElement('tr');
            const percentage = ((chapter.wordCount / results.totalWords) * 100).toFixed(1);

            tr.innerHTML = `
                <td>${chapter.title}</td>
                <td class="text-right">${chapter.wordCount.toLocaleString()}</td>
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
        const { spine, manifest, tocId } = this.parseOpf(opfContent, opfPath);

        // Try to get chapter titles from TOC if available
        let tocMap = {};
        if (tocId && manifest[tocId]) {
            try {
                const tocPath = this.resolvePath(opfPath, manifest[tocId].href);
                const tocContent = await this.zip.file(tocPath).async('text');
                tocMap = this.parseToc(tocContent);
            } catch (e) {
                console.warn('Could not parse TOC', e);
            }
        }

        onProgress(30, 'Counting words...');
        const totalItems = spine.length;

        for (let i = 0; i < totalItems; i++) {
            const itemId = spine[i];
            const item = manifest[itemId];
            if (!item) continue;

            const itemPath = this.resolvePath(opfPath, item.href);
            const file = this.zip.file(itemPath);

            if (file) {
                const content = await file.async('text');
                const wordCount = this.countWordsInHtml(content);

                // Determine title
                let title = tocMap[item.href] || `Chapter ${i + 1}`;

                // Simple heuristic: if word count is very low, it might be front matter or blank page
                // But we include everything for now as per requirement "details chapter-by-chapter"

                if (wordCount > 0) {
                    this.results.chapters.push({
                        title: title,
                        wordCount: wordCount,
                        href: item.href
                    });
                    this.results.totalWords += wordCount;
                }
            }

            const percent = 30 + Math.floor(((i + 1) / totalItems) * 70);
            onProgress(percent, `Analyzing chapter ${i + 1} of ${totalItems}...`);
        }

        onProgress(100, 'Done!');
    }

    getOpfPath(containerXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, 'application/xml');
        return doc.querySelector('rootfile').getAttribute('full-path');
    }

    parseOpf(opfContent, opfPath) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(opfContent, 'application/xml');

        // Namespace handling can be tricky in XML, so we might use localName
        const manifestItems = Array.from(doc.getElementsByTagName('item'));
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
            const spine = doc.getElementsByTagName('spine')[0];
            tocId = spine.getAttribute('toc');
        }

        const spineItems = Array.from(doc.getElementsByTagName('itemref'));
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

    parseToc(tocContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(tocContent, 'application/xml');
        const map = {};

        // Handle NCX (EPUB 2)
        const navPoints = Array.from(doc.getElementsByTagName('navPoint'));
        if (navPoints.length > 0) {
            navPoints.forEach(point => {
                const label = point.querySelector('navLabel > text').textContent;
                let src = point.querySelector('content').getAttribute('src');
                // Remove anchor if present
                src = src.split('#')[0];
                map[src] = label;
            });
            return map;
        }

        // Handle HTML Nav (EPUB 3) - simplified
        const anchors = Array.from(doc.querySelectorAll('nav[epub\\:type="toc"] a, nav[role="doc-toc"] a'));
        anchors.forEach(a => {
            let href = a.getAttribute('href');
            href = href.split('#')[0];
            map[href] = a.textContent.trim();
        });

        return map;
    }

    countWordsInHtml(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const text = doc.body.textContent || '';
        // Basic word count: split by whitespace
        const words = text.trim().split(/\s+/);
        return words.length === 1 && words[0] === '' ? 0 : words.length;
    }
}
