export default class EbirdApi {
    static apiKey = "jfekjedvescr"

    static fetchEbirdCode(name) {
        return name
            ? fetch('https://api.ebird.org/v2/ref/taxon/find?cat=species&key=' + EbirdApi.apiKey + '&locale=en&q=' + encodeURIComponent(name.trim()))
                .then(r => r.json())
                .then(a => a && a[0] && a[0].code)
                .catch(() => undefined)
            : Promise.resolve(undefined);
    }

    static fetchEbirdSciName(code) {
        return code
            ? fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?cat=species&fmt=json&species=' + encodeURIComponent(code.trim()) + '&locale=en')
                .then(r => r.json())
                .then(a => a && a[0] && a[0].sciName && a[0].sciName)
                .catch(() => undefined)
            : Promise.resolve(undefined);
    }
}
