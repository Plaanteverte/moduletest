async function searchResults(keyword) {
    try {
        const url = `https://wetriedtls.com/query?adult=true&query_string=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url);
        const json = await response.json();

        if (!json?.data?.items) {
            return JSON.stringify([]);
        }

        const results = json.data.items.map(item => ({
            title: item.title,
            image: item.cover || "",
            href: `https://wetriedtls.com/novel/${item.slug}`
        }));

        return JSON.stringify(results);
    } catch (e) {
        console.log("Wetried search error:", e);
        return JSON.stringify([]);
    }
}


async function extractDetails(url) {
    try {
        const res = await soraFetch(url);
        const html = await res.text();

        // description est déjà dans l’API, mais fallback HTML
        const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        return JSON.stringify([{
            description,
            aliases: '',
            airdate: ''
        }]);
    } catch (e) {
        return JSON.stringify([{
            description: '',
            aliases: '',
            airdate: ''
        }]);
    }
}
async function extractChapters(url) {
    try {
        const slug = url.split('/series/')[1];
        const res = await soraFetch(
            `https://wetriedtls.com/query?adult=true&query_string=${slug}`
        );
        const json = await res.json();

        const series = json.data.find(s => s.series_slug === slug);
        if (!series) return JSON.stringify([]);

        const chapters = [];

        const pushChapter = (ch, i) => {
            chapters.push({
                href: `https://wetriedtls.com/series/${slug}/${ch.chapter_slug}`,
                number: Number(ch.index ?? i + 1),
                title: ch.chapter_name
            });
        };

        series.free_chapters?.forEach(pushChapter);
        series.paid_chapters?.forEach(pushChapter);

        // ordre croissant
        chapters.sort((a, b) => a.number - b.number);

        return JSON.stringify(chapters);
    } catch (e) {
        console.log('extractChapters error:', e);
        return JSON.stringify([]);
    }
}
async function extractText(url) {
    try {
        // tentative API directe
        const apiUrl = url.replace('/series/', '/api/chapters/');
        let res = await soraFetch(apiUrl);

        let data;
        if (res && res.headers?.get('content-type')?.includes('json')) {
            data = await res.json();
            if (data?.content) {
                return cleanText(data.content);
            }
        }

        // fallback HTML
        res = await soraFetch(url);
        const html = await res.text();

        const match = html.match(/<div class="chapter-content">([\s\S]*?)<\/div>/i);
        if (!match) return '';

        return cleanText(match[1]);

    } catch (e) {
        console.log('extractText error:', e);
        return '';
    }
}

function cleanText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{2,}/g, '\n\n')
        .trim();
}
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        return await fetch(url, options);
    }
}
