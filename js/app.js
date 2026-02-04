/* ========================================
   APPLICATION MODERNE DE CARTOGRAPHIE
   Script Principal - app.js
   ======================================== */

// Variables globales
let map = null;
let minimap = null;
let highlightLayer = null;
let measureControl = null;
let currentBasemap = null;
let layers = {};
let basemaps = {};
let layerCatalog = {};
let layerStats = {};
const initialBounds = [[12.198254306050035, -17.97204097382814], [16.801676399950065, -10.90026811917176]];

// ========================================
// CATALOGUE DES COUCHES DÉTAILLÉ
// ========================================
const layersCatalog = {
    'Region_3': {
        name: 'Régions',
        description: 'Les 14 régions administratives du Sénégal',
        type: 'Polygone',
        attributes: ['Code', 'Région'],
        color: 'rgba(212,131,239,0.7)',
        icon: 'fa-map',
        visible: true,
        info: 'Couche administrative de niveau régional. Chaque région représente une division administrative majeure du Sénégal.'
    },
    'Departement_4': {
        name: 'Départements',
        description: 'Les départements du Sénégal',
        type: 'Polygone',
        attributes: ['Région', 'Département', 'Num_Dept'],
        color: 'rgba(65,184,208,0.7)',
        icon: 'fa-sitemap',
        visible: false,
        info: 'Subdivision administrative au-dessous des régions. Les départements constituent des unités administratives intermédiaires.'
    },
    'Arrondissement_5': {
        name: 'Arrondissements',
        description: 'Les arrondissements du Sénégal',
        type: 'Polygone',
        attributes: ['cav', 'cod_cav'],
        color: 'rgba(49,199,49,0.7)',
        icon: 'fa-th',
        visible: false,
        info: 'Subdivision administrative au-dessous des départements. Les arrondissements sont les plus petites divisions territoriales.'
    },
    'Routes_6': {
        name: 'Routes',
        description: 'Réseau routier du Sénégal',
        type: 'Ligne',
        attributes: ['type'],
        color: 'rgba(216,36,37,1.0)',
        icon: 'fa-road',
        visible: false,
        info: 'Réseau complet des routes, autoroutes, pistes et voies ferrées. Classés par type et importance.'
    },
    'localites_7': {
        name: 'Localités',
        description: 'Localités et points de peuplement',
        type: 'Point',
        attributes: ['name', 'population'],
        color: 'rgba(52, 152, 219, 0.8)',
        icon: 'fa-city',
        visible: false,
        info: 'Points de peuplement, villes et villages du Sénégal avec informations démographiques.'
    }
};

// Configuration des fonds de carte
const basemapsConfig = {
    osm: {
        name: 'OpenStreetMap',
        desc: 'Carte standard',
        layer: null,
        url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'
    },
    satellite: {
        name: 'Google Satellite',
        desc: 'Imagerie satellite',
        layer: null,
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attribution: ''
    },
    dark: {
        name: 'CartoDB Dark',
        desc: 'Fond sombre',
        layer: null,
        url: 'http://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attribution: ''
    }
};

// ========================================
// INITIALISATION DE LA CARTE
// ========================================

function initializeMap() {
    console.log('Initializing map...');
    // Créer la carte
    map = L.map('map', {
        zoomControl: false,
        maxZoom: 28,
        minZoom: 1
    }).fitBounds(initialBounds);

    // Ajouter hash URL
    new L.Hash(map);

    // Configuration du contrôle d'attribution
    map.attributionControl.setPrefix(
        '<a href="https://leafletjs.com" title="Une librairie JS pour les cartes interactives">Leaflet</a> &middot; ' +
        '<a href="https://qgis.org">QGIS</a>'
    );

    // Initialiser les fonds de carte
    initializeBasemaps();

    // Initialiser les couches de données
    initializeLayers();

    // Ajouter les événements de la carte
    addMapEvents();

    // Initialiser les contrôles personnalisés
    initializeCustomControls();

    // Initialiser la géolocalisation
    initializeGeolocation();

    // Construire les panneaux
    buildLayerPanel();
    buildBasemapsPanel();
    buildLegend();
}

// ========================================
// INITIALISATION DES FONDS DE CARTE
// ========================================

function initializeBasemaps() {
    Object.keys(basemapsConfig).forEach((key, index) => {
        const config = basemapsConfig[key];
        const zIndex = 400 + index;

        map.createPane(`pane_${key}`);
        map.getPane(`pane_${key}`).style.zIndex = zIndex;

        config.layer = L.tileLayer(config.url, {
            pane: `pane_${key}`,
            opacity: 1.0,
            attribution: config.attribution,
            minZoom: 1,
            maxZoom: 28,
            minNativeZoom: 0,
            maxNativeZoom: 20
        });

        basemaps[key] = config.layer;

        // Ajouter le premier en défaut
        if (key === 'osm') {
            config.layer.addTo(map);
            currentBasemap = key;
        }
    });
}

// ========================================
// CHARGEMENT DES DONNÉES À LA DEMANDE
// ========================================

function loadLayerData(layerId) {
    console.log('Loading layer data for:', layerId);
    // Charger le script de données dynamiquement
    const script = document.createElement('script');
    script.src = `data/${layerId}.js`;
    script.defer = true;
    script.onload = () => {
        createLayer(layerId);
    };
    document.head.appendChild(script);
}

function createLayerFromData(layerId, data) {
    const config = getLayerConfig(layerId);
    if (!config) return;

    const paneIndex = 410 + Object.keys(layers).length;
    map.createPane(`pane_${layerId}`);
    map.getPane(`pane_${layerId}`).style.zIndex = paneIndex;
    map.getPane(`pane_${layerId}`).style['mix-blend-mode'] = 'normal';

    const geoJsonLayer = L.geoJson(data, {
        attribution: '',
        interactive: true,
        dataVar: `json_${layerId}`,
        layerName: `layer_${layerId}`,
        pane: `pane_${layerId}`,
        onEachFeature: config.popup,
        style: config.style,
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#3498db",
                color: "#2c3e50",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        }
    });

    // Calculer les statistiques
    const stats = {
        featureCount: data.features ? data.features.length : 0,
        bounds: null
    };

    if (data.features && data.features.length > 0) {
        stats.bounds = L.geoJson(data).getBounds();
    }

    layers[layerId] = {
        layer: geoJsonLayer,
        name: config.name,
        visible: true,
        config: config,
        stats: stats,
        catalog: layersCatalog[layerId]
    };

    // Ajouter la couche
    map.addLayer(geoJsonLayer);
    updateLegend();
}

function getLayerConfig(id) {
    const configs = {
        'Region_3': { name: 'Régions', style: styleRegion, popup: popRegion },
        'Departement_4': { name: 'Départements', style: styleDepartement, popup: popDepartement },
        'Arrondissement_5': { name: 'Arrondissements', style: styleArrondissement, popup: popArrondissement },
        'Routes_6': { name: 'Routes', style: styleRoutes, popup: popRoutes },
        'localites_7': { name: 'Localités', style: styleLocalites, popup: popLocalites }
    };
    return configs[id];
}

// ========================================
// INITIALISATION DES COUCHES
// ========================================

function initializeLayers() {
    // Charger seulement les couches visibles par défaut, sauf celles déjà chargées
    Object.keys(layersCatalog).forEach(id => {
        if (layersCatalog[id].visible && id !== 'Region_3') {  // Region_3 est déjà chargé
            loadLayerData(id);
        }
    });
    // Créer la couche Region_3 manuellement
    if (layersCatalog['Region_3'].visible && typeof json_Region_3 !== 'undefined') {
        createLayerFromData('Region_3', json_Region_3);
    }
}

