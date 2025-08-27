import server
from aiohttp import web
import os
import json
import torch
import numpy as np
from PIL import Image, ImageOps
import urllib.parse
import io
from comfy.utils import common_upscale

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
SELECTIONS_FILE = os.path.join(NODE_DIR, "selections.json")
CONFIG_FILE = os.path.join(NODE_DIR, "config.json")
METADATA_FILE = os.path.join(NODE_DIR, "metadata.json")
UI_STATE_FILE = os.path.join(NODE_DIR, "lig_ui_state.json")
SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp']
SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.avi']
SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac']

def save_config(data):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)
    except Exception as e: print(f"LocalImageGallery: Error saving config: {e}")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f: return json.load(f)
        except: pass
    return {}

def load_metadata():
    if not os.path.exists(METADATA_FILE): return {}
    try:
        with open(METADATA_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except: return {}

def save_metadata(data):
    try:
        with open(METADATA_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e: print(f"LocalImageGallery: Error saving metadata: {e}")

def load_selections():
    if not os.path.exists(SELECTIONS_FILE): return {}
    try:
        with open(SELECTIONS_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except: return {}

def save_selections(data):
    try:
        with open(SELECTIONS_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e: print(f"LMM: Error saving selections: {e}")

def load_ui_state():
    if not os.path.exists(UI_STATE_FILE): return {}
    try:
        with open(UI_STATE_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except: return {}

def save_ui_state(data):
    try:
        with open(UI_STATE_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)
    except Exception as e: print(f"LocalImageGallery: Error saving UI state: {e}")

class LocalImageGalleryNode:
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        if os.path.exists(SELECTIONS_FILE):
            return os.path.getmtime(SELECTIONS_FILE)
        return float("inf")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": { "unique_id": "UNIQUE_ID" },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING", "STRING",)
    RETURN_NAMES = ("image", "video_path", "audio_path", "info",)
    FUNCTION = "get_selected_media"
    CATEGORY = "📜Asset Gallery/Local"

    def get_selected_media(self, unique_id):
        selections = load_selections()
        node_selections = selections.get(str(unique_id), {})

        image_paths = node_selections.get("image", [])
        video_paths = node_selections.get("video", [])
        audio_paths = node_selections.get("audio", [])

        image_tensors = []
        info_strings = []
        final_image_tensor = torch.zeros(1, 1, 1, 3)

        if image_paths:
            sizes = {}
            valid_image_paths = []
            for media_path in image_paths:
                if os.path.exists(media_path):
                    try:
                        with Image.open(media_path) as img:
                            sizes[img.size] = sizes.get(img.size, 0) + 1
                            valid_image_paths.append(media_path)
                    except Exception as e:
                        print(f"LMM: Error reading size for {media_path}: {e}")

            if valid_image_paths:
                dominant_size = max(sizes.items(), key=lambda x: x[1])[0]
                target_width, target_height = dominant_size

                for media_path in valid_image_paths:
                    try:
                        with Image.open(media_path) as img:
                            img_out = img.convert("RGB")
                            if img.size[0] != target_width or img.size[1] != target_height:
                                img_array_pre = np.array(img_out).astype(np.float32) / 255.0
                                tensor_pre = torch.from_numpy(img_array_pre)[None,].permute(0, 3, 1, 2)
                                tensor_post = common_upscale(tensor_pre, target_width, target_height, "lanczos", "center")
                                img_array = tensor_post.permute(0, 2, 3, 1).cpu().numpy().squeeze(0)
                            else:
                                img_array = np.array(img_out).astype(np.float32) / 255.0
                            image_tensor = torch.from_numpy(img_array)[None,]
                            image_tensors.append(image_tensor)

                            full_info = {"filename": os.path.basename(media_path), "width": img.width, "height": img.height, "mode": img.mode, "format": img.format}
                            metadata = {}
                            if 'parameters' in img.info: metadata['parameters'] = img.info['parameters']
                            if 'prompt' in img.info: metadata['prompt'] = img.info['prompt']
                            if 'workflow' in img.info: metadata['workflow'] = img.info['workflow']
                            if metadata: full_info['metadata'] = metadata
                            info_strings.append(json.dumps(full_info, ensure_ascii=False))
                    except Exception as e:
                        print(f"LMM: Error processing image {media_path}: {e}")

                if image_tensors:
                    final_image_tensor = torch.cat(image_tensors, dim=0)

        info_string_out = json.dumps(info_strings, indent=4, ensure_ascii=False)
        if len(info_strings) == 1:
            try:
                single_info = json.loads(info_strings[0])
                workflow_data_str = single_info.get("metadata", {}).get("workflow")
                if workflow_data_str:
                    try:
                        workflow_json = json.loads(workflow_data_str)
                        info_string_out = json.dumps(workflow_json, indent=4, ensure_ascii=False)
                    except:
                        info_string_out = workflow_data_str
            except Exception as e:
                print(f"LMM: Could not parse workflow info, falling back to default. Error: {e}")
                pass

        video_path_out = video_paths[0] if video_paths and os.path.exists(os.path.normpath(video_paths[0])) else ""
        audio_path_out = audio_paths[0] if audio_paths and os.path.exists(os.path.normpath(audio_paths[0])) else ""

        return (final_image_tensor, video_path_out, audio_path_out, info_string_out,)

prompt_server = server.PromptServer.instance

@prompt_server.routes.post("/local_image_gallery/set_node_selection")
async def set_node_selection(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id"))
        selections_list = data.get("selections", [])

        if not node_id:
            return web.json_response({"status": "error", "message": "Missing node_id."}, status=400)

        selections = load_selections()

        organized_selections = {"image": [], "video": [], "audio": []}
        for item in selections_list:
            media_type = item.get("type")
            path = item.get("path")
            if media_type in organized_selections and path:
                organized_selections[media_type].append(path)

        selections[node_id] = organized_selections
        save_selections(selections)

        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.post("/local_image_gallery/update_metadata")
async def update_metadata(request):
    try:
        data = await request.json()
        path, rating, tags = data.get("path"), data.get("rating"), data.get("tags")
        if not path or not os.path.isabs(path): return web.json_response({"status": "error", "message": "Invalid path."}, status=400)
        metadata = load_metadata()
        if path not in metadata: metadata[path] = {}
        if rating is not None: metadata[path]['rating'] = int(rating)
        if tags is not None: metadata[path]['tags'] = [str(tag).strip() for tag in tags if str(tag).strip()]
        save_metadata(metadata)
        return web.json_response({"status": "ok", "message": "Metadata updated"})
    except Exception as e: return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/get_saved_paths")
async def get_saved_paths(request):
    config = load_config()
    return web.json_response({"saved_paths": config.get("saved_paths", [])})

@prompt_server.routes.post("/local_image_gallery/save_paths")
async def save_paths(request):
    try:
        data = await request.json()
        paths = data.get("paths", [])
        config = load_config()
        config["saved_paths"] = paths
        save_config(config)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/get_all_tags")
async def get_all_tags(request):
    try:
        metadata = load_metadata()
        all_tags = set()
        for item_meta in metadata.values():
            tags = item_meta.get("tags")
            if isinstance(tags, list):
                for tag in tags:
                    all_tags.add(tag)
        
        sorted_tags = sorted(list(all_tags), key=lambda s: s.lower())
        return web.json_response({"tags": sorted_tags})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/images")
async def get_local_images(request):
    directory = request.query.get('directory', '')
    search_mode = request.query.get('search_mode', 'local')
    selected_paths = request.query.getall('selected_paths', [])

    if search_mode == 'local':
        if not directory or not os.path.isdir(directory): 
            return web.json_response({"error": "Directory not found."}, status=404)

    show_videos = request.query.get('show_videos', 'false').lower() == 'true'
    show_audio = request.query.get('show_audio', 'false').lower() == 'true'
    filter_tag = request.query.get('filter_tag', '').strip().lower()

    page = int(request.query.get('page', 1)); per_page = int(request.query.get('per_page', 50))
    sort_by = request.query.get('sort_by', 'name'); sort_order = request.query.get('sort_order', 'asc')

    metadata = load_metadata()
    all_items_with_meta = []

    try:
        if search_mode == 'global' and filter_tag:
            for path, meta in metadata.items():
                if os.path.exists(path):
                    tags = [t.lower() for t in meta.get('tags', [])]
                    if filter_tag in tags:
                        ext = os.path.splitext(path)[1].lower()
                        item_type = ''
                        if ext in SUPPORTED_IMAGE_EXTENSIONS: item_type = 'image'
                        elif show_videos and ext in SUPPORTED_VIDEO_EXTENSIONS: item_type = 'video'
                        elif show_audio and ext in SUPPORTED_AUDIO_EXTENSIONS: item_type = 'audio'

                        if item_type:
                            try:
                                stats = os.stat(path)
                                all_items_with_meta.append({
                                    'path': path, 'name': os.path.basename(path), 'type': item_type,
                                    'mtime': stats.st_mtime, 'rating': meta.get('rating', 0), 'tags': meta.get('tags', [])
                                })
                            except: continue
        else:
            for item in os.listdir(directory):
                full_path = os.path.join(directory, item)
                try:
                    stats = os.stat(full_path)
                    item_meta = metadata.get(full_path, {})
                    rating = item_meta.get('rating', 0)
                    tags = [t.lower() for t in item_meta.get('tags', [])]
                    if filter_tag and filter_tag not in tags: continue
                    item_data = {'path': full_path, 'name': item, 'mtime': stats.st_mtime, 'rating': rating, 'tags': item_meta.get('tags', [])}
                    if os.path.isdir(full_path):
                        all_items_with_meta.append({**item_data, 'type': 'dir'})
                    else:
                        ext = os.path.splitext(item)[1].lower()
                        item_type = ''
                        if ext in SUPPORTED_IMAGE_EXTENSIONS: item_type = 'image'
                        elif show_videos and ext in SUPPORTED_VIDEO_EXTENSIONS: item_type = 'video'
                        elif show_audio and ext in SUPPORTED_AUDIO_EXTENSIONS: item_type = 'audio'
                        if item_type: all_items_with_meta.append({**item_data, 'type': item_type})
                except (PermissionError, FileNotFoundError): continue

        pinned_items = []
        if selected_paths:
            pinned_items_dict = {path: None for path in selected_paths}
            remaining_items = []
            for item in all_items_with_meta:
                path = item.get('path')
                if path in pinned_items_dict:
                    pinned_items_dict[path] = item
                else:
                    remaining_items.append(item)

            for path in selected_paths:
                if pinned_items_dict[path]:
                    pinned_items.append(pinned_items_dict[path])

            all_items_with_meta = remaining_items

        reverse_order = sort_order == 'desc'
        if sort_by == 'date': all_items_with_meta.sort(key=lambda x: x['mtime'], reverse=reverse_order)
        elif sort_by == 'rating': all_items_with_meta.sort(key=lambda x: x.get('rating', 0), reverse=reverse_order)
        else: all_items_with_meta.sort(key=lambda x: x['name'].lower(), reverse=reverse_order)

        if search_mode != 'global':
            all_items_with_meta.sort(key=lambda x: x['type'] != 'dir')

        if pinned_items:
            all_items_with_meta = pinned_items + all_items_with_meta

        parent_directory = os.path.dirname(directory) if search_mode != 'global' else None
        if parent_directory == directory: parent_directory = None

        start = (page - 1) * per_page; end = start + per_page
        paginated_items = all_items_with_meta[start:end]

        return web.json_response({
            "items": paginated_items, "total_pages": (len(all_items_with_meta) + per_page - 1) // per_page,
            "current_page": page, "current_directory": directory, "parent_directory": parent_directory,
            "is_global_search": search_mode == 'global' and filter_tag
        })
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

@prompt_server.routes.post("/local_image_gallery/set_ui_state")
async def set_ui_state(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id"))
        state = data.get("state", {})
        if not node_id:
            return web.json_response({"status": "error", "message": "node_id is required"}, status=400)

        ui_states = load_ui_state()
        if node_id not in ui_states:
            ui_states[node_id] = {}
        ui_states[node_id].update(state)
        save_ui_state(ui_states)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/get_ui_state")
async def get_ui_state(request):
    try:
        node_id = request.query.get('node_id')
        if not node_id:
            return web.json_response({"error": "node_id is required"}, status=400)

        ui_states = load_ui_state()

        default_state = {
            "last_path": "",
            "selected_paths": [],
            "sort_by": "name",
            "sort_order": "asc",
            "show_videos": False,
            "show_audio": False,
            "filter_tag": "",
            "global_search": False
        }

        node_saved_state = ui_states.get(str(node_id), {})

        final_state = {**default_state, **node_saved_state}

        return web.json_response(final_state)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/thumbnail")
async def get_thumbnail(request):
    filepath = request.query.get('filepath')
    if not filepath or ".." in filepath: return web.Response(status=400)
    filepath = urllib.parse.unquote(filepath)
    if not os.path.exists(filepath): return web.Response(status=404)
    try:
        img = Image.open(filepath)
        has_alpha = img.mode == 'RGBA' or (img.mode == 'P' and 'transparency' in img.info)
        img = img.convert("RGBA") if has_alpha else img.convert("RGB")
        img.thumbnail([320, 320], Image.LANCZOS)
        buffer = io.BytesIO()
        format, content_type = ('PNG', 'image/png') if has_alpha else ('JPEG', 'image/jpeg')
        img.save(buffer, format=format, quality=90 if format == 'JPEG' else None)
        buffer.seek(0)
        return web.Response(body=buffer.read(), content_type=content_type)
    except Exception as e:
        print(f"LocalImageGallery: Error generating thumbnail for {filepath}: {e}")
        return web.Response(status=500)
@prompt_server.routes.get("/local_image_gallery/view")
async def view_image(request):
    filepath = request.query.get('filepath')
    if not filepath or ".." in filepath: return web.Response(status=400)
    filepath = urllib.parse.unquote(filepath)
    if not os.path.exists(filepath): return web.Response(status=404)
    try: return web.FileResponse(filepath)
    except: return web.Response(status=500)

NODE_CLASS_MAPPINGS = {"LocalImageGalleryNode": LocalImageGalleryNode}
NODE_DISPLAY_NAME_MAPPINGS = {"LocalImageGalleryNode": "Local Media Manager"}