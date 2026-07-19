(function() {
    const TOUR_FLAG_KEY = "redsa_tour_visto";

    function startTour() {
        if (!window.driver || !window.driver.js || !window.driver.js.driver) {
            console.warn("driver.js no está cargado");
            return;
        }

        const driverObj = window.driver.js.driver({
            showProgress: true,
            allowClose: true,
            overlayOpacity: 0.65,
            doneBtnText: 'Terminar',
            closeBtnText: 'Omitir',
            nextBtnText: 'Siguiente &rarr;',
            prevBtnText: '&larr; Anterior',
            progressText: '{{current}} de {{total}}',
            // En driver.js 1.x, para mostrar botón de cerrar siempre:
            showButtons: ['next', 'previous', 'close'],
            onDestroyStarted: () => {
                if (!driverObj.hasNextStep() || confirm("¿Seguro que deseas omitir el resto del tour?")) {
                    localStorage.setItem(TOUR_FLAG_KEY, "true");
                    driverObj.destroy();
                }
            },
            steps: [
                {
                    popover: {
                        title: 'Bienvenido al Observatorio',
                        description: 'Esta plataforma te permite explorar datos de siniestralidad vial en Ecuador de forma interactiva y transparente. Hagamos un recorrido rápido.',
                    }
                },
                {
                    element: '#citizen-panel',
                    popover: {
                        title: 'Busca tu territorio',
                        description: 'Escribe el nombre de tu cantón para centrar el mapa y ver un resumen de su situación frente a la media nacional.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#open-analysis-button',
                    popover: {
                        title: 'Cambiar variable',
                        description: 'Haz clic aquí o en el panel lateral para cambiar los datos que estás visualizando (fallecidos, siniestros, vehículos, etc).',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '.leaflet-bottom.leaflet-right', // Legend area
                    popover: {
                        title: 'Leyenda adaptativa',
                        description: 'La leyenda se ajusta a los datos reales. Haz clic en el ícono (i) para ver la precisión estadística (GVF) del mapa actual.',
                        side: "left",
                        align: 'end'
                    }
                },
                {
                    element: '#open-institutional-button',
                    popover: {
                        title: 'Ranking y descarga',
                        description: 'Aquí puedes ver el ranking nacional, descargar el reporte de transparencia y consultar las metodologías.',
                        side: "top",
                        align: 'start'
                    }
                }
            ]
        });

        // El usuario pidió: "cierre inmediato sin confirmación"
        // Sobrescribimos el comportamiento por defecto
        driverObj.setConfig({
            ...driverObj.getConfig(),
            onDestroyStarted: () => {
                localStorage.setItem(TOUR_FLAG_KEY, "true");
                driverObj.destroy();
            }
        });

        driverObj.drive();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const btnTour = document.getElementById("btn-tour");
        if (btnTour) {
            btnTour.addEventListener("click", () => {
                startTour();
            });
        }

        // Auto start if flag is missing
        if (!localStorage.getItem(TOUR_FLAG_KEY)) {
            // setTimeout to wait for map and UI to settle
            setTimeout(() => {
                startTour();
            }, 1000);
        }
    });
})();