// ========================================
// STYLES DES COUCHES
// ========================================

function styleRegion(feature) {
    const colors = {
        'DAKAR': 'rgba(212,131,239,1.0)',
        'DIOURBEL': 'rgba(20,219,93,1.0)',
        'FATICK': 'rgba(130,212,127,1.0)',
        'KAFFRINE': 'rgba(65,184,208,1.0)',
        'KAOLACK': 'rgba(63,124,205,1.0)',
        'KEDOUGOU': 'rgba(45,51,232,1.0)',
        'KOLDA': 'rgba(217,133,84,1.0)',
        'LOUGA': 'rgba(237,58,67,1.0)',
        'MATAM': 'rgba(221,191,94,1.0)',
        'SAINT-LOUIS': 'rgba(225,26,115,1.0)',
        'SEDHIOU': 'rgba(182,203,77,1.0)',
        'TAMBACOUNDA': 'rgba(81,221,188,1.0)',
        'THIES': 'rgba(135,92,209,1.0)',
        'ZIGUINCHOR': 'rgba(128,228,52,1.0)'
    };

    return {
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 2.0,
        fill: true,
        fillOpacity: 1,
        fillColor: colors[feature.properties['Région']] || 'rgba(226,88,205,1.0)',
        interactive: true
    };
}

function styleDepartement(feature) {
    return {
        color: 'rgba(24,44,231,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 2.0,
        fill: true,
        fillOpacity: 0,
        interactive: true
    };
}

function styleArrondissement(feature) {
    return {
        color: 'rgba(49,199,49,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 2.0,
        fill: true,
        fillOpacity: 0,
        interactive: true
    };
}

function styleRoutes(feature) {
    const typeRoutes = {
        'Autres pistes': 'rgba(232,168,59,1.0)',
        'Autres routes': 'rgba(242,83,35,1.0)',
        'Chemin de fer': 'rgba(238,208,80,1.0)',
        'Digues': 'rgba(56,174,207,1.0)',
        'Piste automobile': 'rgba(166,212,120,1.0)',
        'Piste secondaire': 'rgba(246,178,95,1.0)',
        'Route principale': 'rgba(216,36,37,1.0)',
        'Route principale à 2 voies': 'rgba(218,118,36,1.0)',
        'Route principale à 4 voies': 'rgba(227,160,45,1.0)'
    };

    return {
        color: typeRoutes[feature.properties['type']] || 'rgba(200,200,200,1.0)',
        weight: 2.0
    };
}

function styleLocalites(feature) {
    return {
        radius: 6,
        fillColor: "#3498db",
        color: "#2c3e50",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    };
}

// ========================================
// POPUPS
// ========================================

function highlightFeature(e) {
    highlightLayer = e.target;

    if (e.target.feature.geometry.type === 'LineString' || e.target.feature.geometry.type === 'MultiLineString') {
        highlightLayer.setStyle({
            color: 'rgba(255, 255, 0, 1.00)',
            weight: 4
        });
    } else {
        highlightLayer.setStyle({
            fillColor: 'rgba(255, 255, 0, 1.00)',
            fillOpacity: 1,
            weight: 3
        });
    }
}

function resetHighlight(e) {
    const layer = e.target;
    const config = getLayerConfig(layer);
    if (config) {
        const style = config.config.style(layer.feature);
        layer.setStyle(style);
    }
}

function getLayerConfig(layer) {
    for (let key in layers) {
        if (layers[key].layer.hasLayer(layer)) {
            return layers[key];
        }
    }
    return null;
}

function popRegion(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });

    const content = `
        <div class="popup-content">
            <h4>${feature.properties['Région']}</h4>
            <table>
                <tr><td><strong>Code:</strong></td><td>${feature.properties['Code'] || 'N/A'}</td></tr>
                <tr><td><strong>Région:</strong></td><td>${feature.properties['Région'] || 'N/A'}</td></tr>
            </table>
        </div>
    `;
    layer.bindPopup(content, { maxHeight: 400 });
}

function popDepartement(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });

    const content = `
        <div class="popup-content">
            <h4>${feature.properties['Dept']}</h4>
            <table>
                <tr><td><strong>Région:</strong></td><td>${feature.properties['Région'] || 'N/A'}</td></tr>
                <tr><td><strong>Département:</strong></td><td>${feature.properties['Dept'] || 'N/A'}</td></tr>
                <tr><td><strong>Numéro:</strong></td><td>${feature.properties['Num_Dept'] || 'N/A'}</td></tr>
            </table>
        </div>
    `;
    layer.bindPopup(content, { maxHeight: 400 });
}

function popArrondissement(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });

    const content = `
        <div class="popup-content">
            <h4>${feature.properties['cav']}</h4>
            <table>
                <tr><td><strong>Arrondissement:</strong></td><td>${feature.properties['cav'] || 'N/A'}</td></tr>
                <tr><td><strong>Code:</strong></td><td>${feature.properties['cod_cav'] || 'N/A'}</td></tr>
            </table>
        </div>
    `;
    layer.bindPopup(content, { maxHeight: 400 });
}

function popRoutes(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });

    const content = `
        <div class="popup-content">
            <h4>Route</h4>
            <table>
                <tr><td><strong>Type:</strong></td><td>${feature.properties['type'] || 'N/A'}</td></tr>
            </table>
        </div>
    `;
    layer.bindPopup(content, { maxHeight: 400 });
}

function popLocalites(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });

    const content = `
        <div class="popup-content">
            <h4>${feature.properties['NOM']}</h4>
            <table>
                <tr><td><strong>Localité:</strong></td><td>${feature.properties['NOM'] || 'N/A'}</td></tr>
            </table>
        </div>
    `;
    layer.bindPopup(content, { maxHeight: 400 });
}

// ========================================
// ÉVÉNEMENTS DE LA CARTE
// ========================================

function addMapEvents() {
    // Événement de déplacement du curseur
    map.on('mousemove', function(e) {
        const lat = e.latlng.lat.toFixed(4);
        const lng = e.latlng.lng.toFixed(4);
        document.getElementById('coordinates').textContent = `Lat: ${lat}° | Lon: ${lng}°`;
    });

    // Événement de zoom
    map.on('zoomend', function() {
        // updateScale();
    });

    // Événement de changement de centre
    map.on('moveend', function() {
        // updateScale();
    });

    // Événements de couche
    map.on('layeradd layerremove', function() {
        updateLegend();
    });
}

// ========================================
// CONSTRUCTION DES PANNEAUX
// ========================================

