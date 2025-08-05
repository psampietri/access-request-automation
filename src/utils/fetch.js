export const safeFetch = async (url, log, errMsg) => {
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server responded with ${response.status}`);
        return data;
    } catch (error) {
        log('error', `${errMsg}: ${error.message}`);
        return null;
    }
};