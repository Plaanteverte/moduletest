console.log("WETRIED MODULE LOADED!");

async function searchResults(keyword) {
    console.log("WETRIED searchResults() called");
    console.log("WETRIED arguments count:", arguments.length);
    console.log("WETRIED arg[0]:", keyword);
    
    // Essayer de trouver le keyword dans les arguments
    let searchTerm = '';
    
    for (let i = 0; i < arguments.length; i++) {
        console.log(`WETRIED arg[${i}] type:`, typeof arguments[i], "value:", arguments[i]);
        
        if (arguments[i] && typeof arguments[i] === 'string' && arguments[i].trim() !== '') {
            if (arguments[i].includes('?') || arguments[i].includes('/')) {
                const urlMatch = arguments[i].match(/[?&](?:keyword|s|search|query_string)=([^&]+)/);
                if (urlMatch) {
                    searchTerm = decodeURIComponent(urlMatch[1]);
                    console.log("WETRIED: Found term in URL:", searchTerm);
                    break;
                }
            } else {
                searchTerm = arguments[i];
                console.log("WETRIED: Using direct keyword:", searchTerm);
                break;
            }
        }
    }
    
    if (!searchTerm || searchTerm.trim() === '') {
        console.log("WETRIED: No search term found");
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
        
        const json = await response.json();
        
        if (!json || !json.data || !Array.isArray(json.data)) {
            console.log("WETRIED: Invalid data structure");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Found", json.data.length, "results");
        
        // IMPORTANT: Encoder l'ID dans l'URL pour l'utiliser plus tard
        const results = json.data.map(item => ({
            title: item.title || 'No title',
            image: item.thumbnail || '',
            // Format: /series/slug?id=123
            href: `https://wetriedtls.com/series/${item.series_slug}?id=${item.id}`
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
    console.log("WETRIED extractDetails called");
    console.log("WETRIED extractDetails URL:", url);
    
    try {
        if (!url || typeof url !== 'string') {
            console.log("WETRIED: Invalid URL for details");
            return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
        }
        
        // Extraire le slug de la série
        const slug = url.split('/series/')[1];
        if (!slug) {
            console.log("WETRIED: No slug in URL");
            return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
        }
        
        console.log("WETRIED: Series slug:", slug);
        
        // Appeler l'API pour obtenir les détails
        const apiUrl = `https://api.wetriedtls.com/series/${slug}`;
        console.log("WETRIED: Calling API:", apiUrl);
        
        const res = await soraFetch(apiUrl);
        if (!res) {
            console.log("WETRIED: No response");
            return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
        }
        
        const json = await res.json();
        console.log("WETRIED: API response received");
        
        const description = json.description || '';
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
    console.log("WETRIED extractChapters called");
    console.log("WETRIED extractChapters URL:", url);
    
    try {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            console.log("WETRIED: Invalid URL");
            return JSON.stringify([]);
        }
        
        // Extraire le slug de la série
        const slug = url.split('/series/')[1];
        if (!slug) {
            console.log("WETRIED: No slug found");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Series slug:", slug);
        
        // D'abord, obtenir le series_id en appelant l'API series
        const seriesApiUrl = `https://api.wetriedtls.com/series/${slug}`;
        console.log("WETRIED: Getting series ID from:", seriesApiUrl);
        
        const seriesRes = await soraFetch(seriesApiUrl);
        if (!seriesRes) {
            console.log("WETRIED: No series response");
            return JSON.stringify([]);
        }
        
        const seriesData = await seriesRes.json();
        const seriesId = seriesData.id;
        
        if (!seriesId) {
            console.log("WETRIED: No series ID found");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Series ID:", seriesId);
        
        // Maintenant, charger tous les chapitres
        const allChapters = [];
        let currentPage = 1;
        let totalPages = 1;
        
        // Charger la première page pour connaître le nombre total de pages
        do {
            const chaptersApiUrl = `https://api.wetriedtls.com/chapters/${seriesId}?page=${currentPage}&perPage=30&query=&order=asc`;
            console.log("WETRIED: Loading page", currentPage, "from:", chaptersApiUrl);
            
            const chaptersRes = await soraFetch(chaptersApiUrl);
            if (!chaptersRes) {
                console.log("WETRIED: No chapters response for page", currentPage);
                break;
            }
            
            const chaptersJson = await chaptersRes.json();
            
            if (currentPage === 1) {
                totalPages = chaptersJson.meta?.last_page || 1;
                console.log("WETRIED: Total pages:", totalPages);
            }
            
            if (Array.isArray(chaptersJson.data)) {
                allChapters.push(...chaptersJson.data);
                console.log("WETRIED: Loaded", chaptersJson.data.length, "chapters from page", currentPage);
            }
            
            currentPage++;
        } while (currentPage <= totalPages);
        
        console.log("WETRIED: Total chapters loaded:", allChapters.length);
        
        // Transformer en format Sora
        const chapters = allChapters.map((ch, i) => ({
            href: `https://wetriedtls.com/series/${slug}/${ch.chapter_slug}`,
            number: parseFloat(ch.index) || (i + 1),
            title: ch.chapter_name || `Chapter ${ch.index || (i + 1)}`
        }));
        
        if (chapters.length > 0) {
            console.log("WETRIED: First chapter:", chapters[0].title);
            console.log("WETRIED: Last chapter:", chapters[chapters.length - 1].title);
        }
        
        return JSON.stringify(chapters);
    } catch (e) {
        console.log("WETRIED extractChapters ERROR:", e.toString());
        console.log("WETRIED error stack:", e.stack);
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
