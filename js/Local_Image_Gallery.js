import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

function setupGlobalLightbox() {
    if (document.getElementById('global-image-lightbox')) return;
    const lightboxId = 'global-image-lightbox';
    const lightboxHTML = `
        <div id="${lightboxId}" class="lightbox-overlay">
            <button class="lightbox-close">&times;</button>
            <button class="lightbox-prev">&lt;</button>
            <button class="lightbox-next">&gt;</button>
            <div class="lightbox-content">
                <img src="" alt="Preview" style="display: none;">
                <video src="" controls autoplay style="display: none;"></video>
                <audio src="" controls autoplay style="display: none;"></audio>
            </div>
            <div class="lightbox-dimensions"></div>
        </div>
    `;
    const lightboxCSS = `
        #${lightboxId} { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.85); display: none; align-items: center; justify-content: center; z-index: 10000; box-sizing: border-box; -webkit-user-select: none; user-select: none; }
        #${lightboxId} .lightbox-content { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        #${lightboxId} img, #${lightboxId} video { max-width: 95%; max-height: 95%; object-fit: contain; transition: transform 0.1s ease-out; transform: scale(1) translate(0, 0); }
        #${lightboxId} audio { width: 80%; max-width: 600px; }
        #${lightboxId} img { cursor: grab; }
        #${lightboxId} img.panning { cursor: grabbing; }
        #${lightboxId} .lightbox-close { position: absolute; top: 15px; right: 20px; width: 35px; height: 35px; background-color: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; border: 2px solid #fff; font-size: 24px; line-height: 30px; text-align: center; cursor: pointer; z-index: 10002; }
        #${lightboxId} .lightbox-prev, #${lightboxId} .lightbox-next { position: absolute; top: 50%; transform: translateY(-50%); width: 45px; height: 60px; background-color: rgba(0,0,0,0.4); color: #fff; border: none; font-size: 30px; cursor: pointer; z-index: 10001; transition: background-color 0.2s; }
        #${lightboxId} .lightbox-prev:hover, #${lightboxId} .lightbox-next:hover { background-color: rgba(0,0,0,0.7); }
        #${lightboxId} .lightbox-prev { left: 15px; }
        #${lightboxId} .lightbox-next { right: 15px; }
        #${lightboxId} [disabled] { display: none; }
        #${lightboxId} .lightbox-dimensions { 
            position: absolute; 
            bottom: 0px; 
            left: 50%; 
            transform: translateX(-50%); 
            background-color: rgba(0, 0, 0, 0.7); 
            color: #fff; 
            padding: 2px 4px; 
            border-radius: 5px; 
            font-size: 14px; 
            z-index: 10001; 
        }
    `;
    document.body.insertAdjacentHTML('beforeend', lightboxHTML);
    const styleEl = document.createElement('style');
    styleEl.textContent = lightboxCSS;
    document.head.appendChild(styleEl);
}

setupGlobalLightbox();


