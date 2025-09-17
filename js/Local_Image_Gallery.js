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
                galleryIdWidget.draw = function(ctx, node, widget_width, y, widget_height) {};
                galleryIdWidget.computeSize = function(width) {
                    return [0, -4];
                };
                
                const selectionWidget = this.addWidget(
                    "text",
                    "selection",
                    this.properties.selection || "[]",
                    () => {},
                    { multiline: true }
                );
                selectionWidget.serializeValue = () => {
                    return node_instance.properties["selection"] || "[]";
                };
                selectionWidget.draw = function(ctx, node, widget_width, y, widget_height) {};
                selectionWidget.computeSize = function(width) { return [0, -4]; };
                
                const galleryContainer = document.createElement("div");
                const uniqueId = `lmm-gallery-${Math.random().toString(36).substring(2, 9)}`;
                galleryContainer.id = uniqueId;
                
                const folderSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M928 320H488L416 232c-15.1-18.9-38.3-29.9-63.1-29.9H128c-35.3 0-64 28.7-64 64v512c0 35.3 28.7 64 64 64h800c35.3 0 64-28.7 64-64V384c0-35.3-28.7-64-64-64z" fill="#F4D03F"></path></svg>`;
                const videoSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M895.9 203.4H128.1c-35.3 0-64 28.7-64 64v489.2c0 35.3 28.7 64 64 64h767.8c35.3 0 64-28.7 64-64V267.4c0-35.3-28.7-64-64-64zM384 691.2V332.8L668.1 512 384 691.2z" fill="#FFD700"></path></svg>`;
                const audioSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="M768 256H256c-35.3 0-64 28.7-64 64v384c0 35.3 28.7 64 64 64h512c35.3 0 64-28.7 64-64V320c0-35.3-28.7-64-64-64zM512 665.6c-84.8 0-153.6-68.8-153.6-153.6S427.2 358.4 512 358.4s153.6 68.8 153.6 153.6-68.8 153.6-153.6 153.6z" fill="#A9DFBF"></path><path d="M512 409.6c-56.5 0-102.4 45.9-102.4 102.4s45.9 102.4 102.4 102.4 102.4-45.9 102.4-102.4-45.9-102.4-102.4-102.4z" fill="#A9DFBF"></path></svg>`;
                
                galleryContainer.innerHTML = `
                    <style>
                        #${uniqueId} .lmm-container-wrapper { width: 100%; font-family: sans-serif; color: var(--node-text-color); box-sizing: border-box; display: flex; flex-direction: column; height: 100%; }
                        #${uniqueId} .lmm-controls { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: center; flex-shrink: 0; padding-right: 60px; }
                        #${uniqueId} .lmm-container-wrapper > .lmm-controls:first-child { margin-top: -90px; }
                        #${uniqueId} .lmm-controls label { margin-left: 0px; font-size: 12px; white-space: nowrap; }
                        #${uniqueId} .lmm-controls input, #${uniqueId} .lmm-controls select, #${uniqueId} .lmm-controls button { background-color: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; padding: 4px; font-size: 12px; }
                        #${uniqueId} .lmm-path-controls input[type=text] { width: 100%; box-sizing: border-box; }
                        #${uniqueId} .lmm-controls button { cursor: pointer; }
                        #${uniqueId} .lmm-controls button:hover { background-color: #444; }
                        #${uniqueId} .lmm-controls button:disabled { background-color: #222; cursor: not-allowed; }
                        
                        #${uniqueId} .lmm-top-bar { flex-wrap: nowrap; }
                        #${uniqueId} .lmm-top-bar > button, #${uniqueId} .lmm-top-bar > label { flex-shrink: 0; }
                        
                        #${uniqueId} .lmm-path-controls { flex-grow: 1; display: flex; gap: 5px; align-items: center; min-width: 0; }
                        #${uniqueId} .lmm-path-presets { flex-shrink: 0; }
                        #${uniqueId} .lmm-add-path-button { flex-shrink: 0; }
                        #${uniqueId} .lmm-remove-path-button { flex-shrink: 0; }
                        
                        #${uniqueId} .lmm-breadcrumb-container { flex-grow: 1; flex-shrink: 1; min-width: 100px; background-color: #333; border: 1px solid #555; border-radius: 4px; padding: 4px; font-size: 12px; height: 25px; display: flex; align-items: center; overflow: hidden; }
                        #${uniqueId} .lmm-breadcrumb { display: flex; align-items: center; white-space: nowrap; overflow: hidden; cursor: text; width: 100%; height:100%; }
                        #${uniqueId} .lmm-breadcrumb-item { color: #ccc; cursor: pointer; padding: 0 4px; }
                        #${uniqueId} .lmm-breadcrumb-item:hover { color: #fff; background-color: #444; }
                        #${uniqueId} .lmm-breadcrumb-separator { color: #888; margin: 0 2px; user-select: none; }
                        #${uniqueId} .lmm-breadcrumb-ellipsis { color: #888; padding: 0 4px; user-select: none; font-weight: bold; }
                        
                        #${uniqueId} .lmm-cardholder { position: relative; overflow-y: auto; background: #222; padding: 0; border-radius: 5px; flex-grow: 1; min-height: 100px; width: 100%; transition: opacity 0.2s ease-in-out; }
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
                        }
                        
                        #${uniqueId} .lmm-card-media-wrapper { cursor: pointer; flex-grow: 1; position: relative; display: flex; align-items: center; justify-content: center; min-height: 100px; }
                        #${uniqueId} .lmm-gallery-card img, #${uniqueId} .lmm-gallery-card video { width: 100%; height: auto; border-top-left-radius: 5px; border-top-right-radius: 5px; display: block; }
                        #${uniqueId} .lmm-folder-card, #${uniqueId} .lmm-audio-card { cursor: pointer; background-color: transparent; flex-grow: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
                        #${uniqueId} .lmm-folder-card:hover, #${uniqueId} .lmm-audio-card:hover { background-color: #444; }
                        #${uniqueId} .lmm-folder-icon, #${uniqueId} .lmm-audio-icon { width: 60%; height: 60%; margin-bottom: 8px; }
                        #${uniqueId} .lmm-folder-name, #${uniqueId} .lmm-audio-name {
                            font-size: 12px;
                            word-break: break-all;
                            user-select: none;
                            line-height: 1.4;
                            max-height: 33.6px; /* 1.4 * 12px * 2 lines */
                            overflow: hidden;
                            text-overflow: ellipsis;
                            display: -webkit-box;
                            -webkit-line-clamp: 2; /* Limit to a maximum of 2 lines */
                            -webkit-box-orient: vertical;
                        }
                        #${uniqueId} .lmm-video-card-overlay { position: absolute; top: 5px; left: 5px; width: 24px; height: 24px; opacity: 0.8; pointer-events: none; }
                        
                        #${uniqueId} .lmm-card-info-panel { 
                            flex-shrink: 0; background-color: var(--comfy-input-bg); 
                            padding: 4px; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px; 
                            min-height: 48px; position: relative;
                            display: flex; flex-direction: column; align-items: flex-start;
                            box-sizing: border-box;
                        }
                        
                        #${uniqueId} .lmm-info-top-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            margin-bottom: 4px;
                        }
                        
                        #${uniqueId} .lmm-workflow-text-badge {
                            font-size: 10px;
                            font-weight: bold;
                            color: #FFD700; /* Gold color */
                            background-color: rgba(0,0,0,0.4);
                            padding: 2px 5px;
                            border-radius: 4px;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        }
                        #${uniqueId} .lmm-workflow-text-badge:hover {
                            background-color: rgba(80,80,80,0.6);
                        }
                        
                        #${uniqueId} .edit-tags-btn { position: absolute; bottom: 4px; right: 4px; width: 22px; height: 22px; background-color: rgba(0,0,0,0.5); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: background-color 0.2s; opacity: 0; cursor: pointer; }
                        #${uniqueId} .lmm-gallery-card:hover .edit-tags-btn { opacity: 1; }
                        #${uniqueId} .edit-tags-btn:hover { background-color: rgba(0,0,0,0.8); }
                        #${uniqueId} .lmm-star-rating { font-size: 16px; cursor: pointer; color: #555; }
                        #${uniqueId} .lmm-star-rating .lmm-star:hover { color: #FFD700 !important; }
                        #${uniqueId} .lmm-star-rating .lmm-star.lmm-rated { color: #FFC700; }
                        #${uniqueId} .lmm-tag-list { display: flex; flex-wrap: wrap; gap: 3px; }
                        #${uniqueId} .lmm-tag-list .lmm-tag { background-color: #006699; color: #fff; padding: 1px 4px; font-size: 10px; border-radius: 3px; cursor: pointer; }
                        #${uniqueId} .lmm-tag-list .lmm-tag:hover { background-color: #0088CC; }
                        #${uniqueId} .lmm-tag-editor { display: none; flex-wrap: wrap; gap: 5px; background-color: #2a2a2a; padding: 5px; border-radius: 4px; }
                        #${uniqueId} .lmm-rename-container { display: none; width: 100%; align-items: center; gap: 5px; margin-top: 5px; }
                        #${uniqueId} .lmm-rename-container input { flex-grow: 1; background-color: #333; }
                        #${uniqueId} .lmm-rename-container button { flex-shrink: 0; }
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
                        #${uniqueId} .lmm-batch-action-btn { padding: 4px 8px; }
                        #${uniqueId} .lmm-batch-action-btn:disabled { background-color: #333; color: #555; cursor: not-allowed; }
                        #${uniqueId} .lmm-batch-delete-btn:not(:disabled):hover { background-color: #C0392B; }
                        #${uniqueId} .lmm-batch-move-btn:not(:disabled):hover { background-color: #2980B9; }
                        #${uniqueId} .lmm-batch-select-all-btn:not(:disabled):hover { background-color: #2980B9; }
                        #${uniqueId} .lmm-gallery-placeholder { position: absolute; top: 10px; left: 10px; color: #666; }
                    </style>
                    <div class="lmm-container-wrapper">
                         <div class="lmm-controls lmm-top-bar">
                            <button class="lmm-up-button" title="Return to the previous directory" disabled>⬆️ Up</button>
                            <label>Path:</label>
                            <div class="lmm-path-controls">
                                 <div class="lmm-breadcrumb-container">
                                    <div class="lmm-breadcrumb"></div>
                                    <input type="text" placeholder="Enter full path and press Enter" style="display: none;">
                                </div>
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
                                <label>Images:</label> <input type="checkbox" class="lmm-show-images" checked>
                                <label>Videos:</label> <input type="checkbox" class="lmm-show-videos">
                                <label>Audio:</label> <input type="checkbox" class="lmm-show-audio">
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
                            <div style="margin-left: auto; display: flex; gap: 5px;">
                                <button class="lmm-batch-action-btn lmm-batch-select-all-btn" title="Select All Files in Current View">All</button>
                                <button class="lmm-batch-action-btn lmm-batch-move-btn" title="Move Selected Files" disabled>➔ Move</button>
                                <button class="lmm-batch-action-btn lmm-batch-delete-btn" title="Delete Selected Files" disabled>🗑️ Delete</button>
                            </div>
                        </div>
                        <div class="lmm-controls lmm-tag-editor">
                            <label>Edit Tags (<span class="selected-count">0</span>):</label>
                            <input type="text" class="lmm-tag-editor-input" placeholder="Add tag and press Enter..." style="flex-grow:1;">
                            <div class="lmm-tag-editor-list"></div>
                            <div class="lmm-rename-container">
                                <label>Rename:</label>
                                <input type="text" class="lmm-rename-input" placeholder="Enter new filename...">
                                <button class="lmm-rename-btn">✔️</button>
                            </div>
                            </div>
                        <div class="lmm-cardholder">
                            <div class="lmm-gallery-placeholder">Enter folder path and click 'Refresh'.</div>
                        </div>
                    </div>
                `;
                this.addDOMWidget("local_image_gallery", "div", galleryContainer, {});
                this.size = [800, 670];
                
                const cardholder = galleryContainer.querySelector(".lmm-cardholder");
                const controls = galleryContainer.querySelector(".lmm-container-wrapper");
                const placeholder = galleryContainer.querySelector(".lmm-gallery-placeholder");
                
                const breadcrumbContainer = controls.querySelector(".lmm-breadcrumb-container");
                const breadcrumbEl = breadcrumbContainer.querySelector(".lmm-breadcrumb");
                const pathInput = breadcrumbContainer.querySelector("input[type='text']");
                
                const pathPresets = controls.querySelector(".lmm-path-presets");
                const addPathButton = controls.querySelector(".lmm-add-path-button");
                const removePathButton = controls.querySelector(".lmm-remove-path-button");
                const upButton = controls.querySelector(".lmm-up-button");
                const showImagesCheckbox = controls.querySelector(".lmm-show-images");
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
                const batchSelectAllBtn = controls.querySelector(".lmm-batch-select-all-btn");
                const batchDeleteBtn = controls.querySelector(".lmm-batch-delete-btn");
                const batchMoveBtn = controls.querySelector(".lmm-batch-move-btn");
                const renameContainer = controls.querySelector(".lmm-rename-container");
                const renameInput = controls.querySelector(".lmm-rename-input");
                const renameBtn = controls.querySelector(".lmm-rename-btn");
                
                const renderBreadcrumb = (path) => {
                    breadcrumbEl.innerHTML = '';
                    if (!path || path === "Selected Items" || path === "Global Search") {
                        const staticItem = document.createElement('span');
                        staticItem.textContent = path || "Enter a path...";
                        staticItem.style.paddingLeft = '4px';
                        breadcrumbEl.appendChild(staticItem);
                        return;
                    }
                    
                    path = path.replace(/\\/g, '/');
                    const parts = path.split('/').filter(p => p);
                    
                    let builtPath = '';
                    const elements = [];
                    
                    if (path.match(/^[a-zA-Z]:\//)) {
                        const drive = parts.shift();
                        builtPath = drive + '/';
                        const driveEl = document.createElement('span');
                        driveEl.className = 'lmm-breadcrumb-item';
                        driveEl.textContent = drive;
                        driveEl.dataset.path = builtPath;
                        elements.push(driveEl);
                    } else if (path.startsWith('/')) {
                        builtPath = '/';
                        const rootEl = document.createElement('span');
                        rootEl.className = 'lmm-breadcrumb-item';
                        rootEl.textContent = '/';
                        rootEl.dataset.path = builtPath;
                        elements.push(rootEl);
                    }
                    
                    parts.forEach((part, index) => {
                        const separator = document.createElement('span');
                        separator.className = 'lmm-breadcrumb-separator';
                        separator.textContent = '>';
                        elements.push(separator);
                        
                        let currentPartPath = builtPath + part + '/';
                        builtPath = currentPartPath;
                        
                        const partEl = document.createElement('span');
                        partEl.className = 'lmm-breadcrumb-item';
                        partEl.textContent = part;
                        partEl.dataset.path = currentPartPath;
                        elements.push(partEl);
                    });
                    
                    breadcrumbEl.append(...elements);
                    
                    requestAnimationFrame(() => {
                        const containerWidth = breadcrumbEl.clientWidth;
                        let currentWidth = 0;
                        elements.forEach(el => currentWidth += el.offsetWidth);
                        
                        if (currentWidth > containerWidth) {
                            const toRemove = [];
                            let removableWidth = currentWidth - containerWidth;
                            
                            for (let i = elements.length - 3; i > 1; i--) {
                               const el = elements[i];
                                if (removableWidth > 0 && !(el.classList.contains('lmm-breadcrumb-item') && i === elements.length - 1)) {
                                     removableWidth -= el.offsetWidth;
                                     toRemove.push(el);
                                } else {
                                     break;
                                }
                            }
                            
                            if (toRemove.length > 0) {
                                const ellipsis = document.createElement('span');
                                ellipsis.className = 'lmm-breadcrumb-ellipsis';
                                ellipsis.textContent = '...';
                                if(elements[1]) { 
                                    elements[1].insertAdjacentElement('afterend', ellipsis);
                                    const nextSeparator = elements[1].nextElementSibling.nextElementSibling;
                                    if(nextSeparator && nextSeparator.classList.contains('lmm-breadcrumb-separator')) {
                                        nextSeparator.remove();
                                    }
                                }
                                toRemove.forEach(el => el.remove());
                            }
                        }
                    });
                    
                };
                
                breadcrumbEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.classList.contains('lmm-breadcrumb-item')) {
                        const newPath = e.target.dataset.path;
                        pathInput.value = newPath;
                        saveStateAndReload(false);
                        pathPresets.selectedIndex = 0;
                    } else {
                        breadcrumbEl.style.display = 'none';
                        pathInput.style.display = 'block';
                        pathInput.value = lastKnownPath;
                        pathInput.focus();
                        pathInput.select();
                    }
                });
                
                const switchToBreadcrumb = (forceReload = true) => {
                    pathInput.style.display = 'none';
                    breadcrumbEl.style.display = 'flex';
                    const currentPath = pathInput.value.trim();
                    if(forceReload && lastKnownPath !== currentPath) {
                       lastKnownPath = currentPath;
                       saveStateAndReload(true);
                    } else {
                       renderBreadcrumb(currentPath);
                    }
                };
                
                pathInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        switchToBreadcrumb();
                        e.preventDefault();
                    } else if (e.key === 'Escape') {
                        pathInput.value = lastKnownPath;
                        switchToBreadcrumb(false);
                        e.preventDefault();
                    }
                });
                
                pathInput.addEventListener('blur', () => {
                   switchToBreadcrumb();
                });
                
                const updateBatchActionButtonsState = () => {
                    const hasSelection = selection.length > 0;
                    batchDeleteBtn.disabled = !hasSelection;
                    batchMoveBtn.disabled = !hasSelection;
                };
                
                let isLoading = false, currentPage = 1, totalPages = 1, parentDir = null;
                let selection = [];
                let showSelectedMode = false;
                let lastKnownPath = "";
                let selectedCardsForEditing = new Set();
                
                let allItems = []; 
                let layoutData = [];
                const VIRTUAL_SCROLL_PADDING = 500;
                let columnCount = 0;
                let actualCardWidth = 0;
                
                const debounce = (func, delay) => { let timeoutId; return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => func.apply(this, args), delay); }; };
                
                const calculateFullLayout = () => {
                    const minCardWidth = 150, gap = 5, containerWidth = cardholder.clientWidth;
                    if (containerWidth === 0 || allItems.length === 0) {
                        cardholder.style.height = '0px';
                        layoutData = [];
                        return;
                    }
                    
                    placeholder.style.display = 'none';
                    
                    columnCount = Math.max(1, Math.floor(containerWidth / (minCardWidth + gap)));
                    const totalGapSpace = (columnCount - 1) * gap;
                    actualCardWidth = (containerWidth - totalGapSpace) / columnCount;
                    const columnHeights = new Array(columnCount).fill(0);

                    const measuringDivId = `lmm-measuring-div-${uniqueId}`;
                    let measuringDiv = galleryContainer.querySelector(`#${measuringDivId}`);
                    if (!measuringDiv) {
                        measuringDiv = document.createElement("div");
                        measuringDiv.id = measuringDivId;
                        measuringDiv.style.position = "absolute";
                        measuringDiv.style.left = "-9999px";
                        measuringDiv.style.visibility = "hidden";
                        measuringDiv.style.pointerEvents = "none";
                        galleryContainer.appendChild(measuringDiv);
                    }

                    layoutData = allItems.map((item, index) => {
                        let aspectRatio = item.aspectRatio || 1.0; 

                        if (!isFinite(aspectRatio) || aspectRatio <= 0) {
                            aspectRatio = 1.0;
                        }
                        
                        let imagePartHeight = actualCardWidth / aspectRatio;
                        
                        if (item.type === 'image' || item.type === 'video') {
                            imagePartHeight = Math.max(imagePartHeight, 100); 

                            const tags = item.tags.map(t => `<span class="lmm-tag">${t}</span>`).join('');
                            const workflowTextBadge = item.has_workflow ? `<div class="lmm-workflow-text-badge">Workflow</div>` : '';
                            const stars = Array.from({ length: 5 }, (_, i) => `<span class="lmm-star">☆</span>`).join('');

                            const infoPanelHTML = `
                                <div class="lmm-card-info-panel" style="width: ${actualCardWidth}px;">
                                    <div class="lmm-info-top-row">
                                        <div class="lmm-star-rating">${stars}</div>
                                        ${workflowTextBadge}
                                    </div>
                                    <div class="lmm-tag-list">${tags}</div>
                                </div>
                            `;
                            measuringDiv.innerHTML = infoPanelHTML;
                            
                            const infoPanelHeight = measuringDiv.querySelector('.lmm-card-info-panel').offsetHeight + 2;
                            var cardHeight = imagePartHeight + infoPanelHeight;
                        } else {
                            var cardHeight = 150; 
                        }
                        
                        const minHeight = Math.min(...columnHeights);
                        const columnIndex = columnHeights.indexOf(minHeight);
                        
                        const position = {
                            left: columnIndex * (actualCardWidth + gap),
                            top: minHeight,
                            width: actualCardWidth,
                            height: cardHeight,
                            columnIndex: columnIndex
                        };
                        
                        columnHeights[columnIndex] += cardHeight + gap;
                        return position;
                    });
                    
                    measuringDiv.innerHTML = "";
                    
                    const totalHeight = Math.max(...columnHeights);
                    cardholder.style.height = `${totalHeight}px`;
                    
                    updateVisibleItemsAndRender();
                };
                
                const debouncedLayout = debounce(calculateFullLayout, 50);
                
                const updateVisibleItemsAndRender = () => {
                    const scrollTop = cardholder.scrollTop;
                    const viewHeight = cardholder.clientHeight;
                    const viewStart = scrollTop - VIRTUAL_SCROLL_PADDING;
                    const viewEnd = scrollTop + viewHeight + VIRTUAL_SCROLL_PADDING;
                    
                    const newVisibleItems = [];
                    allItems.forEach((item, index) => {
                        const itemLayout = layoutData[index];
                        if (!itemLayout) return;
                        
                        const itemTop = itemLayout.top;
                        const itemBottom = itemLayout.top + itemLayout.height;
                        
                        if (itemBottom > viewStart && itemTop < viewEnd) {
                            newVisibleItems.push({ item, index, layout: itemLayout });
                        }
                    });
                    
                    const existingCards = new Map(
                        Array.from(cardholder.querySelectorAll('.lmm-gallery-card')).map(card => [card.dataset.path, card])
                    );
                    const visiblePaths = new Set(newVisibleItems.map(vi => vi.item.path));
                    
                    existingCards.forEach((card, path) => {
                        if (!visiblePaths.has(path)) {
                            card.remove();
                        }
                    });
                    
                    newVisibleItems.forEach(({ item, index, layout }) => {
                        let card = existingCards.get(item.path);
                        if (!card) {
                            card = createCardElement(item);
                            cardholder.appendChild(card);
                        }
                        
                        card.style.left = `${layout.left}px`;
                        card.style.top = `${layout.top}px`;
                        card.style.width = `${layout.width}px`;
                        
                        if (selection.some(sel => sel.path === item.path)) {
                            card.classList.add('lmm-selected');
                        } else {
                            card.classList.remove('lmm-selected');
                        }
                        
                        if (selectedCardsForEditing.has(item.path)) {
                            card.classList.add('lmm-edit-selected');
                        } else {
                            card.classList.remove('lmm-edit-selected');
                        }
                    });
                    renderSelectionBadges();
                }
                
                new ResizeObserver(debouncedLayout).observe(cardholder);
                new ResizeObserver(() => renderBreadcrumb(pathInput.value)).observe(breadcrumbContainer);
                
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
                    
                    const tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
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
                            const mediaWrapper = card.querySelector('.lmm-card-media-wrapper');
                            if(mediaWrapper) mediaWrapper.appendChild(badge);
                        }
                    });
                }
                
                function renderTagEditor() {
                    tagEditorList.innerHTML = "";
                    selectedCountEl.textContent = selectedCardsForEditing.size;
                    
                    if (selectedCardsForEditing.size === 0) {
                        tagEditor.classList.remove("lmm-visible");
                        renameContainer.style.display = "none";
                        return;
                    }
                    
                    const itemsToEdit = allItems.filter(item => selectedCardsForEditing.has(item.path));
                    
                    if (itemsToEdit.length === 1) {
                        const singleItem = itemsToEdit[0];
                        const filename = singleItem.path.split(/[/\\]/).pop();
                        renameInput.value = filename;
                        renameContainer.style.display = "flex";
                    } else {
                        renameContainer.style.display = "none";
                    }
                    
                    const allTags = itemsToEdit.map(item => item.tags || []);
                    const commonTags = allTags.length > 0 ? allTags.reduce((acc, tags) => acc.filter(tag => tags.includes(tag))) : [];
                    
                    commonTags.forEach(tag => {
                        const tagEl = document.createElement("span");
                        tagEl.className = "lmm-tag";
                        tagEl.textContent = tag;
                        const removeEl = document.createElement("span");
                        removeEl.className = "lmm-remove-tag";
                        removeEl.textContent = " ⓧ";
                        removeEl.onclick = async (e) => {
                            e.stopPropagation();
                            
                            const updatePromises = itemsToEdit.map(async (item) => {
                                const newTags = item.tags.filter(t => t !== tag);
                                item.tags = newTags; 
                                await updateMetadata(item.path, { tags: newTags });
                                
                                const cardInDom = cardholder.querySelector(`.lmm-gallery-card[data-path="${CSS.escape(item.path)}"]`);
                                if (cardInDom) {
                                    cardInDom.dataset.tags = newTags.join(',');
                                    updateCardTagsUI(cardInDom);
                                }
                            });
                            
                            await Promise.all(updatePromises);
                            await loadAllTags();
                            renderTagEditor();
                            
                            if (tagFilterInput.value.trim()) {
                                saveStateAndReload(false);
                            }
                        };
                        tagEl.appendChild(removeEl);
                        tagEditorList.appendChild(tagEl);
                    });
                    
                    tagEditor.classList.add("lmm-visible");
                }
                
                const createCardElement = (item) => {
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
                        mediaHTML = `<div class="lmm-card-media-wrapper"><img src="/local_image_gallery/thumbnail?filepath=${encodeURIComponent(item.path)}&t=${item.mtime}" loading="lazy"></div>`;
                    } else if (item.type === 'video') {
                        mediaHTML = `<div class="lmm-card-media-wrapper"><img src="/local_image_gallery/thumbnail?filepath=${encodeURIComponent(item.path)}&t=${item.mtime}" loading="lazy"><div class="lmm-video-card-overlay">${videoSVG}</div></div>`;
                    } else if (item.type === 'audio') {
                        mediaHTML = `<div class="lmm-card-media-wrapper"><div class="lmm-audio-card"><div class="lmm-audio-icon">${audioSVG}</div><div class="lmm-audio-name">${item.name}</div></div></div>`;
                    }
                    card.innerHTML = mediaHTML;
                    
                    if (item.type === 'image' || item.type === 'video') {
                        const infoPanel = document.createElement("div");
                        infoPanel.className = 'lmm-card-info-panel';
                        const stars = Array.from({ length: 5 }, (_, i) => `<span class="lmm-star" data-value="${i + 1}">☆</span>`).join('');
                        const tags = item.tags.map(t => `<span class="lmm-tag">${t}</span>`).join('');
                        
                        const workflowTextBadge = item.has_workflow ? `<div class="lmm-workflow-text-badge" title="Click to load workflow">Workflow</div>` : '';
                        
                        infoPanel.innerHTML = `
                            <div class="lmm-info-top-row">
                                <div class="lmm-star-rating">${stars}</div>
                                ${workflowTextBadge}
                            </div>
                            <div class="lmm-tag-list">${tags}</div>
                            <div class="edit-tags-btn">✏️</div>
                        `;
                        card.appendChild(infoPanel);
                        
                        if (item.has_workflow) {
                            const workflowTextEl = card.querySelector(".lmm-workflow-text-badge");
                            if (workflowTextEl) {
                                workflowTextEl.addEventListener("click", async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    workflowTextEl.style.backgroundColor = '#4CAF50';
                                    workflowTextEl.style.color = 'white';
                                    workflowTextEl.textContent = "Loading...";
                                    
                                    try {
                                        const response = await api.fetchApi(`/local_image_gallery/view?filepath=${encodeURIComponent(item.path)}`);
                                        const blob = await response.blob();
                                        const file = new File([blob], item.name, { type: blob.type });
                                        
                                        app.handleFile(file);
                                        
                                        setTimeout(() => {
                                            workflowTextEl.style.backgroundColor = 'rgba(0,0,0,0.4)';
                                            workflowTextEl.style.color = '#FFD700';
                                            workflowTextEl.textContent = "Workflow";
                                        }, 1000);
                                    } catch (error) {
                                        console.error("Failed to load workflow from media:", error);
                                        alert("Failed to load workflow from media. See console for details.");
                                        workflowTextEl.style.backgroundColor = '#F44336';
                                        workflowTextEl.textContent = "Failed!";
                                    }
                                });
                            }
                        }
                        
                        const editBtn = infoPanel.querySelector(".edit-tags-btn");
                        editBtn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const path = card.dataset.path;
                            if (e.ctrlKey) {
                                if (selectedCardsForEditing.has(path)) {
                                    selectedCardsForEditing.delete(path);
                                    card.classList.remove("lmm-edit-selected");
                                } else {
                                    selectedCardsForEditing.add(path);
                                    card.classList.add("lmm-edit-selected");
                                }
                            } else {
                                if (selectedCardsForEditing.has(path) && selectedCardsForEditing.size === 1) {
                                    selectedCardsForEditing.clear();
                                    card.classList.remove("lmm-edit-selected");
                                } else {
                                    galleryContainer.querySelectorAll('.lmm-gallery-card.lmm-edit-selected').forEach(c => c.classList.remove("lmm-edit-selected"));
                                    selectedCardsForEditing.clear();
                                    selectedCardsForEditing.add(path);
                                    card.classList.add("lmm-edit-selected");
                                }
                            }
                            renderTagEditor();
                        });
                        
                        const starRating = infoPanel.querySelector('.lmm-star-rating');
                        const starsList = starRating.querySelectorAll('.lmm-star');
                        const rating = parseInt(item.rating || 0);
                        starsList.forEach((star, index) => {
                            if (index < rating) {
                                star.innerHTML = '★';
                                star.classList.add('lmm-rated');
                            }
                        });
                    }
                    
                    const img = card.querySelector("img");
                    if (img) {
                        img.onload = () => {
                            const itemIndex = allItems.findIndex(i => i.path === item.path);
                            if (itemIndex > -1) {
                                const newAspectRatio = img.naturalWidth / img.naturalHeight;
                                if (allItems[itemIndex].aspectRatio !== newAspectRatio) {
                                    allItems[itemIndex].aspectRatio = newAspectRatio;
                                    debouncedLayout();
                                }
                            }
                        };
                        img.onerror = () => {
                             const itemIndex = allItems.findIndex(i => i.path === item.path);
                             if (itemIndex > -1 && !allItems[itemIndex].aspectRatio) {
                                allItems[itemIndex].aspectRatio = 1.0; 
                                debouncedLayout();
                             }
                        };
                    }
                    
                    return card;
                };
                
                const fetchImages = async (page = 1, append = false, forceRefresh = false) => {
                    if (isLoading) return;
                    isLoading = true;
                    updateShowSelectedButtonUI();
                    
                    if (!append) {
                        cardholder.style.opacity = 0;
                        await new Promise(resolve => setTimeout(resolve, 200));
                        currentPage = 1;
                    }
                    
                    if (showSelectedMode) {
                        if (selection.length === 0) {
                            placeholder.textContent = "No items selected.";
                            placeholder.style.display = 'block';
                            allItems = [];
                            calculateFullLayout();
                            cardholder.style.opacity = 1;
                            isLoading = false;
                            return;
                        }
                        
                        placeholder.textContent = "Loading selected items...";
                        placeholder.style.display = 'block';
                        try {
                            const response = await api.fetchApi("/local_image_gallery/get_selected_items", {
                                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selection: selection }),
                            });
                            
                            if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`); }
                            
                            const api_data = await response.json();
                            allItems = api_data.items || [];
                            renderBreadcrumb("Selected Items");
                            breadcrumbEl.style.pointerEvents = "none";
                            upButton.disabled = true;
                            
                            calculateFullLayout();
                            
                        } catch (error) {
                            placeholder.textContent = `Error: ${error.message}`;
                            placeholder.style.color = 'red';
                        } finally {
                            cardholder.style.opacity = 1;
                            isLoading = false;
                        }
                        return;
                    }
                    
                    breadcrumbEl.style.pointerEvents = "auto";
                    
                    const directory = pathInput.value;
                    const showImages = showImagesCheckbox.checked;
                    const showVideos = showVideosCheckbox.checked;
                    const showAudio = showAudioCheckbox.checked;
                    const filterTag = tagFilterInput.value;
                    const isGlobalSearch = globalSearchCheckbox.checked;
                    const filterMode = tagFilterModeBtn.textContent;
                    
                    if (!directory && !isGlobalSearch) {
                        placeholder.textContent = "Enter folder path and click 'Refresh'.";
                        placeholder.style.display = 'block';
                        allItems = [];
                        calculateFullLayout();
                        cardholder.style.opacity = 1;
                        isLoading = false;
                        return;
                    }
                    
                    if (!append) {
                        placeholder.textContent = "Loading...";
                        placeholder.style.display = 'block';
                    }
                    
                    const sortBy = controls.querySelector(".lmm-sort-by").value;
                    const sortOrder = controls.querySelector(".lmm-sort-order").value;
                    let url = `/local_image_gallery/images?directory=${encodeURIComponent(directory)}&page=${page}&sort_by=${sortBy}&sort_order=${sortOrder}&show_images=${showImages}&show_videos=${showVideos}&show_audio=${showAudio}&filter_tag=${encodeURIComponent(filterTag)}&search_mode=${isGlobalSearch ? 'global' : 'local'}&filter_mode=${filterMode}&force_refresh=${forceRefresh}`;
                    
                    if (selection.length > 0) {
                        selection.forEach(item => { url += `&selected_paths=${encodeURIComponent(item.path)}`; });
                    }
                    
                    try {
                        const response = await api.fetchApi(url);
                        if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`); }
                        const api_data = await response.json();
                        const items = api_data.items || [];
                        
                        totalPages = api_data.total_pages;
                        parentDir = api_data.parent_directory;
                        
                        if (!api_data.is_global_search) {
                            pathInput.value = api_data.current_directory;
                            lastKnownPath = api_data.current_directory;
                            renderBreadcrumb(api_data.current_directory);
                            setUiState.call(this, this.id, { last_path: api_data.current_directory });
                        } else {
                            renderBreadcrumb("Global Search");
                            breadcrumbEl.style.pointerEvents = "none";
                        }
                        
                        upButton.disabled = api_data.is_global_search || !parentDir;
                        
                        if (!append) {
                            allItems = items;
                            cardholder.innerHTML = ''; 
                            cardholder.scrollTop = 0;
                        } else {
                            const existingPaths = new Set(allItems.map(i => i.path));
                            const newItems = items.filter(i => !existingPaths.has(i.path));
                            allItems.push(...newItems);
                        }
                        
                        if (allItems.length === 0) {
                            placeholder.textContent = api_data.is_global_search ? 'No items found for this tag.' : 'The folder is empty.';
                            placeholder.style.display = 'block';
                        } else {
                            placeholder.style.display = 'none';
                        }
                        
                        calculateFullLayout();
                        
                        cardholder.style.opacity = 1;
                        currentPage = page;
                        
                    } catch (error) { 
                        placeholder.textContent = `Error: ${error.message}`;
                        placeholder.style.color = 'red';
                        placeholder.style.display = 'block';
                        allItems = [];
                        calculateFullLayout();
                        cardholder.style.opacity = 1;
                    }
                    finally { 
                        isLoading = false;
                    }
                };
                
                cardholder.addEventListener('click', async (event) => {
                    const card = event.target.closest('.lmm-gallery-card');
                    if (!card) return;
                    
                    if (event.target.classList.contains('lmm-star')) {
                        event.stopPropagation();
                        const newRating = parseInt(event.target.dataset.value);
                        const currentRating = parseInt(card.dataset.rating || 0);
                        const finalRating = newRating === currentRating ? 0 : newRating;
                        
                        const itemData = allItems.find(i => i.path === card.dataset.path);
                        if(itemData) itemData.rating = finalRating;
                        
                        card.dataset.rating = finalRating;
                        await updateMetadata(card.dataset.path, { rating: finalRating });
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
                        resetAndReload(true);
                        return;
                    }
                    
                    const type = card.dataset.type, path = card.dataset.path;
                    
                    if (type === 'dir') {
                        pathInput.value = path;
                        globalSearchCheckbox.checked = false;
                        tagFilterInput.value = "";
                        resetAndReload(true);
                        pathPresets.selectedIndex = 0;
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
                        
                        const selectionJson = JSON.stringify(selection);
                        this.setProperty("selection", selectionJson);
                        const widget = this.widgets.find(w => w.name === "selection");
                        if (widget) { widget.value = selectionJson; }
                        
                        setUiState.call(this, this.id, { selection: selection });
                        updateBatchActionButtonsState();
                        
                    }
                });
                
                cardholder.addEventListener('dblclick', (event) => {
                    const card = event.target.closest('.lmm-gallery-card');
                    if (!card || !['image', 'video', 'audio'].includes(card.dataset.type)) return;
                    
                    const currentMediaList = allItems.filter(item => ['image', 'video', 'audio'].includes(item.type));
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
                        lightboxVideo.onloadedmetadata = () => {
                            dimensionsEl.textContent = `${lightboxVideo.videoWidth} x ${lightboxVideo.videoHeight}`;
                            dimensionsEl.style.display = 'block';
                        };
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
                lightbox.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox-content')) closeLightbox(); });
                
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
                        show_images: showImagesCheckbox.checked,
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
                    
                    saveStateAndReload(false);
                };
                
                const saveStateAndReload = (forceRefresh = false) => {
                    saveCurrentControlsState();
                    resetAndReload(forceRefresh);
                };
                
                const resetAndReload = (forceRefresh = false) => { fetchImages.call(this, 1, false, forceRefresh); };
                controls.querySelector('.lmm-refresh-button').onclick = () => saveStateAndReload(true);
                tagFilterInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveStateAndReload(false); });
                
                tagEditorInput.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter' && selectedCardsForEditing.size > 0) {
                        e.preventDefault();
                        const newTag = tagEditorInput.value.trim();
                        if (newTag) {
                            const updatePromises = [];
                            selectedCardsForEditing.forEach(path => {
                                const item = allItems.find(i => i.path === path);
                                if (item && !item.tags.includes(newTag)) {
                                    item.tags.push(newTag);
                                    updatePromises.push(updateMetadata(path, { tags: item.tags }));
                                    
                                    const cardInDom = cardholder.querySelector(`.lmm-gallery-card[data-path="${CSS.escape(path)}"]`);
                                    if (cardInDom) {
                                        cardInDom.dataset.tags = item.tags.join(',');
                                        updateCardTagsUI(cardInDom);
                                    }
                                }
                            });
                            
                            await Promise.all(updatePromises);
                            await loadAllTags();
                            renderTagEditor();
                            tagEditorInput.value = "";
                        }
                    }
                });
                
                controls.querySelectorAll('select:not(.lmm-path-presets)').forEach(select => { select.addEventListener('change', () => saveStateAndReload(false)); });
                showImagesCheckbox.addEventListener('change', () => saveStateAndReload(false));
                showVideosCheckbox.addEventListener('change', () => saveStateAndReload(false));
                showAudioCheckbox.addEventListener('change', () => saveStateAndReload(false));
                globalSearchCheckbox.addEventListener('change', () => saveStateAndReload(false));
                
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
                        lastKnownPath = pathInput.value;
                        saveStateAndReload(true);
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
                
                upButton.onclick = () => {
                    if(parentDir){
                        pathInput.value = parentDir;
                        globalSearchCheckbox.checked = false;
                        tagFilterInput.value = "";
                        resetAndReload(true);
                        pathPresets.selectedIndex = 0;
                    }
                };
                
                tagFilterModeBtn.addEventListener('click', () => {
                    if (tagFilterModeBtn.textContent === 'OR') {
                        tagFilterModeBtn.textContent = 'AND';
                        tagFilterModeBtn.style.backgroundColor = "#D97706";
                    } else {
                        tagFilterModeBtn.textContent = 'OR';
                        tagFilterModeBtn.style.backgroundColor = "#555";
                    }
                    saveStateAndReload(false);
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
                    saveStateAndReload(false);
                });
                
                cardholder.onscroll = () => {
                    updateVisibleItemsAndRender();
                    if (cardholder.scrollTop + cardholder.clientHeight >= cardholder.scrollHeight - 300 && !isLoading && currentPage < totalPages) { 
                        fetchImages.call(this, currentPage + 1, true, false); 
                    } 
                };
                
                const clearTagFilterButton = controls.querySelector(".lmm-clear-tag-filter-button");
                clearTagFilterButton.addEventListener("click", () => {
                    tagFilterInput.value = "";
                    const checkboxes = multiSelectTagDropdown.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => { cb.checked = false; });
                    saveStateAndReload(false);
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
                
                batchSelectAllBtn.addEventListener('click', () => {
                    const allMediaItems = allItems.filter(card => card.type !== 'dir');
                    
                    if (selection.length === allMediaItems.length) {
                        selection = [];
                    } else {
                        selection = allMediaItems.map(item => ({ path: item.path, type: item.type }));
                    }
                    
                    cardholder.querySelectorAll('.lmm-gallery-card').forEach(card => {
                        if (selection.some(item => item.path === card.dataset.path)) {
                            card.classList.add('lmm-selected');
                        } else {
                            card.classList.remove('lmm-selected');
                        }
                    });
                    
                    renderSelectionBadges();
                    
                    const selectionJson = JSON.stringify(selection);
                    node_instance.setProperty("selection", selectionJson);
                    const widget = node_instance.widgets.find(w => w.name === "selection");
                    if (widget) { widget.value = selectionJson; }
                    
                    setUiState.call(node_instance, node_instance.id, { selection: selection });
                    updateBatchActionButtonsState();
                });
                
                batchDeleteBtn.addEventListener('click', async () => {
                    if (selection.length === 0) return;
                    const filepaths = selection.map(item => item.path);
                    if (confirm(`Are you sure you want to permanently delete ${selection.length} selected file(s)?`)) {
                        try {
                            await api.fetchApi("/local_image_gallery/delete_files", {
                                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filepaths }),
                            });
                            selection = [];
                            updateBatchActionButtonsState();
                            resetAndReload(true);
                        } catch (e) { alert(`Failed to delete files: ${e}`); }
                    }
                });
                
                batchMoveBtn.addEventListener('click', async () => {
                    if (selection.length === 0) return;
                    
                    const source_paths = selection.map(item => item.path);
                    const presetOptions = Array.from(pathPresets.options).filter(o => o.value).map((o, i) => `${i + 1}: ${o.value}`).join('\n');
                    const destination_dir = prompt("Enter destination folder path, or a preset number:\n\n" + presetOptions);
                    
                    if (destination_dir) {
                        let final_dest_dir = destination_dir.trim();
                        const presetIndex = parseInt(final_dest_dir, 10) - 1;
                        const presetValues = Array.from(pathPresets.options).filter(o => o.value).map(o => o.value);
                        if (!isNaN(presetIndex) && presetIndex >= 0 && presetIndex < presetValues.length) {
                            final_dest_dir = presetValues[presetIndex];
                        }
                        
                        try {
                            const response = await api.fetchApi("/local_image_gallery/move_files", {
                                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_paths, destination_dir: final_dest_dir }),
                            });
                            const res = await response.json();
                            if (res.errors && res.errors.length > 0) {
                                alert(`Move operation completed with errors:\n\n- ${res.errors.join('\n- ')}`);
                            }
                            selection = [];
                            updateBatchActionButtonsState();
                            resetAndReload(true);
                        } catch (e) { alert(`Failed to move files: ${e}`); }
                    }
                });
                
                const handleRename = async () => {
                    if (selectedCardsForEditing.size !== 1) return;
                    
                    const old_path = selectedCardsForEditing.values().next().value;
                    const new_name = renameInput.value.trim();
                    
                    if (!new_name || new_name === old_path.split(/[/\\]/).pop()) {
                        return;
                    }
                    
                    try {
                        const response = await api.fetchApi("/local_image_gallery/rename_file", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ old_path, new_name }),
                        });
                        const res = await response.json();
                        if (response.ok) {
                            const selectionIndex = selection.findIndex(item => item.path === old_path);
                            if (selectionIndex > -1) {
                                selection[selectionIndex].path = res.new_path;
                                const selectionJson = JSON.stringify(selection);
                                node_instance.setProperty("selection", selectionJson);
                                const widget = node_instance.widgets.find(w => w.name === "selection");
                                if (widget) { widget.value = selectionJson; }
                                setUiState.call(node_instance, node_instance.id, { selection: selection });
                            }
                            
                            selectedCardsForEditing.clear();
                            renderTagEditor();
                            resetAndReload(true);
                        } else {
                            alert(`Error: ${res.message}`);
                        }
                    } catch (e) {
                        alert(`Failed to rename file: ${e}`);
                    }
                };
                
                renameBtn.addEventListener('click', handleRename);
                renameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRename();
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
                            showImagesCheckbox.checked = state.show_images !== false;
                            showVideosCheckbox.checked = state.show_videos;
                            showAudioCheckbox.checked = state.show_audio;
                            tagFilterInput.value = state.filter_tag;
                            globalSearchCheckbox.checked = state.global_search;
                            showSelectedMode = state.show_selected_mode || false;
                            
                            selection = state.selection || [];
                            updateBatchActionButtonsState();
                            
                            const selectionJson = JSON.stringify(selection);
                            this.setProperty("selection", selectionJson);
                            const widget = this.widgets.find(w => w.name === "selection");
                            if (widget) { widget.value = selectionJson; }
                            
                            if (state.last_path) {
                                pathInput.value = state.last_path;
                                lastKnownPath = state.last_path;
                            }
                            
                            switchToBreadcrumb(false);
                            resetAndReload(false);
                        }
                    } catch (e) {
                        console.error("LocalImageGallery: Unable to load the UI state:", e);
                        switchToBreadcrumb(false);
                        resetAndReload(false);
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
                    renderBreadcrumb(pathInput.value);
                    debouncedLayout(); 
                };
                
                return r;
            };
        }
    },
});