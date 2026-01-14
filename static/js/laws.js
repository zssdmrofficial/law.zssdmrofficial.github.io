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

        lawsData = parseMarkdownStructure(text);

        renderTOC();
        renderSidebarContent();

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
            currentH1.introContent = content;
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
            currentH2 = null;
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
    flushBuffer();

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
    const cleanKeyword = keyword.toLowerCase().trim();

    lawsData.forEach(h1 => {
        const h1Match = h1.searchText.toLowerCase().includes(cleanKeyword);
        let anyChildMatch = false;

        const h1El = document.getElementById(h1.id);
        if (h1El) {
            const titleEl = h1El.querySelector('.law-title');
            const introEl = h1El.querySelector('.law-intro');

            if (titleEl) titleEl.innerHTML = cleanKeyword ? highlightHTML(h1.title, cleanKeyword) : h1.title;
            if (introEl) introEl.innerHTML = cleanKeyword ? highlightHTML(h1.introHtml, cleanKeyword) : h1.introHtml;
        }

        h1.subsections.forEach(h2 => {
            const h2Match = h2.searchText.toLowerCase().includes(cleanKeyword);
            const el = document.getElementById(h2.id);
            const tocEl = document.querySelector(`a[href="#${h2.id}"]`);

            const isMatch = h1Match || h2Match;
            if (el) {
                el.style.display = (!cleanKeyword || isMatch) ? 'block' : 'none';

                const subtitleEl = el.querySelector('.law-subtitle');
                const bodyEl = el.querySelector('.law-body');

                if (subtitleEl) subtitleEl.innerHTML = cleanKeyword ? highlightHTML(h2.title, cleanKeyword) : h2.title;
                if (bodyEl) bodyEl.innerHTML = cleanKeyword ? highlightHTML(h2.html, cleanKeyword) : h2.html;
            }
            if (tocEl) tocEl.parentElement.style.display = (!cleanKeyword || isMatch) ? 'block' : 'none';

            if (isMatch) anyChildMatch = true;
        });

        const el = document.getElementById(h1.id);
        const tocEl = document.querySelector(`a[href="#${h1.id}"]`);
        const showH1 = !cleanKeyword || h1Match || anyChildMatch;
        if (el) el.style.display = showH1 ? 'block' : 'none';

        const hr = document.getElementById(h1.id + '-hr');
        if (hr) {
            hr.style.display = showH1 ? 'block' : 'none';
        }

        if (tocEl) tocEl.parentElement.style.display = showH1 ? 'block' : 'none';
    });
}

function highlightHTML(html, keyword) {
    if (!keyword || !html) return html;

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    const container = document.createElement('div');
    container.innerHTML = html;

    const walk = (node) => {
        if (node.nodeType === 3) {
            const text = node.textContent;
            const parts = text.split(regex);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach((part, i) => {
                    if (i % 2 === 1) {
                        const mark = document.createElement('mark');
                        mark.textContent = part;
                        fragment.appendChild(mark);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === 1 && !['MARK', 'SCRIPT', 'STYLE'].includes(node.tagName)) {
            Array.from(node.childNodes).forEach(walk);
        }
    };

    walk(container);
    return container.innerHTML;
}

function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

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