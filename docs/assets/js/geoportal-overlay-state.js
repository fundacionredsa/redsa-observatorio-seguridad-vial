(function () {
    const providers = new Map();
    const listeners = new Set();
    const opacityHandlers = new Map();

    function register(id, provider) {
        if (!id || typeof provider !== "function") return () => {};
        providers.set(id, provider);
        notify();
        return () => {
            providers.delete(id);
            notify();
        };
    }

    function getLegendEntries() {
        return Array.from(providers.entries())
            .map(([id, provider]) => {
                try {
                    const entry = provider();
                    return entry ? { id, ...entry } : null;
                } catch (error) {
                    console.warn(`No se pudo construir la leyenda de ${id}:`, error);
                    return null;
                }
            })
            .filter(Boolean);
    }

    function subscribe(listener) {
        if (typeof listener !== "function") return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function notify() {
        listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.warn("No se pudo actualizar un consumidor de overlays:", error);
            }
        });
    }

    function registerOpacityHandler(id, handler) {
        if (!id || typeof handler !== "function") return () => {};
        opacityHandlers.set(id, handler);
        return () => opacityHandlers.delete(id);
    }

    function setOpacity(id, percent) {
        opacityHandlers.get(id)?.(percent);
    }

    window.REDSAOverlayState = Object.freeze({ register, getLegendEntries, subscribe, notify, registerOpacityHandler, setOpacity });
})();
