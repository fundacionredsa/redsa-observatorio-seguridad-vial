(function() {
    const TOUR_FLAG_KEY = "redsa_tour_v2_visto";

    function startTour() {
        if (!window.driver || !window.driver.js || !window.driver.js.driver) {
            console.warn("driver.js no está cargado");
            return;
        }

        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const variableTourTarget = '[data-right-panel="layers"]';
        const infrastructureTourTarget = "#infrastructure-disclosure";
        const mapControlsTourTarget = isMobile ? "#mobile-level-bar" : "#map-controls-toolbar";
        const citizenWasOpen = document.body.classList.contains("citizen-panel-open");
        const legendWasVisible = document.getElementById("map-legend-card")?.classList.contains("is-visible") ?? true;
        const rightPanelBeforeTour = document.getElementById("right-context-host")?.dataset.activePanel || null;

        const openCitizenPanelForTour = () => {
            window.setRightContextPanel?.(null, false);
            window.setSiteMethodologyMenu?.(false);
            window.setSiteTopbarMenu?.(false);
            if (typeof window.setMobilePanel === "function") {
                window.setMobilePanel("citizen", true);
            }
        };

        const prepareLayersPanelForTour = () => {
            if (typeof window.setRightContextPanel === "function") {
                window.setRightContextPanel("layers", true);
            }
        };

        const prepareInfrastructureForTour = () => {
            prepareLayersPanelForTour();
            const disclosure = document.getElementById("infrastructure-disclosure");
            if (disclosure) disclosure.open = true;
        };

        const prepareActiveLegendForTour = () => {
            window.setRightContextPanel?.(null, false);
            window.setMobilePanel?.("citizen", false);
            window.showUnifiedLegend?.();
        };

        const prepareMapControlsForTour = () => {
            window.setRightContextPanel?.(null, false);
            window.setMobilePanel?.("citizen", false);
        };

        const prepareBasemapsForTour = () => {
            window.setRightContextPanel?.("basemap", true);
        };

        const prepareSiteTopbarForTour = () => {
            window.setMobilePanel?.("citizen", false);
            window.setSiteTopbarMenu?.(true);
        };

        const prepareMethodologyForTour = () => {
            prepareSiteTopbarForTour();
            window.setSiteMethodologyMenu?.(true);
        };

        const prepareCatalogForTour = () => {
            window.setSiteMethodologyMenu?.(false);
            prepareSiteTopbarForTour();
        };

        const prepareAntLayerForTour = () => {
            prepareLayersPanelForTour();
            const disclosure = document.getElementById("event-layer-disclosure");
            if (disclosure) disclosure.open = true;
        };

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
            onDestroyed: () => {
                const restoreRightPanel = ["layers", "basemap"].includes(rightPanelBeforeTour)
                    ? rightPanelBeforeTour
                    : null;
                window.setRightContextPanel?.(restoreRightPanel, Boolean(restoreRightPanel));
                if (!legendWasVisible) window.hideUnifiedLegend?.();
                window.setSiteMethodologyMenu?.(false);
                window.setSiteTopbarMenu?.(false);
                if (!citizenWasOpen) window.setMobilePanel?.("citizen", false);
                if (isMobile) window.setMobilePanel?.("sidebar", false);
            },
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
                    onHighlightStarted: openCitizenPanelForTour,
                    popover: {
                        title: 'Busca tu territorio',
                        description: 'Escribe una provincia, un cantón o una parroquia para centrarla y seleccionarla. También puedes tocar directamente el territorio en el mapa.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#open-analysis-button',
                    onHighlightStarted: openCitizenPanelForTour,
                    popover: {
                        title: 'Análisis del territorio',
                        description: 'Abre el panel con indicadores, acumulados históricos, tendencia, fuentes y perfil de personas fallecidas para la unidad seleccionada.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: variableTourTarget,
                    onHighlightStarted: prepareLayersPanelForTour,
                    popover: {
                        title: 'Variables y capas del mapa',
                        description: 'En “Datos y capas” eliges qué fenómeno representar y puedes combinarlo con información de siniestros e infraestructura. “Sin dato” nunca se interpreta como cero.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: infrastructureTourTarget,
                    onHighlightStarted: prepareInfrastructureForTour,
                    popover: {
                        title: 'Capas de infraestructura',
                        description: 'Despliega “Infraestructura vial” para activar una o varias capas a la vez y compararlas con la variable territorial.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#map-legend-card',
                    onHighlightStarted: prepareActiveLegendForTour,
                    popover: {
                        title: 'Leyenda siempre a la vista',
                        description: 'Esta tarjeta única explica la variable, sus rangos, el total nacional cuando corresponde y todas las capas activas. Puedes cerrarla para despejar el mapa y recuperarla con el botón “Leyenda”.',
                        side: isMobile ? "top" : "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-right-panel="basemap"]',
                    onHighlightStarted: prepareBasemapsForTour,
                    popover: {
                        title: 'Mapas base',
                        description: 'Cambia el mapa de fondo sin alterar los datos seleccionados ni el territorio que estás consultando.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#event-layer-disclosure',
                    onHighlightStarted: prepareAntLayerForTour,
                    popover: {
                        title: 'Siniestros en el lugar donde ocurrieron',
                        description: 'Activa “Siniestros (ANT)” para ver los mismos eventos de la estadística territorial como concentración, agrupaciones o casos. La cobertura de ubicaciones válidas siempre queda visible.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: mapControlsTourTarget,
                    onHighlightStarted: prepareMapControlsForTour,
                    popover: {
                        title: 'Controles permanentes del mapa',
                        description: isMobile
                            ? 'Las barras existentes reúnen Nivel, Año, Periodo e intensidad sin crear una tercera barra móvil.'
                            : 'La segunda fila del encabezado reúne Nivel, Periodo, Año e intensidad. Cambiar un control actualiza el mapa y la leyenda sin abrir otro panel.',
                        side: isMobile ? "bottom" : "bottom",
                        align: 'center'
                    }
                },
                {
                    element: '#site-methodology-toggle',
                    onHighlightStarted: prepareMethodologyForTour,
                    popover: {
                        title: 'Metodología y fuentes',
                        description: 'Consulta las fuentes, los periodos disponibles, los cálculos y las limitaciones conocidas de los datos.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#btn-catalog',
                    onHighlightStarted: prepareCatalogForTour,
                    popover: {
                        title: 'Catálogo y descarga de datos',
                        description: 'Busca en una grilla de tarjetas compactas, filtra con chips de categorías reales y expande solo la variable que necesites. Cada detalle conserva sus fuentes, metodología y descargas tabulares o geográficas.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#citizen-panel',
                    onHighlightStarted: openCitizenPanelForTour,
                    popover: {
                        title: 'Ficha PDF del territorio',
                        description: 'Después de seleccionar una unidad se habilita “Descargar ficha PDF”, con mapa, año consultado, acumulado histórico, comparación territorial, gráficos, fuentes y contacto institucional.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#open-institutional-button',
                    onHighlightStarted: prepareSiteTopbarForTour,
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
            coversVariablesAndLayers: true,
            coversUniqueLegendCard: true,
            coversMapControlsToolbar: true
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
