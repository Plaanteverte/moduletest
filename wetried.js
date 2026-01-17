console.log("WETRIED MODULE LOADED!");

async function searchResults(...args) {
    console.log("WETRIED searchResults() called");
    console.log("WETRIED arguments count:", args.length);
    console.log("WETRIED arg[0]:", args[0]);
    console.log("WETRIED arg[1]:", args[1]);
    console.log("WETRIED arg[2]:", args[2]);
    
    // Essayer de trouver le keyword dans les arguments
    let searchTerm = '';
    
    for (let i = 0; i < args.length; i++) {
        console.log(`WETRIED arg[${i}] type:`, typeof args[i], "value:", args[i]);
        
        if (args[i] && typeof args[i] === 'string' && args[i].trim() !== '') {
            // Si c'est une URL, extraire le terme
            if (args[i].includes('?') || args[i].includes('/')) {
                const urlMatch = args[i].match(/[?&](?:keyword|s|search|query_string)=([^&]+)/);
                if (urlMatch) {
                    searchTerm = decodeURIComponent(urlMatch[1]);
                    console.log("WETRIED: Found term in URL:", searchTerm);
                    break;
                }
            } else {
                // C'est probablement le keyword direct
                searchTerm = args[i];
                console.log("WETRIED: Using direct keyword:", searchTerm);
                break;
            }
        }
    }
    
    if (!searchTerm || searchTerm.trim() === '') {
        console.log("WETRIED: No search term found in any argument");
        return JSON.stringify([]);
    }
    
    try {
        const apiUrl = `https://api.wetriedtls.com/query?adult=true&query_string=${encodeURIComponent(searchTerm)}`;
        console.log("WETRIED: Calling API:", apiUrl);
        
        const response = await soraFetch(apiUrl);
        if (!response) {
            console.log("WETRIED: No response from API");
            return JSON.stringify([]);
        }
        
        const text = await response.text();
        console.log("WETRIED: Response length:", text.length);
        
        const json = JSON.parse(text);
        
        if (!json || !json.data || !Array.isArray(json.data)) {
            console.log("WETRIED: Invalid data structure");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Found", json.data.length, "results");
        
        const results = json.data.map(item => ({
            title: item.title || 'No title',
            image: item.thumbnail || item.cover || '',
            href: `https://wetriedtls.com/series/${item.series_slug}`
        }));
        
        if (results.length > 0) {
            console.log("WETRIED: First result:", results[0].title);
        }
        
        console.log(JSON.stringify(results));
        return JSON.stringify(results);
    } catch (e) {
        console.log("WETRIED ERROR:", e.toString());
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    console.log("WETRIED extractDetails:", url);
    
    try {
        const res = await fetch(url);
        const html = await res.text();
        
        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        let description = '';
        
        if (dataMatch) {
            const data = JSON.parse(dataMatch[1]);
            const seriesData = data?.props?.pageProps?.series;
            if (seriesData) {
                description = seriesData.description || '';
            }
        }
        
        if (!description) {
            const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
            description = descMatch ? descMatch[1] : '';
        }
        
        console.log("WETRIED: Description length:", description.length);
        
        return JSON.stringify([{
            description: description,
            aliases: '',
            airdate: ''
        }]);
    } catch (e) {
        console.log("WETRIED extractDetails ERROR:", e.toString());
        return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
    }
}

async function extractChapters(url) {
    console.log("WETRIED extractChapters:", url);
    
    try {
        const slug = url.split('/series/')[1];
        if (!slug) {
            console.log("WETRIED: No slug");
            return JSON.stringify([]);
        }
        
        const res = await fetch(url);
        const html = await res.text();
        
        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (!dataMatch) {
            console.log("WETRIED: No __NEXT_DATA__");
            return JSON.stringify([]);
        }
        
        const data = JSON.parse(dataMatch[1]);
        const chaptersData = data?.props?.pageProps?.series?.chapters;
        
        if (!Array.isArray(chaptersData)) {
            console.log("WETRIED: No chapters array");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Found", chaptersData.length, "chapters");
        
        const chapters = chaptersData
            .sort((a, b) => (a.index || 0) - (b.index || 0))
            .map((ch, i) => ({
                href: `https://wetriedtls.com/series/${slug}/${ch.slug}`,
                number: ch.index || (i + 1),
                title: ch.title || `Chapter ${ch.index || (i + 1)}`
            }));
        
        return JSON.stringify(chapters);
    } catch (e) {
        console.log("WETRIED extractChapters ERROR:", e.toString());
        return JSON.stringify([]);
    }
}

async function extractText(url) {
    console.log("WETRIED extractText:", url);
    
    try {
        const res = await fetch(url);
        const html = await res.text();
        
        const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        
        if (dataMatch) {
            const data = JSON.parse(dataMatch[1]);
            const chapterData = data?.props?.pageProps?.chapter;
            
            if (chapterData?.content) {
                console.log("WETRIED: Content found");
                return cleanText(chapterData.content);
            }
        }
        
        console.log("WETRIED: No content");
        return '';
    } catch (e) {
        console.log("WETRIED extractText ERROR:", e.toString());
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
    } catch (e) {
        console.log("WETRIED: fetchv2 failed, using fetch");
        try {
            return await fetch(url, options);
        } catch (error) {
            console.log("WETRIED: fetch also failed:", error);
            return null;
        }
    }
}