function buildLayerPanel() {
    const layersControl = document.getElementById('layers-control');
    layersControl.innerHTML = '';

    Object.keys(layers).forEach(key => {
        const layerInfo = layers[key];
        const catalog = layerInfo.catalog;
        
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item active';
        layerItem.id = `layer-${key}`;

        // Créer un conteneur pour la couche
        const layerContainer = document.createElement('div');
        layerContainer.style.width = '100%';

        // En-tête avec checkbox et nom
        const headerDiv = document.createElement('div');
        headerDiv.style.display = 'flex';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.gap = '8px';
        headerDiv.style.marginBottom = '8px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = layerInfo.visible;
        checkbox.className = 'layer-checkbox';
        checkbox.id = `checkbox-${key}`;
        checkbox.onchange = function() {
            toggleLayer(key);
            layerItem.classList.toggle('active');
        };

        const labelDiv = document.createElement('div');
        labelDiv.style.flex = '1';
        labelDiv.style.cursor = 'pointer';
        labelDiv.onclick = function() {
            if (!checkbox.checked) {
                checkbox.checked = true;
                checkbox.onchange();
            }
        };

        const labelName = document.createElement('label');
        labelName.textContent = layerInfo.name;
        labelName.style.fontWeight = 'bold';
        labelName.style.margin = '0';
        labelName.style.cursor = 'pointer';

        labelDiv.appendChild(labelName);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'layer-info-btn';
        infoBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
        infoBtn.style.background = 'none';
        infoBtn.style.border = 'none';
        infoBtn.style.cursor = 'pointer';
        infoBtn.style.color = '#0077BE';
        infoBtn.style.fontSize = '14px';
        infoBtn.style.padding = '4px 8px';
        infoBtn.style.transition = 'all 0.3s';
        infoBtn.onmouseover = function() {
            this.style.transform = 'scale(1.2)';
        };
        infoBtn.onmouseout = function() {
            this.style.transform = 'scale(1)';
        };
        infoBtn.onclick = function(e) {
            e.stopPropagation();
            showLayerInfo(key);
        };

        headerDiv.appendChild(checkbox);
        headerDiv.appendChild(labelDiv);
        headerDiv.appendChild(infoBtn);

        // Description seulement
        const descDiv = document.createElement('div');
        descDiv.style.fontSize = '0.85rem';
        descDiv.style.marginLeft = '26px';
        descDiv.style.color = '#666';
        descDiv.style.paddingTop = '5px';
        descDiv.style.borderTop = '1px solid #e0e0e0';
        descDiv.innerHTML = `<p style="margin: 0; line-height: 1.4;">${catalog.description}</p>`;

        layerContainer.appendChild(headerDiv);
        layerContainer.appendChild(descDiv);

        layerItem.appendChild(layerContainer);
        layersControl.appendChild(layerItem);
    });
}

// ========================================
// FONCTION D'AFFICHAGE DES INFORMATIONS DÉTAILLÉES
// ========================================

