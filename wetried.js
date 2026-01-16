async function searchResults(keyword) {
    try {
        console.log("Wetried: Starting search for:", keyword);
        
        const url = `https://wetriedtls.com/query?adult=true&query_string=${encodeURIComponent(keyword)}`;
        console.log("Wetried: Fetching URL:", url);
        
        const response = await soraFetch(url);
        console.log("Wetried: Response received, status:", response.status);
        
        const text = await response.text();
        console.log("Wetried: Response text length:", text.length);
        
        const json = JSON.parse(text);
        console.log("Wetried: Parsed JSON, data array length:", json?.data?.length);

        if (!json || !json.data || !Array.isArray(json.data)) {
            console.log("Wetried: Invalid response structure");
            return JSON.stringify([]);
        }

        const results = json.data.map(item => {
            const result = {
                title: item.title || 'No title',
                image: item.cover || '',
                href: `https://wetriedtls.com/series/${item.series_slug}`
            };
            console.log("Wetried: Mapped result:", result.title);
            return result;
        });

        console.log("Wetried: Returning", results.length, "results");
        return JSON.stringify(results);
    } catch (e) {
        console.log("Wetried search error:", e.message || e);
        console.log("Wetried error stack:", e.stack);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        console.log("Wetried: Extracting details from:", url);
        
        const res = await soraFetch(url);
        const html = await res.text();

        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        let description = '';
        let aliases = '';
        let airdate = '';

        if (dataMatch) {
            try {
                const data = JSON.parse(dataMatch[1]);
                const seriesData = data?.props?.pageProps?.series;
                
                if (seriesData) {
                    description = seriesData.description || '';
                    aliases = seriesData.alt_titles?.join(', ') || '';
                    airdate = seriesData.release_year || '';
                    console.log("Wetried: Details extracted from __NEXT_DATA__");
                }
            } catch (parseError) {
                console.log("Wetried: Error parsing NEXT_DATA:", parseError.message);
            }
        }

        if (!description) {
            const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
            description = descMatch ? descMatch[1] : '';
            console.log("Wetried: Used meta description fallback");
        }

        return JSON.stringify([{
            description,
            aliases,
            airdate
        }]);
    } catch (e) {
        console.log("Wetried extractDetails error:", e.message);
        return JSON.stringify([{
            description: '',
            aliases: '',
            airdate: ''
        }]);
    }
}

async function extractChapters(url) {
    try {
        console.log("Wetried: Extracting chapters from:", url);
        
        const slug = url.split('/series/')[1];
        if (!slug) {
            console.log("Wetried: Invalid URL format, no slug found");
            return JSON.stringify([]);
        }

        console.log("Wetried: Extracted slug:", slug);

        const res = await soraFetch(url);
        const html = await res.text();

        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (!dataMatch) {
            console.log("Wetried: __NEXT_DATA__ not found in HTML");
            return JSON.stringify([]);
        }

        const data = JSON.parse(dataMatch[1]);
        const chaptersData = data?.props?.pageProps?.series?.chapters;

        if (!Array.isArray(chaptersData)) {
            console.log("Wetried: No chapters array found in data");
            return JSON.stringify([]);
        }

        console.log("Wetried: Found", chaptersData.length, "chapters");

        const chapters = chaptersData
            .sort((a, b) => (a.index || 0) - (b.index || 0))
            .map((ch, i) => ({
                href: `https://wetriedtls.com/series/${slug}/${ch.slug}`,
                number: ch.index || (i + 1),
                title: ch.title || `Chapter ${ch.index || (i + 1)}`
            }));

        return JSON.stringify(chapters);
    } catch (e) {
        console.log("Wetried extractChapters error:", e.message);
        console.log("Wetried error stack:", e.stack);
        return JSON.stringify([]);
    }
}

async function extractText(url) {
    try {
        console.log("Wetried: Extracting text from:", url);
        
        const res = await soraFetch(url);
        const html = await res.text();

        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (dataMatch) {
            try {
                const data = JSON.parse(dataMatch[1]);
                const chapterData = data?.props?.pageProps?.chapter;
                
                if (chapterData?.content) {
                    console.log("Wetried: Content found in __NEXT_DATA__");
                    return cleanText(chapterData.content);
                }
            } catch (parseError) {
                console.log("Wetried: Error parsing chapter data:", parseError.message);
            }
        }

        console.log("Wetried: Trying HTML content patterns");
        
        const contentPatterns = [
            /<div[^>]*class="[^"]*chapter-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*id="chapter-content"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i,
            /<main[^>]*>([\s\S]*?)<\/main>/i
        ];

        for (const pattern of contentPatterns) {
            const match = html.match(pattern);
            if (match) {
                console.log("Wetried: Content found with pattern");
                return cleanText(match[1]);
            }
        }

        console.log("Wetried: No content found");
        return '';
    } catch (e) {
        console.log('Wetried extractText error:', e.message);
        return '';
    }
}

function cleanText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        console.log("Wetried: fetchv2 failed, trying regular fetch");
        return await fetch(url, options);
    }
}
