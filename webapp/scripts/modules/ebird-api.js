export default class EbirdApi {
    static apiKey = "jfekjedvescr"

    static fetchEbirdCode(name) {
        if (!name) return Promise.resolve(undefined);
        const normalized = name.replaceAll(/[\u2018\u2019]/g, "'").trim();
        if (!normalized) return Promise.resolve(undefined);
        const targetLower = normalized.toLowerCase();

        return fetch('https://api.ebird.org/v2/ref/taxon/find?cat=species&key=' + EbirdApi.apiKey + '&locale=en&q=' + encodeURIComponent(normalized))
            .then(r => r.json())
            .then(a => {
                if (!Array.isArray(a) || !a.length) return undefined;
                const match = a.find(item => {
                    if (!item) return false;
                    if (!item.name) return a.length === 1 && Boolean(item.code);
                    const comName = item.name.split(' - ')[0].trim().toLowerCase().replaceAll(/[\u2018\u2019]/g, "'");
                    const comNameWithoutParens = comName.replace(/\s*\([^)]*\)/g, '').trim();
                    return comName === targetLower || comNameWithoutParens === targetLower;
                });
                return match ? match.code : undefined;
            })
            .catch(() => undefined);
    }

    static fetchEbirdSciName(code) {
        return code
            ? fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?cat=species&fmt=json&species=' + encodeURIComponent(code.trim()) + '&locale=en')
                .then(r => r.json())
                .then(a => a && a[0])
                .catch(() => undefined)
            : Promise.resolve(undefined);
    }
}