function showLayerInfo(key) {
    const layerInfo = layers[key];
    const catalog = layerInfo.catalog;
    const stats = layerInfo.stats;

    // Créer une modal avec les informations détaillées
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'layer-info-modal';
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '500px';
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #0077BE;">
            <h2 style="margin: 0; color: #0077BE;"><i class="fas ${catalog.icon}"></i> ${layerInfo.name}</h2>
            <button onclick="document.getElementById('layer-info-modal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
        </div>

        <div style="margin-bottom: 15px;">
            <h3 style="color: #0077BE; margin-bottom: 8px; margin-top: 0;">Description</h3>
            <p style="margin: 0; color: #333; line-height: 1.5;">${catalog.info}</p>
        </div>

        <div style="margin-bottom: 15px;">
            <h3 style="color: #0077BE; margin-bottom: 8px; margin-top: 0;">Caractéristiques</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px; font-weight: bold; width: 40%; color: #0077BE;">Type de géométrie:</td>
                    <td style="padding: 8px; color: #333;">${catalog.type}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px; font-weight: bold; width: 40%; color: #0077BE;">Nombre d'objets:</td>
                    <td style="padding: 8px; color: #333;">${stats.featureCount}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px; font-weight: bold; width: 40%; color: #0077BE;">Attributs disponibles:</td>
                    <td style="padding: 8px; color: #333;">${catalog.attributes.join(', ')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold; width: 40%; color: #0077BE;">Couleur:</td>
                    <td style="padding: 8px; display: flex; align-items: center; gap: 8px;">
                        <div style="width: 20px; height: 20px; background-color: ${catalog.color}; border: 1px solid #ccc; border-radius: 2px;"></div>
                        <span style="color: #333;">${catalog.color}</span>
                    </td>
                </tr>
            </table>
        </div>

        <div style="display: flex; gap: 10px;">
            <button onclick="if(layers['${key}'].stats.bounds) { map.fitBounds(layers['${key}'].stats.bounds); document.getElementById('layer-info-modal').remove(); }" style="flex: 1; padding: 10px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                <i class="fas fa-search-plus"></i> Centrer sur la couche
            </button>
            <button onclick="document.getElementById('layer-info-modal').remove()" style="flex: 1; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Fermer
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// ========================================
// FONCTION DE RECHERCHE/FILTRAGE DES COUCHES
// ========================================

function filterLayers(searchText) {
    const layerItems = document.querySelectorAll('.layer-item');
    const searchLower = searchText.toLowerCase();

    layerItems.forEach(item => {
        const layerName = item.querySelector('label')?.textContent.toLowerCase();
        const layerDesc = item.querySelector('[style*="color: #666"]')?.textContent.toLowerCase() || '';
        
        if (layerName && (layerName.includes(searchLower) || layerDesc.includes(searchLower))) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function buildBasemapsPanel() {
    const basemapsControl = document.getElementById('basemaps-control');
    basemapsControl.innerHTML = '';

    Object.keys(basemapsConfig).forEach(key => {
        const config = basemapsConfig[key];
        const basemapItem = document.createElement('div');
        basemapItem.className = key === currentBasemap ? 'basemap-item active' : 'basemap-item';

        basemapItem.innerHTML = `
            <div class="basemap-thumbnail">
                <i class="fas fa-map"></i>
            </div>
            <div class="basemap-info">
                <p class="basemap-name">${config.name}</p>
                <p class="basemap-desc">${config.desc}</p>
            </div>
        `;

        basemapItem.addEventListener('click', function() {
            switchBasemap(key);
        });

        basemapsControl.appendChild(basemapItem);
    });
}

function buildLegend() {
    const legendContent = document.getElementById('legend-content');
    legendContent.innerHTML = '<h4>Légende des couches</h4>';

    // Légende des couches avec images générées par qgis2web
    const legendItems = [
        {
            name: 'Régions',
            image: 'legend/Region_3_14.png',
            categories: [
                { label: 'DAKAR', image: 'legend/Region_3_DAKAR0.png' },
                { label: 'DIOURBEL', image: 'legend/Region_3_DIOURBEL1.png' },
                { label: 'FATICK', image: 'legend/Region_3_FATICK2.png' },
                { label: 'KAFFRINE', image: 'legend/Region_3_KAFFRINE3.png' },
                { label: 'KAOLACK', image: 'legend/Region_3_KAOLACK4.png' },
                { label: 'KEDOUGOU', image: 'legend/Region_3_KEDOUGOU5.png' },
                { label: 'KOLDA', image: 'legend/Region_3_KOLDA6.png' },
                { label: 'LOUGA', image: 'legend/Region_3_LOUGA7.png' },
                { label: 'MATAM', image: 'legend/Region_3_MATAM8.png' },
                { label: 'SAINT-LOUIS', image: 'legend/Region_3_SAINTLOUIS9.png' },
                { label: 'SEDHIOU', image: 'legend/Region_3_SEDHIOU10.png' },
                { label: 'TAMBACOUNDA', image: 'legend/Region_3_TAMBACOUNDA11.png' },
                { label: 'THIES', image: 'legend/Region_3_THIES12.png' },
                { label: 'ZIGUINCHOR', image: 'legend/Region_3_ZIGUINCHOR13.png' }
            ]
        },
        {
            name: 'Départements',
            image: 'legend/Departement_4.png',
            categories: []
        },
        {
            name: 'Arrondissements',
            image: 'legend/Arrondissement_5.png',
            categories: []
        },
        {
            name: 'Routes',
            image: 'legend/Routes_6_9.png',
            categories: [
                { label: 'Autres pistes', image: 'legend/Routes_6_Autrespistes0.png' },
                { label: 'Autres routes', image: 'legend/Routes_6_Autresroutes1.png' },
                { label: 'Chemin de fer', image: 'legend/Routes_6_Chemindefer2.png' },
                { label: 'Digues', image: 'legend/Routes_6_Digues3.png' },
                { label: 'Piste automobile', image: 'legend/Routes_6_Pisteautomobile4.png' },
                { label: 'Piste secondaire', image: 'legend/Routes_6_Pistesecondaire5.png' },
                { label: 'Route principale', image: 'legend/Routes_6_Routeprincipale6.png' },
                { label: 'Route principale à 2 voies', image: 'legend/Routes_6_Routeprincipaleà2voies7.png' },
                { label: 'Route principale à 4 voies', image: 'legend/Routes_6_Routeprincipaleà4voies8.png' }
            ]
        },
        {
            name: 'Localités',
            image: 'legend/localites_7.png',
            categories: []
        }
    ];

    legendItems.forEach(item => {
        if (layers[item.name.toLowerCase().replace(/[éè]/g, 'e')] && layers[item.name.toLowerCase().replace(/[éè]/g, 'e')].visible || 
            (item.name === 'Régions' && layers['Region_3'] && layers['Region_3'].visible) ||
            (item.name === 'Départements' && layers['Departement_4'] && layers['Departement_4'].visible) ||
            (item.name === 'Arrondissements' && layers['Arrondissement_5'] && layers['Arrondissement_5'].visible) ||
            (item.name === 'Routes' && layers['Routes_6'] && layers['Routes_6'].visible) ||
            (item.name === 'Localités' && layers['localites_7'] && layers['localites_7'].visible)) {
            
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            // Nom de la couche avec image
            let html = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img src="${item.image}" alt="${item.name}" style="max-width: 20px; max-height: 20px;">
                <h4 style="margin: 0; font-weight: 600;">${item.name}</h4>
            </div>`;
            
            // Catégories si disponibles
            if (item.categories && item.categories.length > 0) {
                html += '<table style="width: 100%; font-size: 0.9rem;">';
                item.categories.forEach(cat => {
                    html += `<tr>
                        <td style="text-align: center; padding: 4px;"><img src="${cat.image}" alt="${cat.label}" style="max-width: 20px; max-height: 20px;"></td>
                        <td style="padding: 4px; padding-left: 8px;">${cat.label}</td>
                    </tr>`;
                });
                html += '</table>';
            }
            
            legendItem.innerHTML = html;
            legendContent.appendChild(legendItem);
        }
    });
}

// ========================================
// GESTION DES COUCHES
// ========================================

function toggleLayer(key) {
    let layerInfo = layers[key];
    if (!layerInfo) {
        // Charger la couche si elle n'existe pas
        loadLayerData(key);
        return;
    }

    try {
        if (layerInfo.visible) {
            map.removeLayer(layerInfo.layer);
            layerInfo.visible = false;
        } else {
            // Vérifier que la couche n'est pas déjà sur la carte
            if (!map.hasLayer(layerInfo.layer)) {
                map.addLayer(layerInfo.layer);
            }
            layerInfo.visible = true;
        }
        
        // Mettre à jour la légende sans délai
        updateLegend();
    } catch (error) {
        console.error('Erreur lors du basculement de la couche:', error);
    }
}

function switchBasemap(key) {
    // Retirer l'ancien fond
    if (currentBasemap && basemaps[currentBasemap]) {
        map.removeLayer(basemaps[currentBasemap]);
    }

    // Ajouter le nouveau fond
    if (basemaps[key]) {
        map.addLayer(basemaps[key]);
        currentBasemap = key;

        // Mettre à jour l'interface
        document.querySelectorAll('.basemap-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.basemap-item').classList.add('active');
    }
}

// ========================================
// CONTRÔLES PERSONNALISÉS
// ========================================

function initializeCustomControls() {
    // Zoom contrôles
    document.getElementById('zoom-in').addEventListener('click', function() {
        map.zoomIn();
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        map.zoomOut();
    });

    document.getElementById('zoom-reset').addEventListener('click', function() {
        map.fitBounds(initialBounds);
    });

    // Initialiser l'échelle
    // updateScale();

    // Initialiser la minimap
    initializeMinimap();

    // Événement de recherche
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performQuickSearch();
        }
    });
}

function initializeMinimap() {
    const minimapContainer = document.getElementById('minimap-canvas');
    
    // Créer la minimap
    minimap = L.map(minimapContainer, {
        attributionControl: false,
        zoomControl: false,
        maxZoom: 28,
        minZoom: 1,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false
    }).fitBounds(initialBounds);

    // Ajouter le fond de carte OSM à la minimap
    L.tileLayer('http://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        minZoom: 1,
        maxZoom: 28,
        minNativeZoom: 0,
        maxNativeZoom: 19
    }).addTo(minimap);

    // Créer un rectangle pour montrer la vue actuelle
    const minimapBounds = L.rectangle(map.getBounds(), {
        color: '#0077BE',
        weight: 2,
        fill: true,
        fillColor: '#0077BE',
        fillOpacity: 0.1
    }).addTo(minimap);

    // Mettre à jour le rectangle quand la carte principale bouge
    map.on('moveend', function() {
        minimapBounds.setBounds(map.getBounds());
    });

    map.on('zoomend', function() {
        minimapBounds.setBounds(map.getBounds());
    });

    // Cliquer sur la minimap pour naviguer
    minimap.on('click', function(e) {
        map.setView(e.latlng, map.getZoom());
    });
}

// function updateScale() {
//     const bounds = map.getBounds();
//     const center = map.getCenter();
//     const meterPerPixel = 40075017 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
//     const scale = meterPerPixel * 100; // Pour 100 pixels

//     const scaleText = scale > 1000 ?
//         `${(scale / 1000).toFixed(1)} km` :
//         `${scale.toFixed(0)} m`;

//     document.querySelector('.scale-text').textContent = scaleText;
//     document.querySelector('.scale-line').style.width = '100px';
// }

function updateLegend() {
    buildLegend();
}

// ========================================
// NAVIGATION ET MODALES
// ========================================

function openModal(title, content) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
}

function openAccueil() {
    const content = `
        <h3>Bienvenue sur la Cartographie Web du Sénégal</h3>
        <p>Cette application présente une cartographie interactive des limites administratives du Sénégal, notamment:</p>
        <ul>
            <li><strong>Régions</strong> - Les 14 régions administratives du Sénégal</li>
            <li><strong>Départements</strong> - Les départements et leurs délimitations</li>
            <li><strong>Arrondissements</strong> - Les circonscriptions administratives</li>
            <li><strong>Routes</strong> - Le réseau routier principal et secondaire</li>
            <li><strong>Localités</strong> - Les principaux centres urbains et localités</li>
        </ul>
        <h3>Comment utiliser cette application?</h3>
        <p><strong>Navigation:</strong></p>
        <ul>
            <li>Utilisez votre souris pour explorer la carte</li>
            <li>Zoomez avec la molette de la souris ou les boutons de contrôle</li>
            <li>Cliquez sur les entités pour voir les détails</li>
        </ul>
        <p><strong>Contrôles:</strong></p>
        <ul>
            <li><i class="fas fa-layer-group"></i> <strong>Couches</strong> - Gérez la visibilité des couches</li>
            <li><i class="fas fa-map"></i> <strong>Fonds de carte</strong> - Changez le fond de carte</li>
            <li><i class="fas fa-ruler"></i> <strong>Mesurer</strong> - Mesurez les distances et surfaces</li>
        </ul>
    `;
    openModal('Accueil', content);
}

function openAbout() {
    const content = `
        <h3>À propos de cette application</h3>
        <p>Cette application cartographique a été créée à partir de données géospatiales du Sénégal et transformée en interface moderne et intuitive.</p>
        <h3>Technologies utilisées</h3>
        <ul>
            <li><strong>Leaflet.js</strong> - Librairie de cartographie interactive</li>
            <li><strong>QGIS</strong> - Système d'information géographique</li>
            <li><strong>GeoJSON</strong> - Format de données géospatiales</li>
            <li><strong>HTML5/CSS3/JavaScript</strong> - Technologies web modernes</li>
        </ul>
        <h3>Données</h3>
        <p>Les données géospatiales utilisées dans cette application représentent les limites administratives du Sénégal.</p>
        <h3>Support</h3>
        <p>Pour toute question ou suggestion, veuillez contacter les administrateurs du système.</p>
    `;
    openModal('À propos', content);
}

function openSpatialQuery() {
    const content = `
        <h3>Requête Spatiale</h3>
        <p>Sélectionnez des entités en cliquant sur la carte ou en dessinant une zone.</p>
        
        <div id="spatial-query-form" style="margin: 20px 0;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Mode de sélection:</label>
                <div style="display: flex; gap: 10px;">
                    <button id="spatial-click-btn" onclick="activateSpatialClick()" style="flex: 1; padding: 10px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        📍 Cliquer sur la carte
                    </button>
                    <button id="spatial-draw-btn" onclick="activateSpatialDraw()" style="flex: 1; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        🔲 Dessiner une zone
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Sélectionner couche:</label>
                <select id="spatial-layer-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">-- Toutes les couches --</option>
                    <option value="Region_3">Régions</option>
                    <option value="Departement_4">Départements</option>
                    <option value="Arrondissement_5">Arrondissements</option>
                </select>
            </div>
            
            <button onclick="resetSpatialQuery()" style="width: 100%; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">Réinitialiser</button>
        </div>
        
        <div id="spatial-results" style="margin-top: 20px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;"></div>
        <div id="spatial-status" style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 4px; color: #0077BE; text-align: center; display: none;"></div>
    `;
    openModal('Requête Spatiale', content);
    
    // Variables globales pour la requête spatiale
    window.spatialMode = null;
    window.spatialLayer = null;
}

function activateSpatialClick() {
    window.spatialMode = 'click';
    const btn = document.getElementById('spatial-click-btn');
    const drawBtn = document.getElementById('spatial-draw-btn');
    const status = document.getElementById('spatial-status');
    
    btn.style.background = '#1976d2';
    drawBtn.style.background = '#999';
    status.textContent = '📍 Mode Clic activé - Cliquez sur une entité sur la carte';
    status.style.display = 'block';
    
    window.spatialLayer = document.getElementById('spatial-layer-select').value || null;
    
    // Activer les clics sur les features
    map.on('click', spatialClickHandler);
}

function activateSpatialDraw() {
    window.spatialMode = 'draw';
    const btn = document.getElementById('spatial-click-btn');
    const drawBtn = document.getElementById('spatial-draw-btn');
    const status = document.getElementById('spatial-status');
    
    drawBtn.style.background = '#1976d2';
    btn.style.background = '#999';
    status.textContent = '🔲 Mode Dessin activé - Dessinez une zone sur la carte';
    status.style.display = 'block';
    
    window.spatialLayer = document.getElementById('spatial-layer-select').value || null;
}

function spatialClickHandler(e) {
    const resultsDiv = document.getElementById('spatial-results');
    const clickedLat = e.latlng.lat;
    const clickedLng = e.latlng.lng;
    const point = {type: 'Point', coordinates: [clickedLng, clickedLat]};
    
    let results = [];
    let searchLayers = window.spatialLayer ? [window.spatialLayer] : Object.keys(layers);
    
    // Chercher les features qui contiennent le point cliqué
    searchLayers.forEach(layerKey => {
        if (layers[layerKey] && layers[layerKey].layer) {
            layers[layerKey].layer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.geometry) {
                    // Vérifier si le point est dans la feature
                    if (pointInGeometry(point, layer.feature.geometry)) {
                        results.push({
                            properties: layer.feature.properties,
                            layer: layer,
                            layerName: layers[layerKey].name,
                            latlng: layer.getBounds ? layer.getBounds().getCenter() : null
                        });
                    }
                }
            });
        }
    });
    
    displaySpatialResults(results);
}

function pointInGeometry(point, geometry) {
    const [lng, lat] = point.coordinates;
    
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const coords = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        
        for (let i = 0; i < coords.length; i++) {
            if (pointInPolygon([lat, lng], coords[i])) {
                return true;
            }
        }
    }
    
    return false;
}

function pointInPolygon(point, polygon) {
    const [lat, lng] = point;
    let inside = false;
    
    for (let i = 0, j = polygon[0].length - 1; i < polygon[0].length; j = i++) {
        const xi = polygon[0][i][0];
        const yi = polygon[0][i][1];
        const xj = polygon[0][j][0];
        const yj = polygon[0][j][1];
        
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi) / (yj - yi) + xi));
        if (intersect) inside = !inside;
    }
    
    return inside;
}

function displaySpatialResults(results) {
    const resultsDiv = document.getElementById('spatial-results');
    resultsDiv.innerHTML = '';
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: #f57c00; background: #fff3e0; border-radius: 4px;">Aucune entité trouvée à cet endroit</div>';
        return;
    }
    
    resultsDiv.innerHTML = `<div style="padding: 5px; color: #1976d2; font-weight: bold; margin-bottom: 10px;">🎯 ${results.length} entité(s) trouvée(s)</div>`;
    
    results.forEach((result, index) => {
        const props = result.properties;
        const resultItem = document.createElement('div');
        resultItem.style.cssText = 'background: #f5f5f5; padding: 10px; margin: 5px 0; border-left: 3px solid #0077BE; border-radius: 3px; cursor: pointer; transition: all 0.3s;';
        resultItem.onmouseover = function() { this.style.background = '#e3f2fd'; };
        resultItem.onmouseout = function() { this.style.background = '#f5f5f5'; };
        
        let displayText = props['Région'] || props['Dept'] || props['Arrondissement'] || ('Entité ' + (index + 1));
        
        resultItem.innerHTML = `
            <div style="font-weight: bold; color: #0077BE;">${displayText}</div>
            <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                ${result.layerName} | Code: ${props['Code'] || 'N/A'}
            </div>
        `;
        
        resultItem.addEventListener('click', function() {
            if (result.latlng) {
                map.setView(result.latlng, 10);
                if (result.layer.openPopup) {
                    result.layer.openPopup(result.latlng);
                }
            }
        });
        
        resultsDiv.appendChild(resultItem);
    });
}

function resetSpatialQuery() {
    window.spatialMode = null;
    window.spatialLayer = null;
    map.off('click', spatialClickHandler);
    
    if (document.getElementById('spatial-click-btn')) {
        document.getElementById('spatial-click-btn').style.background = '#0077BE';
    }
    if (document.getElementById('spatial-draw-btn')) {
        document.getElementById('spatial-draw-btn').style.background = '#0077BE';
    }
    if (document.getElementById('spatial-results')) {
        document.getElementById('spatial-results').innerHTML = '';
    }
    if (document.getElementById('spatial-status')) {
        document.getElementById('spatial-status').style.display = 'none';
    }
}

function openAttributeQuery() {
    const content = `
        <h3>Requête Attributaire</h3>
        <p>Filtrez les entités en fonction de leurs attributs (Région, Département, Arrondissement)</p>
        
        <div id="query-form" style="margin: 20px 0;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Type d'entité:</label>
                <select id="entity-type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">-- Sélectionnez un type --</option>
                    <option value="Region">Région</option>
                    <option value="Departement">Département</option>
                    <option value="Arrondissement">Arrondissement</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Valeur à chercher:</label>
                <input type="text" id="query-value" placeholder="Ex: Dakar, Saint-Louis..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            </div>
            
            <button onclick="executeAttributeQuery()" style="width: 100%; padding: 10px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 10px;">🔍 Rechercher</button>
            <button onclick="resetAttributeQuery()" style="width: 100%; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Réinitialiser</button>
        </div>
        
        <div id="query-results" style="margin-top: 20px; max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;"></div>
    `;
    openModal('Requête Attributaire', content);
}

function executeAttributeQuery() {
    const entityType = document.getElementById('entity-type').value;
    const queryValue = document.getElementById('query-value').value.toLowerCase();
    const resultsDiv = document.getElementById('query-results');
    
    if (!entityType || !queryValue) {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: #d32f2f; background: #ffebee; border-radius: 4px;">Veuillez sélectionner un type et entrer une valeur</div>';
        return;
    }
    
    let results = [];
    let layerKey = '';
    
    // Déterminer quelle couche rechercher
    if (entityType === 'Region') {
        layerKey = 'Region_3';
    } else if (entityType === 'Departement') {
        layerKey = 'Departement_4';
    } else if (entityType === 'Arrondissement') {
        layerKey = 'Arrondissement_5';
    }
    
    if (layers[layerKey] && layers[layerKey].layer) {
        layers[layerKey].layer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                let matchValue = '';
                
                // Chercher dans les différents champs selon le type
                if (entityType === 'Region') {
                    matchValue = (props['Région'] || props['region'] || '').toLowerCase();
                } else if (entityType === 'Departement') {
                    matchValue = (props['Dept'] || props['departement'] || '').toLowerCase();
                } else if (entityType === 'Arrondissement') {
                    matchValue = (props['Arrondissement'] || props['arrondissement'] || '').toLowerCase();
                }
                
                if (matchValue.includes(queryValue)) {
                    results.push({
                        properties: props,
                        layer: layer,
                        latlng: layer.getBounds ? layer.getBounds().getCenter() : null
                    });
                }
            }
        });
    }
    
    displayAttributeQueryResults(results, entityType);
}

function displayAttributeQueryResults(results, entityType) {
    const resultsDiv = document.getElementById('query-results');
    resultsDiv.innerHTML = '';
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: #f57c00; background: #fff3e0; border-radius: 4px;">Aucun résultat trouvé</div>';
        return;
    }
    
    resultsDiv.innerHTML = `<div style="padding: 5px; color: #1976d2; font-weight: bold; margin-bottom: 10px;">${results.length} résultat(s) trouvé(s)</div>`;
    
    results.forEach((result, index) => {
        const props = result.properties;
        const resultItem = document.createElement('div');
        resultItem.style.cssText = 'background: #f5f5f5; padding: 10px; margin: 5px 0; border-left: 3px solid #0077BE; border-radius: 3px; cursor: pointer; transition: all 0.3s;';
        resultItem.onmouseover = function() { this.style.background = '#e3f2fd'; };
        resultItem.onmouseout = function() { this.style.background = '#f5f5f5'; };
        
        let displayText = '';
        if (props['Région']) displayText = props['Région'];
        else if (props['Dept']) displayText = props['Dept'];
        else if (props['Arrondissement']) displayText = props['Arrondissement'];
        else displayText = 'Entité ' + (index + 1);
        
        resultItem.innerHTML = `
            <div style="font-weight: bold; color: #0077BE;">${displayText}</div>
            <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                Code: ${props['Code'] || 'N/A'} | 
                Statut: ${props['Statut'] || 'N/A'}
            </div>
        `;
        
        resultItem.addEventListener('click', function() {
            if (result.latlng) {
                map.setView(result.latlng, 10);
                if (result.layer.openPopup) {
                    result.layer.openPopup(result.latlng);
                }
            }
        });
        
        resultsDiv.appendChild(resultItem);
    });
}

function resetAttributeQuery() {
    document.getElementById('entity-type').value = '';
    document.getElementById('query-value').value = '';
    document.getElementById('query-results').innerHTML = '';
}

function openDownloadTools() {
    const content = `
        <h3>Outils de Téléchargement</h3>
        <p>Téléchargez les données géospatiales dans différents formats.</p>
        <p><strong>Formats disponibles:</strong></p>
        <ul>
            <li>GeoJSON</li>
            <li>Shapefile</li>
            <li>KML/KMZ</li>
            <li>GML</li>
            <li>CSV</li>
        </ul>
        <p><button onclick="closeModal()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Télécharger les données</button></p>
    `;
    openModal('Télécharger', content);
}

function activateMeasureTool() {
    // Créer une modal pour l'outil de mesure
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'measure-modal';
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '550px';
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #0077BE;">
            <h2 style="margin: 0; color: #0077BE;"><i class="fas fa-ruler"></i> Outil de Mesure</h2>
            <button onclick="document.getElementById('measure-modal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="color: #0077BE; margin-bottom: 12px; margin-top: 0;">Modes de mesure</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="startDistanceMeasure()" style="width: 100%; padding: 12px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-arrows-alt-h"></i> Mesurer une distance
                </button>
                <button onclick="startAreaMeasure()" style="width: 100%; padding: 12px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-square"></i> Mesurer une surface
                </button>
            </div>
        </div>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0; color: #333;">Instructions:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.6;">
                <li>Cliquez sur "Mesurer une distance" ou "Mesurer une surface"</li>
                <li>Cliquez sur la carte pour ajouter des points</li>
                <li>Double-cliquez ou appuyez sur Entrée pour terminer</li>
                <li>La mesure s'affichera en temps réel sur la carte</li>
                <li>Appuyez sur Échap pour annuler</li>
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; border-left: 4px solid #0077BE;">
            <p style="margin: 0; color: #0077BE; font-size: 0.9rem;">
                <strong>Conseil:</strong> Les mesures s'affichent en mètres et kilomètres pour les distances, en m² et km² pour les surfaces.
            </p>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="document.getElementById('measure-modal').remove()" style="flex: 1; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Fermer
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Mesure de distance
function startDistanceMeasure() {
    document.getElementById('measure-modal').remove();
    
    let isDrawing = false;
    let points = [];
    let line = null;
    let markers = [];

    function addPoint(e) {
        if (!isDrawing) isDrawing = true;
        
        points.push(e.latlng);
        
        // Ajouter un marqueur
        const marker = L.circleMarker(e.latlng, {
            radius: 5,
            fillColor: '#0077BE',
            color: '#005f9e',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        markers.push(marker);

        // Redessiner la ligne
        if (line) map.removeLayer(line);
        line = L.polyline(points, {
            color: '#0077BE',
            weight: 2,
            opacity: 0.8,
            dashArray: '5, 5'
        }).addTo(map);

        // Afficher les distances
        if (points.length > 1) {
            const lastDist = map.distance(points[points.length - 2], points[points.length - 1]);
            const totalDist = calculateTotalDistance(points);
            showMeasureLabel(e.latlng, totalDist);
        }
    }

    function finishMeasure() {
        map.off('click', addPoint);
        
        if (points.length > 1) {
            const totalDistance = calculateTotalDistance(points);
            alert(`Distance totale: ${formatDistance(totalDistance)}`);
        }
    }

    map.on('click', addPoint);
    
    // Double-clic pour terminer
    let lastClick = Date.now();
    map.on('click', function() {
        if (Date.now() - lastClick < 300) {
            finishMeasure();
        }
        lastClick = Date.now();
    });
}

// Mesure de surface
function startAreaMeasure() {
    document.getElementById('measure-modal').remove();
    
    let points = [];
    let polygon = null;
    let markers = [];

    function addPoint(e) {
        points.push(e.latlng);
        
        // Ajouter un marqueur
        const marker = L.circleMarker(e.latlng, {
            radius: 5,
            fillColor: '#FF6B6B',
            color: '#cc5555',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        markers.push(marker);

        // Redessiner le polygone
        if (points.length > 2) {
            if (polygon) map.removeLayer(polygon);
            polygon = L.polygon(points, {
                color: '#FF6B6B',
                weight: 2,
                opacity: 0.8,
                fillColor: '#FF6B6B',
                fillOpacity: 0.2
            }).addTo(map);

            const area = L.GeometryUtil.geodesicArea(points);
            showMeasureLabel(e.latlng, area, true);
        }
    }

    function finishMeasure() {
        map.off('click', addPoint);
        
        if (points.length > 2) {
            const area = L.GeometryUtil.geodesicArea(points);
            alert(`Surface: ${formatArea(area)}`);
        }
    }

    map.on('click', addPoint);
    
    // Double-clic pour terminer
    let lastClick = Date.now();
    map.on('click', function() {
        if (Date.now() - lastClick < 300) {
            finishMeasure();
        }
        lastClick = Date.now();
    });
}

function calculateTotalDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += map.distance(points[i], points[i + 1]);
    }
    return total;
}

function formatDistance(meters) {
    if (meters > 1000) {
        return (meters / 1000).toFixed(2) + ' km';
    }
    return meters.toFixed(2) + ' m';
}

function formatArea(squareMeters) {
    if (squareMeters > 1000000) {
        return (squareMeters / 1000000).toFixed(2) + ' km²';
    }
    return squareMeters.toFixed(2) + ' m²';
}

function showMeasureLabel(latlng, value, isArea = false) {
    const text = isArea ? formatArea(value) : formatDistance(value);
    // Affichage simple - on peut améliorer avec des popups
}

function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('open');
}

function switchTab(tabName) {
    // Cacher tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Désactiver tous les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Afficher l'onglet sélectionné
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Activer le bouton sélectionné
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

function switchTabAndOpen(tabName) {
    // Ouvrir le panneau droit
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel && !rightPanel.classList.contains('open')) {
        rightPanel.classList.add('open');
    }
    
    // Cacher tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Désactiver tous les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Afficher l'onglet sélectionné
    const tabElement = document.getElementById(`${tabName}-tab`);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Activer le bouton correspondant
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName)) {
            btn.classList.add('active');
        }
    });
}

function openDownloadTools() {
    const content = `
        <h3>Outils de Téléchargement</h3>
        <p>Téléchargez les données géospatiales dans différents formats.</p>
        <p><strong>Formats disponibles:</strong></p>
        <ul>
            <li><button onclick="downloadAsCSV()" style="padding: 8px 16px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px 0;">📥 Télécharger en CSV</button></li>
            <li><button onclick="downloadAsGeoJSON()" style="padding: 8px 16px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px 0;">📥 Télécharger en GeoJSON</button></li>
        </ul>
    `;
    openModal('Télécharger les données', content);
}

// ========================================
// MENU HAMBURGER (RESPONSIVE)
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    // Fermer la modale en cliquant en dehors
    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    // Initialiser la carte une fois le DOM chargé
    initializeMap();
});

// Initialiser immédiatement si le DOM est déjà prêt
if (document.readyState === 'loading') {
    // Le DOM n'est pas encore prêt, l'event listener ci-dessus s'en chargera
} else {
    // Le DOM est prêt, initialiser immédiatement
    initializeMap();
}

// ========================================
// UTILITAIRES
// ========================================

// Format coordonnées
function formatCoordinates(lat, lng) {
    const formatDMS = (decimal, isLat) => {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesDecimal = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
        const direction = decimal >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
        return `${degrees}°${minutes}'${seconds}"${direction}`;
    };

    return {
        decimal: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        dms: `${formatDMS(lat, true)}, ${formatDMS(lng, false)}`
    };
}

// ========================================
// TÉLÉCHARGEMENTS
// ========================================

function downloadAsCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nom,Type,Latitude,Longitude\n";

    // Parcourir toutes les couches et exporter les données
    Object.keys(layers).forEach(key => {
        if (layers[key].visible) {
            layers[key].layer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    const props = layer.feature.properties;
                    const lat = layer.getLatLng ? layer.getLatLng().lat : '';
                    const lng = layer.getLatLng ? layer.getLatLng().lng : '';
                    const name = props['NOM'] || props['Région'] || props['Dept'] || props['cav'] || 'N/A';
                    csvContent += `"${name}","${layers[key].name}","${lat}","${lng}"\n`;
                }
            });
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sig_senegal_donnees.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Données exportées en CSV avec succès!");
}

function downloadAsGeoJSON() {
    let geoJsonContent = {
        type: "FeatureCollection",
        features: []
    };

    // Parcourir toutes les couches et exporter les géométries
    Object.keys(layers).forEach(key => {
        if (layers[key].visible) {
            layers[key].layer.eachLayer(function(layer) {
                if (layer.feature) {
                    geoJsonContent.features.push(layer.feature);
                }
            });
        }
    });

    const dataStr = JSON.stringify(geoJsonContent, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sig_senegal_donnees.geojson");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert("Données exportées en GeoJSON avec succès!");
}

function printMap() {
    window.print();
    alert("Préparez votre imprimante et confirmez l'impression.");
}

function resetMapView() {
    map.fitBounds(initialBounds);
}

function openDataCatalog() {
    const catalogContent = `
        <h3>Catalogue des Données</h3>
        <p>Consultez l'inventaire complet des données disponibles dans cette application:</p>
        <div style="margin-top: 20px;">
            <div style="background: #e0f4f9; padding: 12px; border-left: 4px solid #0077BE; margin: 10px 0; border-radius: 4px;">
                <strong>📍 Régions</strong>
                <p style="margin: 5px 0; font-size: 0.9rem;">Les 14 régions administratives du Sénégal avec leurs délimitations.</p>
            </div>
            <div style="background: #e0f4f9; padding: 12px; border-left: 4px solid #0077BE; margin: 10px 0; border-radius: 4px;">
                <strong>📍 Départements</strong>
                <p style="margin: 5px 0; font-size: 0.9rem;">Les départements administratifs avec leurs codes et régions associées.</p>
            </div>
            <div style="background: #e0f4f9; padding: 12px; border-left: 4px solid #0077BE; margin: 10px 0; border-radius: 4px;">
                <strong>📍 Arrondissements</strong>
                <p style="margin: 5px 0; font-size: 0.9rem;">Les circonscriptions administratives locales.</p>
            </div>
            <div style="background: #e0f4f9; padding: 12px; border-left: 4px solid #0077BE; margin: 10px 0; border-radius: 4px;">
                <strong>🛣️ Routes</strong>
                <p style="margin: 5px 0; font-size: 0.9rem;">Réseau routier principal et secondaire classé par type.</p>
            </div>
            <div style="background: #e0f4f9; padding: 12px; border-left: 4px solid #0077BE; margin: 10px 0; border-radius: 4px;">
                <strong>🏘️ Localités</strong>
                <p style="margin: 5px 0; font-size: 0.9rem;">Centres urbains et localités principales du Sénégal.</p>
            </div>
        </div>
    `;
    openModal('Catalogue des Données', catalogContent);
}

function openSearchBox() {
    const searchBox = document.getElementById('search-box');
    searchBox.classList.add('show');
    document.getElementById('search-input').focus();
}

function closeSearchBox() {
    const searchBox = document.getElementById('search-box');
    searchBox.classList.remove('show');
    document.getElementById('search-results').innerHTML = '';
}

function performQuickSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (query.length < 2) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Entrez au moins 2 caractères</div>';
        return;
    }

    let results = [];

    // Chercher dans toutes les couches
    Object.keys(layers).forEach(key => {
        layers[key].layer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                const name = (props['NOM'] || props['Région'] || props['Dept'] || props['cav'] || '').toLowerCase();
                
                if (name.includes(query)) {
                    results.push({
                        name: props['NOM'] || props['Région'] || props['Dept'] || props['cav'],
                        type: layers[key].name,
                        layer: layer,
                        latlng: layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter()
                    });
                }
            }
        });
    });

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Aucun résultat trouvé</div>';
        return;
    }

    results.slice(0, 10).forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div>
                <div class="search-result-name">${result.name}</div>
                <div class="search-result-type">${result.type}</div>
            </div>
        `;
        resultItem.addEventListener('click', function() {
            map.setView(result.latlng, 12);
            if (result.layer.openPopup) {
                result.layer.openPopup();
            }
            closeSearchBox();
        });
        resultsContainer.appendChild(resultItem);
    });

    if (results.length > 10) {
        resultsContainer.innerHTML += `<div style="padding: 10px; text-align: center; color: #999; font-size: 0.9rem;">... et ${results.length - 10} autres résultats</div>`;
    }
}

// ========================================
// CATALOGUE DES COUCHES
// ========================================

function openLayersCatalog() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'layers-catalog-modal';
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };

    let catalogHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0077BE;">
            <h2 style="margin: 0; color: #0077BE;"><i class="fas fa-book"></i> Catalogue des Couches</h2>
            <button onclick="document.getElementById('layers-catalog-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
    `;

    // Ajouter chaque couche avec ses détails
    Object.keys(layers).forEach(key => {
        const layerInfo = layers[key];
        const catalog = layerInfo.catalog;
        const stats = layerInfo.stats;

        catalogHTML += `
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #f9f9f9; transition: all 0.3s;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <div style="width: 30px; height: 30px; background-color: ${catalog.color}; border-radius: 4px; border: 1px solid #ccc;"></div>
                    <h3 style="margin: 0; color: #0077BE; font-size: 1rem;">${layerInfo.name}</h3>
                </div>

                <p style="margin: 8px 0; font-size: 0.85rem; color: #555; line-height: 1.4;">${catalog.description}</p>

                <div style="background: white; padding: 10px; border-radius: 4px; margin-top: 10px; border-left: 3px solid ${catalog.color};">
                    <table style="width: 100%; font-size: 0.75rem;">
                        <tr>
                            <td style="font-weight: bold; color: #0077BE; width: 45%;">Type:</td>
                            <td style="color: #333;">${catalog.type}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold; color: #0077BE;">Objets:</td>
                            <td style="color: #333;">${stats.featureCount}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold; color: #0077BE;">Icône:</td>
                            <td style="color: #333;"><i class="fas ${catalog.icon}"></i></td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 10px;">
                    <h4 style="margin: 8px 0 5px 0; font-size: 0.8rem; color: #0077BE;">Attributs:</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${catalog.attributes.map(attr => `<span style="background: #e3f2fd; color: #0077BE; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">${attr}</span>`).join('')}
                    </div>
                </div>

                <div style="margin-top: 12px;">
                    <button onclick="if(layers['${key}'].stats.bounds) { map.fitBounds(layers['${key}'].stats.bounds); document.getElementById('layers-catalog-modal').remove(); }" style="width: 100%; padding: 8px; background: #0077BE; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem;">
                        <i class="fas fa-search-plus"></i> Centrer
                    </button>
                </div>
            </div>
        `;
    });

    catalogHTML += `
        </div>

        <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button onclick="exportCatalog()" style="flex: 1; padding: 10px; background: #1dd1a1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                <i class="fas fa-download"></i> Exporter
            </button>
            <button onclick="document.getElementById('layers-catalog-modal').remove()" style="flex: 1; padding: 10px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Fermer
            </button>
        </div>
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '900px';
    modalContent.style.maxHeight = '85vh';
    modalContent.style.overflowY = 'auto';
    modalContent.innerHTML = catalogHTML;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Fonction pour exporter le catalogue
function exportCatalog() {
    let csvContent = 'Couche,Type,Description,Nombre d\'objets,Attributs\n';

    Object.keys(layers).forEach(key => {
        const layerInfo = layers[key];
        const catalog = layerInfo.catalog;
        const stats = layerInfo.stats;

        const row = [
            layerInfo.name,
            catalog.type,
            catalog.description.replace(/,/g, ';'),
            stats.featureCount,
            catalog.attributes.join(';')
        ];
        csvContent += row.map(val => `"${val}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalogue_couches.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// ========================================
// GÉOLOCALISATION
// ========================================

function initializeGeolocation() {
    if (navigator.geolocation) {
        const geolocationButton = L.control({ position: 'bottomright' });

        geolocationButton.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'leaflet-control-geolocation');
            div.innerHTML = '<button id="geolocation-btn" class="geolocation-btn" title="Ma position"><i class="fas fa-crosshairs"></i></button>';
            return div;
        };

        geolocationButton.addTo(map);

        document.getElementById('geolocation-btn').addEventListener('click', function() {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Centrer la carte sur la position
                map.setView([lat, lng], 15);

                // Ajouter un marqueur pour la position
                if (window.userLocationMarker) {
                    map.removeLayer(window.userLocationMarker);
                }
                window.userLocationMarker = L.marker([lat, lng]).addTo(map)
                    .bindPopup(`Votre position<br>Précision: ${accuracy.toFixed(0)} m`)
                    .openPopup();

                // Ajouter un cercle d'incertitude
                if (window.userLocationCircle) {
                    map.removeLayer(window.userLocationCircle);
                }
                window.userLocationCircle = L.circleMarker([lat, lng], {
                    color: 'blue',
                    fillColor: '#blue',
                    fillOpacity: 0.1,
                    radius: accuracy
                }).addTo(map);

            }, function(error) {
                alert('Erreur de géolocalisation: ' + error.message);
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });
    } else {
        console.log('Géolocalisation non supportée par ce navigateur.');
    }
}

// ========================================
// INSTALLATION PWA
// ========================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can install the PWA
    showInstallButton();
});

function showInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
    // Show banner on mobile
    if (window.innerWidth < 768) {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.style.display = 'flex';
        }
    }
}

function installApp() {
    // Hide the app provided install promotion
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
    // Hide the banner
    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.style.display = 'none';
    }
    // Show the install prompt
    if (deferredPrompt) {
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    }
}

// Check if already installed
window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed.');
});

// Event listeners for install banner
document.addEventListener('DOMContentLoaded', function() {
    const installBannerBtn = document.getElementById('install-banner-btn');
    const dismissBannerBtn = document.getElementById('dismiss-banner-btn');

    if (installBannerBtn) {
        installBannerBtn.addEventListener('click', installApp);
    }

    if (dismissBannerBtn) {
        dismissBannerBtn.addEventListener('click', function() {
            const banner = document.getElementById('install-banner');
            if (banner) {
                banner.style.display = 'none';
            }
        });
    }
});