app.registerExtension({
    name: "Comfy.LocalImageGallery",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "LocalImageGalleryNode") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);

                if (!this.properties || !this.properties.gallery_unique_id) {
                    if (!this.properties) { this.properties = {}; }
                    this.properties.gallery_unique_id = "gallery-" + Math.random().toString(36).substring(2, 11);
                }

                const node_instance = this;

                const galleryIdWidget = this.addWidget(
                    "text",
                    "gallery_unique_id_widget",
                    this.properties.gallery_unique_id,
                    () => {},
                    {}
                );

                galleryIdWidget.serializeValue = () => {
                    return node_instance.properties.gallery_unique_id;
                };

                galleryIdWidget.draw = function(ctx, node, widget_width, y, widget_height) {
                };

                galleryIdWidget.computeSize = function(width) {
                    return [0, -4];
                }

                const galleryContainer = document.createElement("div");
                const uniqueId = `lmm-gallery-${Math.random().toString(36).substring(2, 9)}`;
                galleryContainer.id = uniqueId;

                const folderSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M928 320H488L416 232c-15.1-18.9-38.3-29.9-63.1-29.9H128c-35.3 0-64 28.7-64 64v512c0 35.3 28.7 64 64 64h800c35.3 0 64-28.7 64-64V384c0-35.3-28.7-64-64-64z" fill="#F4D03F"></path></svg>`;
                const videoSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M895.9 203.4H128.1c-35.3 0-64 28.7-64 64v489.2c0 35.3 28.7 64 64 64h767.8c35.3 0 64-28.7 64-64V267.4c0-35.3-28.7-64-64-64zM384 691.2V332.8L668.1 512 384 691.2z" fill="#AED6F1"></path></svg>`;
                const audioSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M768 256H256c-35.3 0-64 28.7-64 64v384c0 35.3 28.7 64 64 64h512c35.3 0 64-28.7 64-64V320c0-35.3-28.7-64-64-64zM512 665.6c-84.8 0-153.6-68.8-153.6-153.6S427.2 358.4 512 358.4s153.6 68.8 153.6 153.6-68.8 153.6-153.6 153.6z" fill="#A9DFBF"></path><path d="M512 409.6c-56.5 0-102.4 45.9-102.4 102.4s45.9 102.4 102.4 102.4 102.4-45.9 102.4-102.4-45.9-102.4-102.4-102.4z" fill="#A9DFBF"></path></svg>`;

                galleryContainer.innerHTML = `
                    <style>
                        #${uniqueId} .lmm-container-wrapper { width: 100%; font-family: sans-serif; color: var(--node-text-color); box-sizing: border-box; display: flex; flex-direction: column; height: 100%; }
                        #${uniqueId} .lmm-controls { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: center; flex-shrink: 0; padding-right: 85px; }
                        #${uniqueId} .lmm-container-wrapper > .lmm-controls:first-child { margin-top: -107px; }
                        #${uniqueId} .lmm-controls label { margin-left: 0px; font-size: 12px; white-space: nowrap; }
                        #${uniqueId} .lmm-controls input, #${uniqueId} .lmm-controls select, #${uniqueId} .lmm-controls button { background-color: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; padding: 4px; font-size: 12px; }
                        #${uniqueId} .lmm-controls input[type=text] { flex-grow: 1; min-width: 150px;}
                        #${uniqueId} .lmm-path-controls { flex-grow: 1; display: flex; gap: 5px; }
                        #${uniqueId} .lmm-path-presets { flex-grow: 1; }
                        #${uniqueId} .lmm-controls button { cursor: pointer; }
                        #${uniqueId} .lmm-controls button:hover { background-color: #444; }
                        #${uniqueId} .lmm-controls button:disabled { background-color: #222; cursor: not-allowed; }
                        #${uniqueId} .lmm-cardholder { position: relative; overflow-y: auto; background: #222; padding: 0 5px; border-radius: 5px; flex-grow: 1; min-height: 100px; width: 100%; transition: opacity 0.2s ease-in-out; }
                        #${uniqueId} .lmm-gallery-card { position: absolute; border: 3px solid transparent; border-radius: 8px; box-sizing: border-box; transition: all 0.3s ease; display: flex; flex-direction: column; background-color: var(--comfy-input-bg); }
                        #${uniqueId} .lmm-gallery-card.lmm-selected { border-color: #00FFC9; }
                        #${uniqueId} .lmm-gallery-card.lmm-edit-selected { border-color: #FFD700; box-shadow: 0 0 10px #FFD700; }
                        #${uniqueId} .lmm-selection-badge {
                            position: absolute;
                            top: 5px;
                            right: 5px;
                            background-color: rgba(0, 255, 201, 0.9);
                            color: #000;
                            font-weight: bold;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 14px;
                            z-index: 1;
                            border: 1px solid #000;
                        }
                        #${uniqueId} .lmm-card-media-wrapper { cursor: pointer; flex-grow: 1; position: relative; display: flex; align-items: center; justify-content: center; min-height: 100px; }
                        #${uniqueId} .lmm-gallery-card img, #${uniqueId} .lmm-gallery-card video { width: 100%; height: auto; border-top-left-radius: 5px; border-top-right-radius: 5px; display: block; }
                        #${uniqueId} .lmm-folder-card, #${uniqueId} .lmm-audio-card { cursor: pointer; background-color: transparent; flex-grow: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
                        #${uniqueId} .lmm-folder-card:hover, #${uniqueId} .lmm-audio-card:hover { background-color: #444; }
                        #${uniqueId} .lmm-folder-icon, #${uniqueId} .lmm-audio-icon { width: 60%; height: 60%; margin-bottom: 8px; }
                        #${uniqueId} .lmm-folder-name, #${uniqueId} .lmm-audio-name { font-size: 12px; word-break: break-all; user-select: none; }
                        #${uniqueId} .lmm-video-card-overlay { position: absolute; top: 5px; left: 5px; width: 24px; height: 24px; opacity: 0.8; pointer-events: none; }
                        #${uniqueId} .lmm-card-info-panel { flex-shrink: 0; background-color: var(--comfy-input-bg); padding: 4px; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px; min-height: 48px; position: relative; }
                        #${uniqueId} .edit-tags-btn { position: absolute; bottom: 4px; right: 4px; width: 22px; height: 22px; background-color: rgba(0,0,0,0.5); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: background-color 0.2s; opacity: 0; cursor: pointer; }
                        #${uniqueId} .lmm-gallery-card:hover .edit-tags-btn { opacity: 1; }
                        #${uniqueId} .edit-tags-btn:hover { background-color: rgba(0,0,0,0.8); }
                        #${uniqueId} .lmm-star-rating { font-size: 16px; cursor: pointer; color: #555; }
                        #${uniqueId} .lmm-star-rating .lmm-star:hover { color: #FFD700 !important; }
                        #${uniqueId} .lmm-star-rating .lmm-star.lmm-rated { color: #FFC700; }
                        #${uniqueId} .lmm-tag-list { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
                        #${uniqueId} .lmm-tag-list .lmm-tag { background-color: #006699; color: #fff; padding: 1px 4px; font-size: 10px; border-radius: 3px; cursor: pointer; }
                        #${uniqueId} .lmm-tag-list .lmm-tag:hover { background-color: #0088CC; }
                        #${uniqueId} .lmm-tag-editor { display: none; flex-wrap: wrap; gap: 5px; background-color: #2a2a2a; padding: 5px; border-radius: 4px; }
                        #${uniqueId} .lmm-tag-editor.lmm-visible { display: flex; }
                        #${uniqueId} .lmm-tag-editor-list { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
                        #${uniqueId} .lmm-tag-editor-list .lmm-tag .lmm-remove-tag { margin-left: 4px; color: #fdd; cursor: pointer; font-weight: bold; }
                        #${uniqueId} .lmm-show-selected-btn.active { background-color: #4A90E2; color: white; border-color: #4A90E2; }
                        #${uniqueId} .lmm-tag-filter-wrapper { display: flex; flex-grow: 1; position: relative; align-items: center; }
                        #${uniqueId} .lmm-tag-filter-wrapper input { flex-grow: 1; }
                        #${uniqueId} .lmm-multiselect-tag { position: relative; flex-grow: 1; }
                        #${uniqueId} .lmm-multiselect-tag-display { 
                            background-color: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; padding: 4px; font-size: 10px;
                            height: 23px; cursor: pointer; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
                        }
                        #${uniqueId} .lmm-multiselect-arrow {
                            position: absolute;
                            right: 8px;
                            top: 50%;
                            transform: translateY(-50%);
                            transition: transform 0.2s ease-in-out;
                            font-size: 10px;
                            pointer-events: none;
                        }
                        #${uniqueId} .lmm-multiselect-arrow.open {
                            transform: translateY(-50%) rotate(180deg);
                        }
                        #${uniqueId} .lmm-multiselect-tag-dropdown {
                            display: none; position: absolute; top: 100%; left: 0; right: 0; background-color: #222;
                            border: 1px solid #555; border-top: none; max-height: 200px; overflow-y: auto; z-index: 10;
                        }
                        #${uniqueId} .lmm-multiselect-tag-dropdown label {
                            display: block; padding: 0px 0px; cursor: pointer; font-size: 12px; color: #ccc;
                        }
                        #${uniqueId} .lmm-multiselect-tag-dropdown label:hover { background-color: #444; }
                        #${uniqueId} .lmm-tag-filter-mode-btn {
                            padding: 4px 8px; background-color: #555; color: #fff; border: 1px solid #666;
                            border-radius: 4px; cursor: pointer; flex-shrink: 0;
                        }                        
                        #${uniqueId} .lmm-clear-tag-filter-button {
                            background: none;
                            display: none;
                        }
                        #${uniqueId} .lmm-tag-filter-wrapper input:not(:placeholder-shown) + .lmm-clear-tag-filter-button {
                            display: block;
                        }                        
                        #${uniqueId} .lmm-cardholder::-webkit-scrollbar { width: 8px; }
                        #${uniqueId} .lmm-cardholder::-webkit-scrollbar-track { background: #2a2a2a; border-radius: 4px; }
                        #${uniqueId} .lmm-cardholder::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
                    </style>
                    <div class="lmm-container-wrapper">
                         <div class="lmm-controls">
                            <button class="lmm-up-button" title="Return to the previous directory" disabled>⬆️ Up</button> 
                            <label>Path:</label>
                            <div class="lmm-path-controls">
                                <input type="text" placeholder="Enter full path to media folder">
                                <select class="lmm-path-presets"></select>
                                <button class="lmm-add-path-button" title="Add current path to presets">➕</button>
                                <button class="lmm-remove-path-button" title="Remove selected preset">➖</button>
                            </div>
                            <button class="lmm-refresh-button">🔄 Refresh</button>
                        </div>
                        <div class="lmm-controls" style="gap: 5px;">
                            <label>Sort by:</label> <select class="lmm-sort-by"> <option value="name">Name</option> <option value="date">Date</option> <option value="rating">Rating</option> </select>
                            <label>Order:</label> <select class="lmm-sort-order"> <option value="asc">Ascending</option> <option value="desc">Descending</option> </select>
                            <div style="margin-left: auto; display: flex; align-items: center; gap: 5px;">
                                <label>Show Videos:</label> <input type="checkbox" class="lmm-show-videos">
                                <label>Show Audio:</label> <input type="checkbox" class="lmm-show-audio">
                                <button class="lmm-show-selected-btn" title="Show all selected items across folders">Show Selected</button>
                            </div>
                        </div>
                        <div class="lmm-controls" style="gap: 5px;">
                            <label>Filter by Tag:</label>
                            <button class="lmm-tag-filter-mode-btn" title="Click to switch filter logic (OR/AND)">OR</button>
                            <div class="lmm-tag-filter-wrapper">
                                <input type="text" class="lmm-tag-filter-input" placeholder="Enter tags, separated by commas...">
                                <button class="lmm-clear-tag-filter-button" title="Clear Tag Filter">✖️</button>
                            </div>
                            <div class="lmm-multiselect-tag">
                                <div class="lmm-multiselect-tag-display">
                                    Select Tags
                                    <span class="lmm-multiselect-arrow">▼</span>
                                </div>
                                <div class="lmm-multiselect-tag-dropdown"></div>
                            </div>
                            <label>Global:</label> <input type="checkbox" class="lmm-global-search">
                        </div>
                        <div class="lmm-controls lmm-tag-editor">
                            <label>Edit Tags (<span class="selected-count">0</span>):</label> 
                            <input type="text" class="lmm-tag-editor-input" placeholder="Add tag and press Enter..." style="flex-grow:1;">
                            <div class="lmm-tag-editor-list"></div>
                        </div>
                        <div class="lmm-cardholder"><p>Enter folder path and click 'Refresh'.</p></div>
                    </div>
                `;
                this.addDOMWidget("local_image_gallery", "div", galleryContainer, {});
                this.size = [800, 670];

                const cardholder = galleryContainer.querySelector(".lmm-cardholder");
                const controls = galleryContainer.querySelector(".lmm-container-wrapper");
                const pathInput = controls.querySelector("input[type='text']");
                const pathPresets = controls.querySelector(".lmm-path-presets");
                const addPathButton = controls.querySelector(".lmm-add-path-button");
                const removePathButton = controls.querySelector(".lmm-remove-path-button");
                const upButton = controls.querySelector(".lmm-up-button");
                const showVideosCheckbox = controls.querySelector(".lmm-show-videos");
                const showAudioCheckbox = controls.querySelector(".lmm-show-audio");
                const tagFilterInput = controls.querySelector(".lmm-tag-filter-input");
                const tagFilterModeBtn = controls.querySelector(".lmm-tag-filter-mode-btn");
                const multiSelectTagContainer = controls.querySelector(".lmm-multiselect-tag");
                const multiSelectTagDisplay = multiSelectTagContainer.querySelector(".lmm-multiselect-tag-display");
                const multiSelectTagDropdown = multiSelectTagContainer.querySelector(".lmm-multiselect-tag-dropdown");
                const globalSearchCheckbox = controls.querySelector(".lmm-global-search");
                const tagEditor = controls.querySelector(".lmm-tag-editor");
                const tagEditorInput = controls.querySelector(".lmm-tag-editor-input");
                const tagEditorList = controls.querySelector(".lmm-tag-editor-list");
                const selectedCountEl = controls.querySelector(".selected-count");
                const showSelectedButton = controls.querySelector(".lmm-show-selected-btn");

                let isLoading = false, currentPage = 1, totalPages = 1, parentDir = null;
                let selection = [];
                let showSelectedMode = false;
                let lastKnownPath = "";
                let selectedCardsForEditing = new Set();

                const debounce = (func, delay) => { let timeoutId; return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => func.apply(this, args), delay); }; };

                const applyMasonryLayout = () => {
                    const minCardWidth = 150, gap = 5, containerWidth = cardholder.clientWidth;
                    if (containerWidth === 0) return;
                    const columnCount = Math.max(1, Math.floor(containerWidth / (minCardWidth + gap)));
                    const totalGapSpace = (columnCount - 1) * gap;
                    const actualCardWidth = (containerWidth - totalGapSpace) / columnCount;
                    const columnHeights = new Array(columnCount).fill(0);
                    const cards = cardholder.querySelectorAll(".lmm-gallery-card");
                    cards.forEach(card => {
                        card.style.width = `${actualCardWidth}px`;
                        const minHeight = Math.min(...columnHeights);
                        const columnIndex = columnHeights.indexOf(minHeight);
                        card.style.left = `${columnIndex * (actualCardWidth + gap)}px`;
                        card.style.top = `${minHeight}px`;
                        columnHeights[columnIndex] += card.offsetHeight + gap;
                    });
                    const newHeight = Math.max(...columnHeights);
                    if (newHeight > 0) cardholder.style.height = `${newHeight}px`;
                };

                const debouncedLayout = debounce(applyMasonryLayout, 20);
                new ResizeObserver(debouncedLayout).observe(cardholder);
                
                async function setUiState(nodeId, state) {
                    const galleryId = this.properties.gallery_unique_id;
                    try {
                        await api.fetchApi("/local_image_gallery/set_ui_state", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ node_id: nodeId, gallery_id: galleryId, state: state }),
                        });
                    } catch(e) { console.error("LocalImageGallery: Failed to set UI state", e); }
                }

                async function updateMetadata(path, { rating, tags }) {
                    try {
                        let payload = { path };
                        if (rating !== undefined) payload.rating = rating;
                        if (tags !== undefined) payload.tags = tags;
                        await api.fetchApi("/local_image_gallery/update_metadata", {
                            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
                        });
                    } catch(e) { console.error("Failed to update metadata:", e); }
                }

                async function savePaths() {
                    const paths = Array.from(pathPresets.options).map(o => o.value);
                    try {
                        await api.fetchApi("/local_image_gallery/save_paths", {
                            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }),
                        });
                    } catch(e) { console.error("Failed to save paths:", e); }
                }

                async function loadAllTags() {
                    try {
                        const response = await api.fetchApi("/local_image_gallery/get_all_tags");
                        const data = await response.json();
                        multiSelectTagDropdown.innerHTML = '';
                        if (data.tags) {
                            data.tags.forEach(tag => {
                                const label = document.createElement('label');
                                const checkbox = document.createElement('input');
                                checkbox.type = 'checkbox';
                                checkbox.value = tag;
                                checkbox.addEventListener('change', handleTagSelectionChange);
                                label.appendChild(checkbox);
                                label.appendChild(document.createTextNode(` ${tag}`));
                                multiSelectTagDropdown.appendChild(label);
                            });
                        }
                    } catch(e) { console.error("Failed to load all tags:", e); }
                }              

                function updateCardTagsUI(card) {
                    const tagListEl = card.querySelector('.lmm-tag-list');
                    if (!tagListEl) return;
                    
                    const tags = card.dataset.tags ? card.dataset.tags.split(',') : [];
                    tagListEl.innerHTML = tags.map(t => `<span class="lmm-tag">${t}</span>`).join('');
                }

                function renderSelectionBadges() {
                    galleryContainer.querySelectorAll('.lmm-selection-badge').forEach(badge => badge.remove());
                    const visibleSelectedCards = Array.from(cardholder.querySelectorAll('.lmm-gallery-card.lmm-selected'));

                    visibleSelectedCards.forEach(card => {
                        const path = card.dataset.path;
                        const index = selection.findIndex(item => item.path === path);
                        if (index > -1) {
                            const badge = document.createElement('div');
                            badge.className = 'lmm-selection-badge';
                            badge.textContent = index;
                            card.querySelector('.lmm-card-media-wrapper').appendChild(badge);
                        }
                    });
                }

                function renderTagEditor() {
                    tagEditorList.innerHTML = "";
                    selectedCountEl.textContent = selectedCardsForEditing.size;

                    if (selectedCardsForEditing.size === 0) {
                        tagEditor.classList.remove("lmm-visible");
                        return;
                    }

                    const allTags = Array.from(selectedCardsForEditing).map(card => {
                        return card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                    });

                    const commonTags = allTags.reduce((acc, tags) => acc.filter(tag => tags.includes(tag)));

                    commonTags.forEach(tag => {
                        const tagEl = document.createElement("span");
                        tagEl.className = "lmm-tag";
                        tagEl.textContent = tag;
                        const removeEl = document.createElement("span");
                        removeEl.className = "lmm-remove-tag";
                        removeEl.textContent = " ⓧ";
                        removeEl.onclick = async (e) => {
                            e.stopPropagation();

                            const updatePromises = Array.from(selectedCardsForEditing).map(async (card) => {
                                const path = card.dataset.path;
                                const tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                                const newTags = tags.filter(t => t !== tag);
                                card.dataset.tags = newTags.join(',');
                                updateCardTagsUI(card);
                                await updateMetadata(path, { tags: newTags });
                            });

                            await Promise.all(updatePromises);
                            await loadAllTags();
                            renderTagEditor();

                            if (tagFilterInput.value.trim()) {
                                saveStateAndReload();
                            }
                        };
                        tagEl.appendChild(removeEl);
                        tagEditorList.appendChild(tagEl);
                    });

                    tagEditor.classList.add("lmm-visible");
                }
                
                const fetchImages = async (page = 1, append = false) => {
                    if (isLoading) return; 
                    isLoading = true;
                    updateShowSelectedButtonUI();

                    if (showSelectedMode) {
                        cardholder.style.opacity = 0; 
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        if (selection.length === 0) {
                            cardholder.innerHTML = "<p>No items selected.</p>";
                            cardholder.style.opacity = 1;
                            isLoading = false;
                            return;
                        }
                        
                        cardholder.innerHTML = "<p>Loading selected items...</p>";
                        currentPage = 1;

                        try {
                            const response = await api.fetchApi("/local_image_gallery/get_selected_items", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ selection: selection }),
                            });

                            if (!response.ok) { 
                                const errorData = await response.json(); 
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`); 
                            }
                            const api_data = await response.json();
                            const items = api_data.items || [];

                            cardholder.innerHTML = "";
                            pathInput.value = "Selected Items";
                            pathInput.disabled = true;
                            upButton.disabled = true;
                            
                            items.forEach(item => {
                                const card = document.createElement("div");
                                card.className = "lmm-gallery-card";
                                card.dataset.path = item.path;
                                card.dataset.type = item.type;
                                card.dataset.tags = item.tags.join(',');
                                card.dataset.rating = item.rating;
                                card.title = item.name;

                                let mediaHTML = "";
                                if (item.type === 'image') {
                                    mediaHTML = `<div class="lmm-card-media-wrapper"><img src="/local_image_gallery/thumbnail?filepath=${encodeURIComponent(item.path)}" loading="lazy"></div>`;
                                } else if (item.type === 'video') {
                                    mediaHTML = `<div class="lmm-card-media-wrapper"><video src="/local_image_gallery/view?filepath=${encodeURIComponent(item.path)}#t=0.1" loop muted playsinline></video><div class="lmm-video-card-overlay">${videoSVG}</div></div>`;
                                } else if (item.type === 'audio') {
                                    mediaHTML = `<div class="lmm-card-media-wrapper"><div class="lmm-audio-card"><div class="lmm-audio-icon">${audioSVG}</div><div class="lmm-audio-name">${item.name}</div></div></div>`;
                                }
                                card.innerHTML = mediaHTML;
                                
                                const infoPanel = document.createElement("div");
                                infoPanel.className = 'lmm-card-info-panel';
                                const stars = Array.from({length: 5}, (_, i) => `<span class="lmm-star" data-value="${i + 1}">☆</span>`).join('');
                                const tags = item.tags.map(t => `<span class="lmm-tag">${t}</span>`).join('');
                                infoPanel.innerHTML = `
                                    <div class="lmm-star-rating">${stars}</div>
                                    <div class="lmm-tag-list">${tags}</div>
                                    <div class="edit-tags-btn">✏️</div> 
                                `;
                                card.appendChild(infoPanel);
                                
                                const editBtn = infoPanel.querySelector(".edit-tags-btn");
                                editBtn.addEventListener("click", (e) => {
                                    e.stopPropagation();
                                    if (e.ctrlKey) {
                                        if (selectedCardsForEditing.has(card)) {
                                            selectedCardsForEditing.delete(card);
                                            card.classList.remove("lmm-edit-selected");
                                        } else {
                                            selectedCardsForEditing.add(card);
                                            card.classList.add("lmm-edit-selected");
                                        }
                                    } else {
                                        if (selectedCardsForEditing.has(card) && selectedCardsForEditing.size === 1) {
                                            selectedCardsForEditing.clear();
                                            card.classList.remove("lmm-edit-selected");
                                        } else {
                                            galleryContainer.querySelectorAll('.lmm-gallery-card.lmm-edit-selected').forEach(c => c.classList.remove("lmm-edit-selected"));
                                            selectedCardsForEditing.clear();
                                            selectedCardsForEditing.add(card);
                                            card.classList.add("lmm-edit-selected");
                                        }
                                    }
                                    renderTagEditor();
                                });
                                
                                cardholder.appendChild(card);
                                const starRating = card.querySelector('.lmm-star-rating');
                                if (starRating) {
                                    const stars = starRating.querySelectorAll('.lmm-star');
                                    const rating = parseInt(item.rating || 0);
                                    stars.forEach((star, index) => {
                                        if (index < rating) {
                                            star.innerHTML = '★';
                                            star.classList.add('lmm-rated');
                                        }
                                    });
                                }
                                const img = card.querySelector("img");
                                if(img) img.onload = debouncedLayout;
                                const video = card.querySelector("video");
                                if(video) video.onloadeddata = debouncedLayout;
                            });
                            
                            cardholder.querySelectorAll('.lmm-gallery-card').forEach(card => card.classList.add('lmm-selected'));
                            renderSelectionBadges();
                            
                        } catch (error) { 
                            cardholder.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`; 
                        } finally { 
                            isLoading = false; 
                            cardholder.style.opacity = 1; 
                            requestAnimationFrame(debouncedLayout);
                        }
                        return;
                    }

                    if (!append) { cardholder.style.opacity = 0; await new Promise(resolve => setTimeout(resolve, 200)); cardholder.innerHTML = "<p>Loading...</p>"; currentPage = 1; }

                    const directory = pathInput.value;
                    const showVideos = showVideosCheckbox.checked;
                    const showAudio = showAudioCheckbox.checked;
                    const filterTag = tagFilterInput.value;
                    const isGlobalSearch = globalSearchCheckbox.checked;
                    const filterMode = tagFilterModeBtn.textContent;

                    if (!directory && !isGlobalSearch) { cardholder.innerHTML = "<p>Enter folder path and click 'Refresh'.</p>"; cardholder.style.opacity = 1; isLoading = false; return; }

                    const sortBy = controls.querySelector(".lmm-sort-by").value;
                    const sortOrder = controls.querySelector(".lmm-sort-order").value;
                    let url = `/local_image_gallery/images?directory=${encodeURIComponent(directory)}&page=${page}&sort_by=${sortBy}&sort_order=${sortOrder}&show_videos=${showVideos}&show_audio=${showAudio}&filter_tag=${encodeURIComponent(filterTag)}&search_mode=${isGlobalSearch ? 'global' : 'local'}&filter_mode=${filterMode}`;

                    if (selection.length > 0) {
                        selection.forEach(item => {
                            url += `&selected_paths=${encodeURIComponent(item.path)}`;
                        });
                    }

                    try {
                        const response = await api.fetchApi(url);
                        if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`); }
                        const api_data = await response.json();
                        const items = api_data.items || [];
                        if (!append) cardholder.innerHTML = "";

                        totalPages = api_data.total_pages; 
                        parentDir = api_data.parent_directory;

                        if (!api_data.is_global_search) {
                            pathInput.value = api_data.current_directory;
                            lastKnownPath = api_data.current_directory;
                            setUiState.call(this, this.id, { last_path: api_data.current_directory });
                        }
                        pathInput.disabled = api_data.is_global_search;
                        upButton.disabled = api_data.is_global_search || !parentDir;

                        items.forEach(item => {
                            const card = document.createElement("div");
                            card.className = "lmm-gallery-card";
                            card.dataset.path = item.path;
                            card.dataset.type = item.type;
                            card.dataset.tags = item.tags.join(',');
                            card.dataset.rating = item.rating;
                            card.title = item.name;

                            let mediaHTML = "";
                            if (item.type === 'dir') {
                                mediaHTML = `<div class="lmm-card-media-wrapper"><div class="lmm-folder-card"><div class="lmm-folder-icon">${folderSVG}</div><div class="lmm-folder-name">${item.name}</div></div></div>`;
                            } else if (item.type === 'image') {
                                mediaHTML = `<div class="lmm-card-media-wrapper"><img src="/local_image_gallery/thumbnail?filepath=${encodeURIComponent(item.path)}" loading="lazy"></div>`;
                            } else if (item.type === 'video') {
                                mediaHTML = `<div class="lmm-card-media-wrapper"><video src="/local_image_gallery/view?filepath=${encodeURIComponent(item.path)}#t=0.1" loop muted playsinline></video><div class="lmm-video-card-overlay">${videoSVG}</div></div>`;
                            } else if (item.type === 'audio') {
                                mediaHTML = `<div class="lmm-card-media-wrapper"><div class="lmm-audio-card"><div class="lmm-audio-icon">${audioSVG}</div><div class="lmm-audio-name">${item.name}</div></div></div>`;
                            }
                            card.innerHTML = mediaHTML;

                            if (item.type !== 'dir') {
                                const infoPanel = document.createElement("div");
                                infoPanel.className = 'lmm-card-info-panel';

                                const stars = Array.from({length: 5}, (_, i) => `<span class="lmm-star" data-value="${i + 1}">☆</span>`).join('');
                                const tags = item.tags.map(t => `<span class="lmm-tag">${t}</span>`).join('');

                                infoPanel.innerHTML = `
                                    <div class="lmm-star-rating">${stars}</div>
                                    <div class="lmm-tag-list">${tags}</div>
                                    <div class="edit-tags-btn">✏️</div> 
                                `;
                                card.appendChild(infoPanel);

                                const editBtn = infoPanel.querySelector(".edit-tags-btn");
                                editBtn.addEventListener("click", (e) => {
                                    e.stopPropagation();

                                    if (e.ctrlKey) {
                                        if (selectedCardsForEditing.has(card)) {
                                            selectedCardsForEditing.delete(card);
                                            card.classList.remove("lmm-edit-selected");
                                        } else {
                                            selectedCardsForEditing.add(card);
                                            card.classList.add("lmm-edit-selected");
                                        }
                                    } else {
                                        if (selectedCardsForEditing.has(card) && selectedCardsForEditing.size === 1) {
                                            selectedCardsForEditing.clear();
                                            card.classList.remove("lmm-edit-selected");
                                        } else {
                                            galleryContainer.querySelectorAll('.lmm-gallery-card.lmm-edit-selected').forEach(c => c.classList.remove("lmm-edit-selected"));
                                            selectedCardsForEditing.clear();
                                            selectedCardsForEditing.add(card);
                                            card.classList.add("lmm-edit-selected");
                                        }
                                    }
                                    renderTagEditor();
                                });

                            } else {

                            }

                            cardholder.appendChild(card);

                            const starRating = card.querySelector('.lmm-star-rating');
                            if (starRating) {
                                const stars = starRating.querySelectorAll('.lmm-star');
                                const rating = parseInt(item.rating || 0);
                                stars.forEach((star, index) => {
                                    if (index < rating) {
                                        star.innerHTML = '★';
                                        star.classList.add('lmm-rated');
                                    }
                                });
                            }
                            const img = card.querySelector("img");
                            if(img) img.onload = debouncedLayout;
                            const video = card.querySelector("video");
                            if(video) video.onloadeddata = debouncedLayout;
                        });
                        if (items.length === 0 && !append) {
                            cardholder.innerHTML = `<p>${api_data.is_global_search ? 'No items found for this tag.' : 'The folder is empty.'}</p>`;
                        }

                        cardholder.querySelectorAll('.lmm-gallery-card').forEach(card => {
                            if (selection.some(item => item.path === card.dataset.path)) {
                                card.classList.add('lmm-selected');
                            }
                        });
                        renderSelectionBadges();

                        requestAnimationFrame(debouncedLayout); 
                        currentPage = page;
                    } catch (error) { cardholder.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`; } 
                    finally { isLoading = false; if (!append) cardholder.style.opacity = 1; }
                };

                cardholder.addEventListener('click', async (event) => {
                    const card = event.target.closest('.lmm-gallery-card');
                    if (!card) return;

                    if (event.target.classList.contains('lmm-star')) {
                        event.stopPropagation();
                        const newRating = parseInt(event.target.dataset.value);
                        const currentRating = parseInt(card.dataset.rating || 0);
                        const finalRating = newRating === currentRating ? 0 : newRating;
                        card.dataset.rating = finalRating;
                        updateMetadata(card.dataset.path, { rating: finalRating });
                        const starRating = card.querySelector('.lmm-star-rating');
                        starRating.querySelectorAll('.lmm-star').forEach((star, index) => {
                            star.innerHTML = index < finalRating ? '★' : '☆';
                            star.classList.toggle('lmm-rated', index < finalRating);
                        });
                        return;
                    }
                    if (event.target.classList.contains('lmm-tag')) {
                        event.stopPropagation();
                        tagFilterInput.value = event.target.textContent;
                        globalSearchCheckbox.checked = true;
                        resetAndReload();
                        return;
                    }

                    const type = card.dataset.type, path = card.dataset.path;

                    if (type === 'dir') {
                        pathInput.value = path;
                        globalSearchCheckbox.checked = false;
                        tagFilterInput.value = "";
                        resetAndReload();
                        return;
                    }

                    if (['image', 'video', 'audio'].includes(type)) {
                        const selectionIndex = selection.findIndex(item => item.path === path);

                        if (event.ctrlKey) {
                            if (selectionIndex > -1) {
                                selection.splice(selectionIndex, 1);
                                card.classList.remove('lmm-selected');
                            } else {
                                selection.push({ path, type });
                                card.classList.add('lmm-selected');
                            }
                        } else {
                            if (selectionIndex > -1 && selection.length === 1) {
                                selection = [];
                                card.classList.remove('lmm-selected');
                            } else {
                                cardholder.querySelectorAll('.lmm-gallery-card.lmm-selected').forEach(c => c.classList.remove('lmm-selected'));
                                selection = [{ path, type }];
                                card.classList.add('lmm-selected');
                            }
                        }

                        renderSelectionBadges();

                        setUiState.call(this, this.id, { selection: selection });
                        const galleryId = this.properties.gallery_unique_id;

                        try { 
                            await api.fetchApi("/local_image_gallery/set_node_selection", { 
                                method: "POST", 
                                headers: { "Content-Type": "application/json" }, 
                                body: JSON.stringify({ node_id: this.id, gallery_id: galleryId, selections: selection }), 
                            });
                        } catch(e) { console.error("An error occurred while sending data to the backend:", e); }
                    }
                });

                cardholder.addEventListener('dblclick', (event) => {
                    const card = event.target.closest('.lmm-gallery-card');
                    if (!card || !['image', 'video', 'audio'].includes(card.dataset.type)) return;
                    
                    const allMediaCards = Array.from(cardholder.querySelectorAll(".lmm-gallery-card[data-type='image'], .lmm-gallery-card[data-type='video'], .lmm-gallery-card[data-type='audio']"));
                    const currentMediaList = allMediaCards.map(c => ({ path: c.dataset.path, type: c.dataset.type }));
                    const clickedPath = card.dataset.path;
                    const startIndex = currentMediaList.findIndex(item => item.path === clickedPath);

                    if (startIndex !== -1) {
                        showMediaAtIndex(startIndex, currentMediaList);
                    }
                });

                const lightbox = document.getElementById('global-image-lightbox');
                const lightboxImg = lightbox.querySelector("img");
                const lightboxVideo = lightbox.querySelector("video");
                const lightboxAudio = lightbox.querySelector("audio");
                const prevButton = lightbox.querySelector(".lightbox-prev");
                const nextButton = lightbox.querySelector(".lightbox-next");
                let scale = 1, panning = false, pointX = 0, pointY = 0, start = { x: 0, y: 0 };
                let lightboxMediaList = [];
                let lightboxCurrentIndex = -1;

                function setTransform() { lightboxImg.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; }
                function resetLightboxState() { scale = 1; pointX = 0; pointY = 0; setTransform(); }

                function showMediaAtIndex(index, mediaList) {
                    lightboxMediaList = mediaList;
                    if (index < 0 || index >= lightboxMediaList.length) return;
                    lightboxCurrentIndex = index;
                    const media = lightboxMediaList[index];
                    
                    resetLightboxState();
                    lightbox.style.display = 'flex';
                    
                    const dimensionsEl = lightbox.querySelector(".lightbox-dimensions");
                    lightboxImg.style.display = 'none';
                    lightboxVideo.style.display = 'none';
                    lightboxAudio.style.display = 'none';
                    dimensionsEl.style.display = 'none';
                    lightboxVideo.pause();
                    lightboxAudio.pause();

                    if (media.type === 'image') {
                        lightboxImg.style.display = 'block';
                        lightboxImg.src = `/local_image_gallery/view?filepath=${encodeURIComponent(media.path)}`;
                        lightboxImg.onload = () => {
                            dimensionsEl.textContent = `${lightboxImg.naturalWidth} x ${lightboxImg.naturalHeight}`;
                            dimensionsEl.style.display = 'block';
                        };
                    } else if (media.type === 'video') {
                        lightboxVideo.style.display = 'block';
                        lightboxVideo.src = `/local_image_gallery/view?filepath=${encodeURIComponent(media.path)}`;
                    } else if (media.type === 'audio') {
                        lightboxAudio.style.display = 'block';
                        lightboxAudio.src = `/local_image_gallery/view?filepath=${encodeURIComponent(media.path)}`;
                    }

                    prevButton.disabled = lightboxCurrentIndex === 0;
                    nextButton.disabled = lightboxCurrentIndex === lightboxMediaList.length - 1;
                }

                prevButton.addEventListener('click', () => showMediaAtIndex(lightboxCurrentIndex - 1, lightboxMediaList));
                nextButton.addEventListener('click', () => showMediaAtIndex(lightboxCurrentIndex + 1, lightboxMediaList));
                
                lightboxImg.addEventListener('mousedown', (e) => { e.preventDefault(); panning = true; lightboxImg.classList.add('panning'); start = { x: e.clientX - pointX, y: e.clientY - pointY }; });
                window.addEventListener('mouseup', () => { panning = false; lightboxImg.classList.remove('panning'); });
                window.addEventListener('mousemove', (e) => { if (!panning) return; e.preventDefault(); pointX = e.clientX - start.x; pointY = e.clientY - start.y; setTransform(); });
                lightbox.addEventListener('wheel', (e) => {
                    if (lightboxImg.style.display !== 'block') return;
                    e.preventDefault(); const rect = lightboxImg.getBoundingClientRect(); const delta = -e.deltaY; const oldScale = scale; scale *= (delta > 0 ? 1.1 : 1 / 1.1); scale = Math.max(0.2, scale); pointX = (1 - scale / oldScale) * (e.clientX - rect.left) + pointX; pointY = (1 - scale / oldScale) * (e.clientY - rect.top) + pointY; setTransform(); 
                });

                const closeLightbox = () => { 
                    lightbox.style.display = 'none'; 
                    lightboxImg.src = ""; 
                    lightboxVideo.pause(); lightboxVideo.src = "";
                    lightboxAudio.pause(); lightboxAudio.src = "";
                };
                lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
                lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
                
                window.addEventListener('keydown', (e) => {
                    if (lightbox.style.display !== 'flex') return;
                    if (e.key === 'ArrowLeft') { e.preventDefault(); prevButton.click(); } 
                    else if (e.key === 'ArrowRight') { e.preventDefault(); nextButton.click(); } 
                    else if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
                });

                const saveCurrentControlsState = () => {
                    const sortBy = controls.querySelector(".lmm-sort-by");
                    const sortOrder = controls.querySelector(".lmm-sort-order");

                    const state = {
                        sort_by: sortBy.value,
                        sort_order: sortOrder.value,
                        show_videos: showVideosCheckbox.checked,
                        show_audio: showAudioCheckbox.checked,
                        filter_tag: tagFilterInput.value,
                        global_search: globalSearchCheckbox.checked,
                        show_selected_mode: showSelectedMode,
                    };
                    setUiState.call(this, this.id, state);
                };

                const handleTagSelectionChange = () => {
                    const selectedTags = Array.from(multiSelectTagDropdown.querySelectorAll('input:checked')).map(cb => cb.value);
                    tagFilterInput.value = selectedTags.join(',');

                    saveStateAndReload();
                };

                const saveStateAndReload = () => {
                    saveCurrentControlsState();
                    resetAndReload();
                };

                const resetAndReload = () => { fetchImages.call(this, 1, false); };
                controls.querySelector('.lmm-refresh-button').onclick = saveStateAndReload;
                tagFilterInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveStateAndReload(); });
                tagEditorInput.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter' && selectedCardsForEditing.size > 0) {
                        e.preventDefault();
                        const newTag = tagEditorInput.value.trim();
                        if (newTag) {
                            const updatePromises = Array.from(selectedCardsForEditing).map(async (card) => {
                                const path = card.dataset.path;
                                let tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                                if (!tags.includes(newTag)) {
                                    tags.push(newTag);
                                    card.dataset.tags = tags.join(',');
                                    updateCardTagsUI(card);
                                    await updateMetadata(path, { tags });
                                }
                            });

                            await Promise.all(updatePromises);
                            await loadAllTags();
                            renderTagEditor();
                            tagEditorInput.value = "";
                        }
                    }
                });
                
                controls.querySelectorAll('select').forEach(select => { select.addEventListener('change', saveStateAndReload); });
                showVideosCheckbox.addEventListener('change', saveStateAndReload);
                showAudioCheckbox.addEventListener('change', saveStateAndReload);
                globalSearchCheckbox.addEventListener('change', saveStateAndReload);

                addPathButton.addEventListener('click', () => {
                    const currentPath = pathInput.value.trim();
                    if (currentPath) {
                        const exists = Array.from(pathPresets.options).some(o => o.value === currentPath);
                        if (!exists) {
                            const option = new Option(currentPath, currentPath);
                            pathPresets.add(option);
                            savePaths();
                        }
                    }
                });
                
                removePathButton.addEventListener('click', () => {
                    if (pathPresets.selectedIndex > -1) {
                        pathPresets.remove(pathPresets.selectedIndex);
                        savePaths();
                    }
                });
                
                pathPresets.addEventListener('change', () => {
                    if (pathPresets.value) {
                        pathInput.value = pathPresets.value;
                        saveStateAndReload();
                    }
                });

                const arrow = multiSelectTagContainer.querySelector('.lmm-multiselect-arrow');
                multiSelectTagDisplay.addEventListener('click', () => {
                    const isVisible = multiSelectTagDropdown.style.display === 'block';
                    multiSelectTagDropdown.style.display = isVisible ? 'none' : 'block';
                    arrow.classList.toggle('open', !isVisible);
                });

                document.addEventListener('click', (e) => {
                    if (!multiSelectTagContainer.contains(e.target)) {
                        multiSelectTagDropdown.style.display = 'none';
                        arrow.classList.remove('open');
                    }
                });

                upButton.onclick = () => { if(parentDir){ pathInput.value = parentDir; globalSearchCheckbox.checked = false; tagFilterInput.value = ""; resetAndReload(); } };

                tagFilterModeBtn.addEventListener('click', () => {
                    if (tagFilterModeBtn.textContent === 'OR') {
                        tagFilterModeBtn.textContent = 'AND';
                        tagFilterModeBtn.style.backgroundColor = "#D97706";
                    } else {
                        tagFilterModeBtn.textContent = 'OR';
                        tagFilterModeBtn.style.backgroundColor = "#555";
                    }
                    saveStateAndReload();
                });

                const updateShowSelectedButtonUI = () => {
                    if (showSelectedMode) {
                        showSelectedButton.classList.add('active');
                        showSelectedButton.textContent = `Show Folder (${selection.length})`;
                        showSelectedButton.title = "Return to the current folder view";
                    } else {
                        showSelectedButton.classList.remove('active');
                        showSelectedButton.textContent = "Show Selected";
                        showSelectedButton.title = "Show all selected items across folders";
                    }
                };

                showSelectedButton.addEventListener('click', () => {
                    showSelectedMode = !showSelectedMode;
                    if (!showSelectedMode) {
                        pathInput.value = lastKnownPath;
                    }
                    saveStateAndReload();
                });

                cardholder.onscroll = () => { if (cardholder.scrollTop + cardholder.clientHeight >= cardholder.scrollHeight - 300 && !isLoading && currentPage < totalPages) { fetchImages.call(this, currentPage + 1, true); } };

                const clearTagFilterButton = controls.querySelector(".lmm-clear-tag-filter-button");
                clearTagFilterButton.addEventListener("click", () => {
                    tagFilterInput.value = "";

                    const checkboxes = multiSelectTagDropdown.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        cb.checked = false;
                    });

                    saveStateAndReload();
                });

                document.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        if (selectedCardsForEditing.size > 0) {
                            galleryContainer.querySelectorAll('.lmm-gallery-card.lmm-edit-selected').forEach(c => c.classList.remove("lmm-edit-selected"));
                            selectedCardsForEditing.clear();
                            renderTagEditor();
                        }
                    }
                });                

                const initializeNode = async () => {
                    try {
                        const galleryId = this.properties.gallery_unique_id;
                        const response = await api.fetchApi(`/local_image_gallery/get_ui_state?node_id=${this.id}&gallery_id=${galleryId}`);
                        const state = await response.json();
                        if (state) {
                            controls.querySelector(".lmm-sort-by").value = state.sort_by;
                            controls.querySelector(".lmm-sort-order").value = state.sort_order;
                            showVideosCheckbox.checked = state.show_videos;
                            showAudioCheckbox.checked = state.show_audio;
                            tagFilterInput.value = state.filter_tag;
                            globalSearchCheckbox.checked = state.global_search;
                            showSelectedMode = state.show_selected_mode || false;

                            selection = state.selection || [];

                            if (state.last_path) {
                                pathInput.value = state.last_path;
                                lastKnownPath = state.last_path;
                            }

                            resetAndReload();
                        }
                    } catch (e) { 
                        console.error("LocalImageGallery: Unable to load the UI state:", e); 

                        resetAndReload();
                    }
                };
                
                const loadSavedPaths = async () => {
                    try {
                        const response = await api.fetchApi("/local_image_gallery/get_saved_paths");
                        const data = await response.json();
                        pathPresets.innerHTML = '<option value="" disabled selected>Select a common path</option>';
                        if (data.saved_paths) {
                            data.saved_paths.forEach(p => {
                                if (p) {
                                    const option = new Option(p, p);
                                    pathPresets.add(option);
                                }
                            });
                        }
                    } catch (e) { console.error("Unable to load saved paths:", e); }
                };

                setTimeout(() => initializeNode.call(this), 1);
                loadSavedPaths();
                loadAllTags();

                this.onResize = function(size) {
                    const minHeight = 470;
                    const minWidth = 700;
                    if (size[1] < minHeight) size[1] = minHeight;
                    if (size[0] < minWidth) size[0] = minWidth;
                };
                
                return r;
            };
        }
    },
});