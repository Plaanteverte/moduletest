async function searchResults(keyword) {
    try {
        const url = `https://wetriedtls.com/query?adult=true&query_string=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url);
        const json = await response.json();

        if (!Array.isArray(json?.data)) {
            console.log("Wetried: No data array in response");
            return JSON.stringify([]);
        }

        const results = json.data.map(item => ({
            title: item.title || '',
            image: item.cover || '',
            href: `https://wetriedtls.com/series/${item.series_slug}`
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

        // Extraire les données depuis __NEXT_DATA__
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
                    // Vous pouvez ajouter d'autres champs si disponibles
                    aliases = seriesData.alt_titles?.join(', ') || '';
                    airdate = seriesData.release_year || '';
                }
            } catch (parseError) {
                console.log("Wetried: Error parsing NEXT_DATA:", parseError);
            }
        }

        // Fallback sur meta description si nécessaire
        if (!description) {
            const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
            description = descMatch ? descMatch[1] : '';
        }

        return JSON.stringify([{
            description,
            aliases,
            airdate
        }]);
    } catch (e) {
        console.log("Wetried extractDetails error:", e);
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
        if (!slug) {
            console.log("Wetried: Invalid URL format");
            return JSON.stringify([]);
        }

        const res = await soraFetch(url);
        const html = await res.text();

        // Extraire __NEXT_DATA__
        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (!dataMatch) {
            console.log("Wetried: __NEXT_DATA__ not found");
            return JSON.stringify([]);
        }

        const data = JSON.parse(dataMatch[1]);
        const chaptersData = data?.props?.pageProps?.series?.chapters;

        if (!Array.isArray(chaptersData)) {
            console.log("Wetried: No chapters array found");
            return JSON.stringify([]);
        }

        const chapters = chaptersData
            .sort((a, b) => (a.index || 0) - (b.index || 0))
            .map((ch, i) => ({
                href: `https://wetriedtls.com/series/${slug}/${ch.slug}`,
                number: ch.index || (i + 1),
                title: ch.title || `Chapter ${ch.index || (i + 1)}`
            }));

        return JSON.stringify(chapters);
    } catch (e) {
        console.log("Wetried extractChapters error:", e);
        return JSON.stringify([]);
    }
}

async function extractText(url) {
    try {
        const res = await soraFetch(url);
        const html = await res.text();

        // Extraire __NEXT_DATA__ pour obtenir le contenu
        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (dataMatch) {
            try {
                const data = JSON.parse(dataMatch[1]);
                const chapterData = data?.props?.pageProps?.chapter;
                
                if (chapterData?.content) {
                    // Le contenu est stocké directement dans le JSON
                    return cleanText(chapterData.content);
                }
            } catch (parseError) {
                console.log("Wetried: Error parsing chapter data:", parseError);
            }
        }

        // Fallback: chercher dans le HTML
        // Le contenu peut être dans différents conteneurs
        const contentPatterns = [
            /<div[^>]*class="[^"]*chapter-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*id="chapter-content"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i
        ];

        for (const pattern of contentPatterns) {
            const match = html.match(pattern);
            if (match) {
                return cleanText(match[1]);
            }
        }

        console.log("Wetried: No content found");
        return '';
    } catch (e) {
        console.log('Wetried extractText error:', e);
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
        return await fetch(url, options);
    }
}
