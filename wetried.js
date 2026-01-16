console.log("WETRIED MODULE LOADED!");

async function searchResults(url) {
    console.log("WETRIED searchResults called with URL:", url);
    
    try {
        // Extraire le terme de recherche depuis l'URL (supporte ?s= et ?search=)
        let searchMatch = url.match(/[?&]s=([^&]+)/);
        if (!searchMatch) {
            searchMatch = url.match(/[?&]search=([^&]+)/);
        }
        
        if (!searchMatch) {
            console.log("WETRIED: No search term in URL");
            return JSON.stringify([]);
        }
        
        const keyword = decodeURIComponent(searchMatch[1]);
        console.log("WETRIED: Search keyword:", keyword);
        
        // Appeler l'API directement
        const apiUrl = `https://wetriedtls.com/query?adult=true&query_string=${encodeURIComponent(keyword)}`;
        console.log("WETRIED: Calling API:", apiUrl);
        
        const response = await fetch(apiUrl);
        const text = await response.text();
        console.log("WETRIED: Response received, length:", text.length);
        
        const json = JSON.parse(text);
        
        if (!json || !json.data || !Array.isArray(json.data)) {
            console.log("WETRIED: No data array in response");
            return JSON.stringify([]);
        }
        
        console.log("WETRIED: Found", json.data.length, "results");
        
        const results = json.data.map(item => ({
            title: item.title || 'No title',
            image: item.cover || '',
            href: `https://wetriedtls.com/series/${item.series_slug}`
        }));
        
        console.log("WETRIED: First result:", results[0]?.title);
        return JSON.stringify(results);
    } catch (e) {
        console.log("WETRIED searchResults ERROR:", e.toString());
        console.log("WETRIED error stack:", e.stack);
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
