(function() {
    const TOUR_FLAG_KEY = "redsa_tour_v2_visto";

    function startTour() {
        if (!window.driver || !window.driver.js || !window.driver.js.driver) {
            console.warn("driver.js no está cargado");
            return;
        }

        const isMobile = window.matchMedia("(max-width: 820px)").matches;
        const variableTourTarget = isMobile ? "#mobile-layers-toggle" : "#variable-controls-slot";
        const infrastructureTourTarget = isMobile ? "#technical-panel-toggle" : "#infrastructure-disclosure";
        const legend = document.querySelector(".legend-panel");
        const legendRect = legend?.getBoundingClientRect();
        const legendTourTarget = document.createElement("div");
        legendTourTarget.id = "legend-tour-target";
        legendTourTarget.setAttribute("aria-hidden", "true");
        if (legendRect) {
            Object.assign(legendTourTarget.style, {
                position: "fixed",
                left: `${legendRect.left}px`,
                top: `${legendRect.top}px`,
                width: `${legendRect.width}px`,
                height: `${legendRect.height}px`,
                pointerEvents: "none"
            });
        }
        document.body.appendChild(legendTourTarget);
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
            onDestroyed: () => legendTourTarget.remove(),
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
                        description: 'Explora y compara datos oficiales de seguridad vial de Ecuador. El recorrido muestra cómo seleccionar un territorio, analizarlo y descargar datos con sus fuentes.',
                    }
                },
                {
                    element: '#territory-search-form',
                    popover: {
                        title: 'Busca tu territorio',
                        description: 'Escribe un cantón para centrarlo y seleccionarlo. También puedes tocar directamente una provincia, cantón o parroquia en el mapa.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#open-analysis-button',
                    popover: {
                        title: 'Análisis del territorio',
                        description: 'Abre el panel con indicadores, acumulados históricos, tendencia, fuentes y perfil de personas fallecidas para la unidad seleccionada.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: variableTourTarget,
                    popover: {
                        title: 'Variables, años y nivel territorial',
                        description: 'En “Datos y capas” puedes elegir qué fenómeno representar, mover la línea de tiempo y cambiar entre provincias, cantones y parroquias. “Sin dato” nunca se interpreta como cero.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: infrastructureTourTarget,
                    popover: {
                        title: 'Capas de infraestructura y mapas base',
                        description: 'En el mismo panel puedes desplegar “Infraestructura vial” y activar varias capas a la vez. El control de capas del mapa permite escoger el mapa base.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#legend-tour-target',
                    popover: {
                        title: 'Leyenda adaptativa',
                        description: 'La leyenda cambia según la variable, el año y el nivel territorial. También declara cuando no existen datos y su ícono informativo explica la clasificación.',
                        side: "left",
                        align: 'end'
                    }
                },
                {
                    element: '#btn-catalog',
                    popover: {
                        title: 'Catálogo y descarga de datos',
                        description: 'Consulta todas las variables, sus años, niveles, fuentes y metodología. Desde cada ficha puedes descargar datos tabulares y geográficos disponibles.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#citizen-panel',
                    popover: {
                        title: 'Ficha PDF del territorio',
                        description: 'Después de seleccionar una unidad se habilita “Descargar ficha PDF”, con mapa, año consultado, acumulado histórico, comparación territorial, gráficos, fuentes y contacto institucional.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#open-institutional-button',
                    popover: {
                        title: 'Ranking, confianza y citación',
                        description: 'Compara los 224 cantones, conoce por qué confiar en el tratamiento de los datos y obtén la cita sugerida del Observatorio.',
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

        window.__redsaTourAudit = {
            stepCount: driverObj.getConfig().steps.length,
            titles: driverObj.getConfig().steps.map(step => step.popover?.title).filter(Boolean),
            coversCatalogDownloads: true,
            coversAnalysis: true,
            coversVariablesAndLayers: true
        };
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
