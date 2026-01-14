let lawsData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadLaws();

    const searchInput = document.getElementById('law-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }
});

async function loadLaws() {
    try {
        const res = await fetch("/static/md/laws.md");
        if (!res.ok) throw new Error("Fetch failed");
        let text = await res.text();
        text = processFootnotes(text);

        // Parse Markdown into structured data
        lawsData = parseMarkdownStructure(text);

        renderTOC();
        renderSidebarContent();

        // Handle URL hash for deep linking
        if (window.location.hash) {
            setTimeout(() => {
                const id = window.location.hash.substring(1);
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        }

    } catch (err) {
        console.error("Error loading laws:", err);
        document.getElementById("laws-text-container").innerHTML = "<p>載入失敗，請稍後再試。</p>";
    }
}

function parseMarkdownStructure(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentH1 = null;
    let currentH2 = null;
    let buffer = [];

    // Helper to save buffer to current node
    const flushBuffer = () => {
        if (buffer.length === 0) return;
        const content = buffer.join('\n');
        const html = marked.parse(content);
        const plainText = stripHtml(html);

        if (currentH2) {
            currentH2.content = content;
            currentH2.html = html;
            currentH2.searchText += " " + plainText;
        } else if (currentH1) {
            currentH1.introContent = content; // content before first H2
            currentH1.introHtml = html;
            currentH1.searchText += " " + plainText;
        }
        buffer = [];
    };

    lines.forEach(line => {
        const h1Match = line.match(/^#\s+(.+?)\s*$/);
        const h2Match = line.match(/^##\s+(.+?)\s*$/);

        if (h1Match) {
            flushBuffer();
            currentH2 = null; // Reset H2
            currentH1 = {
                id: `sec-${sections.length + 1}`,
                title: h1Match[1].trim(),
                titleText: stripHtml(h1Match[1].trim()),
                introContent: '',
                introHtml: '',
                subsections: [],
                searchText: stripHtml(h1Match[1].trim())
            };
            sections.push(currentH1);
        } else if (h2Match) {
            flushBuffer();
            if (!currentH1) {
                // H2 without H1? Create a dummy H1 or just ignore (shouldn't happen in valid doc)
                currentH1 = { id: 'sec-0', title: '導言', titleText: '導言', subsections: [], searchText: '' };
                sections.push(currentH1);
            }
            currentH2 = {
                id: `${currentH1.id}-sub-${currentH1.subsections.length + 1}`,
                title: h2Match[1].trim(),
                titleText: stripHtml(h2Match[1].trim()),
                content: '',
                html: '',
                searchText: stripHtml(h2Match[1].trim())
            };
            currentH1.subsections.push(currentH2);
        } else {
            buffer.push(line);
        }
    });
    flushBuffer(); // Flush remaining

    return sections;
}

function renderTOC() {
    const tocContainer = document.getElementById('laws-toc');
    if (!tocContainer) return;

    let html = '<ul>';
    lawsData.forEach(h1 => {
        html += `<li><a href="#${h1.id}" class="toc-h1">${h1.titleText}</a></li>`;
        if (h1.subsections.length > 0) {
            h1.subsections.forEach(h2 => {
                html += `<li><a href="#${h2.id}" class="toc-h2">${h2.titleText}</a></li>`;
            });
        }
    });
    html += '</ul>';
    tocContainer.innerHTML = html;
}

function renderSidebarContent() {
    const container = document.getElementById('laws-text-container');
    if (!container) return;

    // Clear current
    container.innerHTML = '';

    lawsData.forEach(h1 => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'law-section';
        sectionDiv.id = h1.id;

        let html = `<h1 class="law-title">${h1.title}</h1>`;
        if (h1.introHtml) {
            html += `<div class="law-intro">${h1.introHtml}</div>`;
        }

        sectionDiv.innerHTML = html;
        container.appendChild(sectionDiv);

        h1.subsections.forEach(h2 => {
            const subDiv = document.createElement('div');
            subDiv.className = 'law-subsection';
            subDiv.id = h2.id;
            subDiv.innerHTML = `<h2 class="law-subtitle">${h2.title}</h2><div class="law-body">${h2.html}</div>`;
            container.appendChild(subDiv);
        });

    });
}

function handleSearch(keyword) {
    keyword = keyword.toLowerCase().trim();

    // Filter TOC and Content
    const tocLinks = document.querySelectorAll('#laws-toc a');
    const contentSections = document.querySelectorAll('.law-section, .law-subsection');

    // 1. Filter Visual Content
    // A simple approach: Iterate over data, check visibility, then toggle DOM
    // But working with DOM is easier for "hide parent if all children hidden" logic ??
    // Let's go data-driven for search

    let hasResults = false;

    lawsData.forEach(h1 => {
        // Check H1 match
        const h1Match = h1.searchText.toLowerCase().includes(keyword);
        let anyChildMatch = false;

        h1.subsections.forEach(h2 => {
            const h2Match = h2.searchText.toLowerCase().includes(keyword);
            const el = document.getElementById(h2.id);
            const tocEl = document.querySelector(`a[href="#${h2.id}"]`); // rough selector

            if (el) el.style.display = (h1Match || h2Match) ? 'block' : 'none';
            if (tocEl) tocEl.parentElement.style.display = (h1Match || h2Match) ? 'block' : 'none';

            if (h1Match || h2Match) anyChildMatch = true;
        });

        // H1 visibility
        const el = document.getElementById(h1.id);
        const tocEl = document.querySelector(`a[href="#${h1.id}"]`);

        const showH1 = h1Match || anyChildMatch;
        if (el) el.style.display = showH1 ? 'block' : 'none';

        // Handle HR visibility properly using ID
        const hr = document.getElementById(h1.id + '-hr');
        if (hr) {
            hr.style.display = showH1 ? 'block' : 'none';
        }

        if (tocEl) tocEl.parentElement.style.display = showH1 ? 'block' : 'none';
    });
}

function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// Reuse existing footnote logic
function processFootnotes(text) {
    text = text.replace(/([（(])註([0-9０-９]+)([)）])/g, (match, open, digits, close) => {
        const arabic = normalizeNumber(digits);
        return `<a href="#note-${arabic}" class="footnote-ref">${match}</a>`;
    });

    const splitKey = "# 伍、註釋";
    const parts = text.split(splitKey);

    if (parts.length > 1) {
        let footnotes = parts[1];

        footnotes = footnotes.replace(/^## ([一二三四五六七八九十]+)、/gm, (match, chineseNum) => {
            const arabic = chineseToNumber(chineseNum);
            if (arabic) {
                return `## ${chineseNum}、 <a id="note-${arabic}" class="footnote-anchor"></a>`;
            }
            return match;
        });

        parts[1] = footnotes;
        text = parts.join(splitKey);
    }
    return text;
}

function normalizeNumber(str) {
    return str.replace(/[\uFF10-\uFF19]/g, (m) => {
        return String.fromCharCode(m.charCodeAt(0) - 0xFEE0);
    });
}

function chineseToNumber(str) {
    const map = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    return map[str];
}