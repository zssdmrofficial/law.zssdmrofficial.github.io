async function loadMarkdownContent(path, containerId) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Fetch failed: " + res.status);
        let text = await res.text();

        // Process footnotes before rendering
        text = processFootnotes(text);

        const container = document.getElementById(containerId);
        container.innerHTML = marked.parse(text);

        // Handle hash scrolling if present
        if (window.location.hash) {
            setTimeout(() => {
                const id = window.location.hash.substring(1);
                const el = document.getElementById(id);
                if (el) el.scrollIntoView();
            }, 100);
        }

    } catch (err) {
        console.error("載入 Markdown 時發生錯誤：", err);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML =
                "<p style='color:red;'>法律條文載入失敗</p>";
        }
    }
}

function processFootnotes(text) {
    // 1. Handle references: （註１） or (註1) -> <a href="#note-1">...</a>
    // Matches fullwidth/halfwidth parentheses and digits
    // Uses regex that allows mixing but expects specific structure "註" + digits
    text = text.replace(/([（(])註([0-9０-９]+)([)）])/g, (match, open, digits, close) => {
        const arabic = normalizeNumber(digits);
        return `<a href="#note-${arabic}" class="footnote-ref">${match}</a>`;
    });

    // 2. Handle footnote definitions in the specific section
    // Assuming the footnotes are under "# 伍、註釋"
    const splitKey = "# 伍、註釋";
    const parts = text.split(splitKey);

    if (parts.length > 1) {
        let footnotes = parts[1];
        
        // Replace "## 一、" with "## 一、 <a id='note-1'></a>"
        // Matches "## " followed by Chinese number, then "、"
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
    // Convert fullwidth ０-９ to 0-9
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

window.addEventListener("DOMContentLoaded", () => {
    loadMarkdownContent("/static/md/laws.md", "laws-text-container");
});