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
import hashlib
import shutil
from send2trash import send2trash
import time
import cv2
import torchaudio
import subprocess
import re
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    print("LocalImageGallery: MoviePy not installed. Video thumbnail generation will be disabled. Please run 'pip install moviepy'.")
    VideoFileClip = None

VAE_STRIDE = (4, 8, 8)
PATCH_SIZE = (1, 2, 2)

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(NODE_DIR, "config.json")
METADATA_FILE = os.path.join(NODE_DIR, "metadata.json")
UI_STATE_FILE = os.path.join(NODE_DIR, "lig_ui_state.json")
CACHE_DIR = os.path.join(NODE_DIR, ".cache")
THUMBNAIL_CACHE_DIR = os.path.join(CACHE_DIR, "thumbnails")

SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp']
SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.avi']
SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a']

DIRECTORY_CACHE = {}
CACHE_LIFETIME = 1800

def ensure_cache_dirs():
    os.makedirs(THUMBNAIL_CACHE_DIR, exist_ok=True)

ensure_cache_dirs()

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
    DIRECTORY_CACHE.clear()

def load_ui_state():
    if not os.path.exists(UI_STATE_FILE): return {}
    try:
        with open(UI_STATE_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except: return {}

def save_ui_state(data):
    try:
        with open(UI_STATE_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)
    except Exception as e: print(f"LocalImageGallery: Error saving UI state: {e}")

def extract_prompts(metadata):
    positive_prompts, negative_prompts = [], []

    if not metadata:
        return "", ""

    parameters = metadata.get('parameters')
    if isinstance(parameters, str):
        neg_prompt_match = re.search(r'Negative prompt:\s*(.*)', parameters, re.DOTALL)
        if neg_prompt_match:
            negative = neg_prompt_match.group(1).split('Steps:')[0].strip()
            positive = parameters.split('Negative prompt:')[0].strip()
            return positive.strip(), negative.strip()
        else:
            return parameters.split('Steps:')[0].strip(), ""

    workflow_str = metadata.get('workflow') or metadata.get('prompt')
    if not isinstance(workflow_str, str):
        return (str(metadata.get('prompt', '')), "")

    try:
        workflow = json.loads(workflow_str)
        if 'nodes' not in workflow or not isinstance(workflow.get('nodes'), list):
            return str(workflow), ""

        nodes_by_id = {str(n['id']): n for n in workflow['nodes']}
        all_links = workflow.get('links', [])
        
        links_origins = {str(l[0]): (str(l[1]), l[2]) for l in all_links}
        links_to_node = {}
        for link in all_links:
            target_id = str(link[3])
            if target_id not in links_to_node:
                links_to_node[target_id] = []
            links_to_node[target_id].append(link)

        def find_ground_truth_from_source(origin_node_id, origin_slot_index):
            display_keywords = ['show', 'text', 'preview', 'any']
            for link in all_links:
                if str(link[1]) == str(origin_node_id) and link[2] == origin_slot_index:
                    target_node = nodes_by_id.get(str(link[3]))
                    if not target_node: continue
                    
                    node_type = target_node.get('type', '').lower()
                    prop_name = target_node.get('properties', {}).get('Node name for S&R', '').lower()
                    if any(k in node_type or k in prop_name for k in display_keywords):
                        val = target_node.get('widgets_values', [[""]])[0]
                        return val[0] if isinstance(val, list) else val
            return None

        def resolve_text_fallback(node):
            if not any('link' in i for i in node.get('inputs', []) if i.get('type') == 'STRING'):
                widgets = node.get('widgets_values', [])
                return next((w for w in widgets if isinstance(w, str)), "")
            
            combined_text = ""
            for inp in node.get('inputs', []):
                if inp.get('type') == 'STRING' and 'link' in inp:
                    link_info = next((l for l in all_links if str(l[0]) == str(inp['link'])), None)
                    if link_info:
                        combined_text += resolve_text_fallback(nodes_by_id[str(link_info[1])])
            return combined_text
        
        def is_sampler(node):
            return 'Sampler' in node.get('type', '')

        def check_downstream_for_sampler(start_node, visited=None):
            if visited is None: visited = set()
            start_node_id = str(start_node['id'])
            if start_node_id in visited: return False
            visited.add(start_node_id)
            
            if is_sampler(start_node):
                return True

            for output in start_node.get('outputs', []):
                for link_id in output.get('links', []):
                    link_info = next((l for l in all_links if str(l[0]) == str(link_id)), None)
                    if link_info:
                        target_node = nodes_by_id.get(str(link_info[3]))
                        if target_node and check_downstream_for_sampler(target_node, visited):
                            return True
            return False

        for node in workflow['nodes']:
            if 'CLIPTextEncode' in node.get('type', ''):
                if check_downstream_for_sampler(node):
                    text_input = next((i for i in node.get('inputs', []) if i.get('name') == 'text'), None)
                    prompt_text = ""
                    if text_input and 'link' in text_input:
                        link_info = next((l for l in all_links if str(l[0]) == str(text_input['link'])), None)
                        if link_info:
                            origin_id, origin_slot = str(link_info[1]), link_info[2]
                            prompt_text = find_ground_truth_from_source(origin_id, origin_slot)
                            if prompt_text is None:
                                prompt_text = resolve_text_fallback(nodes_by_id[origin_id])
                    else:
                        prompt_text = (node.get('widgets_values') or [""])[0]

                    if 'negative' in node.get('title', '').lower():
                        negative_prompts.append(prompt_text)
                    else:
                        positive_prompts.append(prompt_text)

            elif 'CivitaiGalleryNode' in node.get('type', ''):
                properties = node.get('properties', {})
                if 'selection_data' in properties:
                    try:
                        selection_data = json.loads(properties['selection_data'])
                        meta = selection_data.get('item', {}).get('meta', {})
                        if 'prompt' in meta:
                            positive_prompts.append(meta['prompt'])
                        if 'negativePrompt' in meta:
                            negative_prompts.append(meta['negativePrompt'])
                    except (json.JSONDecodeError, AttributeError):
                        pass

        return " ".join(positive_prompts).strip(), " ".join(negative_prompts).strip()

    except Exception as e:
        print(f"LMM Error: Failed to parse workflow. Error: {e}")
        return "", ""

class LocalImageGalleryNode:
    @classmethod
    def IS_CHANGED(cls, selection, **kwargs):
        return selection

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "selection": ("STRING", {"default": "[]", "multiline": True, "forceInput": True}),
                "gallery_unique_id_widget": ("STRING", {"default": "", "multiline": False}),
            },
        }

    RETURN_TYPES = ("IMAGE", "LMM_ALL_PATHS", "STRING", "STRING",)
    RETURN_NAMES = ("image", "paths", "path", "info",)
    FUNCTION = "get_selected_media"
    CATEGORY = "📜Asset Gallery/Local"

    def get_selected_media(self, unique_id, gallery_unique_id_widget="", selection="[]"):
        try:
            selections_list = json.loads(selection)
        except (json.JSONDecodeError, TypeError):
            selections_list = []
        
        image_paths = [item['path'] for item in selections_list if item.get('type') == 'image' and 'path' in item]
        
        final_image_tensor = torch.zeros(1, 1, 1, 3)
        info_strings = []
        valid_image_paths = []
        enriched_selection_list = []

        if image_paths:
            sizes = {}
            batch_has_alpha = False
            
            for media_path in image_paths:
                if os.path.exists(media_path):
                    try:
                        with Image.open(media_path) as img:
                            sizes[img.size] = sizes.get(img.size, 0) + 1
                            valid_image_paths.append(media_path)
                            if not batch_has_alpha and (img.mode == 'RGBA' or (img.mode == 'P' and 'transparency' in img.info)):
                                batch_has_alpha = True
                    except Exception as e:
                        print(f"LMM: Error reading size for {media_path}: {e}")

            if valid_image_paths:
                dominant_size = max(sizes.items(), key=lambda x: x[1])[0]
                target_width, target_height = dominant_size
                
                target_mode = "RGBA" if batch_has_alpha else "RGB"
                image_tensors = []

                for media_path in valid_image_paths:
                    try:
                        with Image.open(media_path) as img:
                            img_out = img.convert(target_mode)
                            
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
        
        for item in selections_list:
            enriched_item = item.copy()
            if item.get('type') == 'image' and 'path' in item and os.path.exists(item['path']):
                try:
                    with Image.open(item['path']) as img:
                        metadata_payload = {}
                        if 'parameters' in img.info: metadata_payload['parameters'] = img.info['parameters']
                        if 'prompt' in img.info: metadata_payload['prompt'] = img.info['prompt']
                        if 'workflow' in img.info: metadata_payload['workflow'] = img.info['workflow']
                        enriched_item['metadata'] = metadata_payload
                except Exception:
                    enriched_item['metadata'] = {}
            enriched_selection_list.append(enriched_item)

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
        
        full_selection_json_string = json.dumps(enriched_selection_list, ensure_ascii=False)

        single_path_out = ""
        if len(selections_list) == 1:
            item = selections_list[0]
            if 'path' in item and os.path.exists(item['path']):
                single_path_out = item['path']

        return (final_image_tensor, full_selection_json_string, single_path_out, info_string_out,)

def parse_selection_and_get_item(selection_json_str: str, index: int, expected_type: str = None):
    try:
        selection_list = json.loads(selection_json_str)
        if not isinstance(selection_list, list) or not (0 <= index < len(selection_list)):
            return None

        item = selection_list[index]
        if expected_type is None or item.get("type") == expected_type:
            return item
        else:
            return None
    except (json.JSONDecodeError, TypeError):
        return None

def target_size(width, height, custom_width, custom_height):
    if custom_width == 0 and custom_height == 0:
        pass
    elif custom_height == 0 and width != 0:
        height = int(height * (custom_width / width))
        width = custom_width
    elif custom_width == 0 and height != 0:
        width = int(width * (custom_height / height))
        height = custom_height
    else:
        width = custom_width
        height = custom_height
    
    downscale_ratio = 8
    width = int(width / downscale_ratio + 0.5) * downscale_ratio
    height = int(height / downscale_ratio + 0.5) * downscale_ratio
    return (width, height)

def get_audio(file_path, start_time=0, duration=0):
    args = ['ffmpeg', "-i", file_path, "-vn"]
    if start_time > 0:
        args += ["-ss", str(start_time)]
    if duration > 0:
        args += ["-t", str(duration)]
    
    args += ["-f", "f32le", "-acodec", "pcm_f32le", "-ar", "44100", "-ac", "2", "-"]

    try:
        proc = subprocess.run(args, capture_output=True, check=True)

        info_str = proc.stderr.decode('utf-8', 'replace')

        sample_rate = 44100
        channels = 2

        sr_match = re.search(r'(\d+)\s+Hz', info_str)
        if sr_match:
            sample_rate = int(sr_match.group(1))

        ch_match = re.search(r'Hz,\s+(mono|stereo)', info_str)
        if ch_match:
            channels = 1 if ch_match.group(1) == 'mono' else 2

        waveform = torch.from_numpy(np.frombuffer(proc.stdout, dtype=np.float32))
        waveform = waveform.reshape(-1, channels).permute(1, 0)
        
        return {'waveform': waveform.unsqueeze(0), 'sample_rate': sample_rate}

    except subprocess.CalledProcessError as e:
        print(f"LMM Selector: Could not extract audio from {file_path}. It might not contain an audio track. Error: {e.stderr.decode('utf-8', 'replace')}")
        return {'waveform': torch.zeros(1, 2, 1), 'sample_rate': 44100}
    except Exception as e:
        print(f"LMM Selector: An unexpected error occurred during audio extraction: {e}")
        return {'waveform': torch.zeros(1, 2, 1), 'sample_rate': 44100}

def cv_frame_generator(video_path, force_rate, frame_load_cap, skip_first_frames, select_every_nth):
    video_cap = cv2.VideoCapture(video_path)
    if not video_cap.isOpened():
        raise IOError(f"Cannot open video file: {video_path}")

    fps = video_cap.get(cv2.CAP_PROP_FPS)
    width = int(video_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(video_cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    yield {"width": width, "height": height, "fps": fps, "total_frames": total_frames, "duration": duration}

    base_frame_time = 1.0 / fps if fps > 0 else 0
    target_frame_time = 1.0 / force_rate if force_rate > 0 else base_frame_time
    if target_frame_time <= 0:
        target_frame_time = base_frame_time if base_frame_time > 0 else 1.0/30.0

    video_cap.set(cv2.CAP_PROP_POS_FRAMES, skip_first_frames)

    time_offset = target_frame_time
    frames_yielded = 0
    total_frames_evaluated = -1

    while video_cap.isOpened():
        current_pos_frames = skip_first_frames + frames_yielded
        if total_frames > 0 and current_pos_frames >= total_frames:
            break

        if force_rate > 0:
            while time_offset < target_frame_time:
                if not video_cap.grab():
                    video_cap.release()
                    return
                time_offset += base_frame_time
            time_offset -= target_frame_time
            ret, frame = video_cap.retrieve()
        else:
             ret, frame = video_cap.read()

        if not ret:
            break

        total_frames_evaluated += 1
        if total_frames_evaluated % select_every_nth != 0:
            continue

        yield cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        frames_yielded += 1
        if frame_load_cap > 0 and frames_yielded >= frame_load_cap:
            break
            
    video_cap.release()

class SelectOriginalImageNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "paths": ("LMM_ALL_PATHS", {"forceInput": True}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "frame_load_cap": ("INT", {"default": 1, "min": 1, "max": 4096, "step": 1, "tooltip": "Copy a single image into a specified number of image sequences"}),
                "generation_width": ("INT", {"default": 1024, "min": 64, "max": 8096, "step": 8, "tooltip": "The desired image width"}),
                "generation_height": ("INT", {"default": 1024, "min": 64, "max": 8096, "step": 8, "tooltip": "The desired image height"}),
                "aspect_ratio_preservation": (["original", "keep_input", "stretch_to_new", "crop_to_new"], {"tooltip": "Zoom Mode：\n- keep_input: Maintain the aspect ratio of the original image\n- stretch_to_new: Stretch to fit the new size\n- crop_to_new: Cropped to fit new sizes\n- original: No processing is performed, use the original image size"}),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT", "STRING", "STRING",)
    RETURN_NAMES = ("image", "width", "height", "positive_prompt", "negative_prompt",)
    FUNCTION = "get_original_image"
    CATEGORY = "📜Asset Gallery/Local"

    def get_original_image(self, paths, index, frame_load_cap, generation_width, generation_height, aspect_ratio_preservation):
        selected_item = parse_selection_and_get_item(paths, index, "image")
        
        empty_return = (torch.zeros(1, 1, 1, 3), 0, 0, "", "")

        if not selected_item or 'path' not in selected_item or not os.path.exists(selected_item['path']):
            return empty_return

        selected_path = selected_item['path']

        try:
            with Image.open(selected_path) as img:
                H_orig, W_orig = img.height, img.width
                
                img_out = img.convert("RGBA") if 'A' in img.getbands() else img.convert("RGB")
                img_array = np.array(img_out).astype(np.float32) / 255.0
                image_tensor = torch.from_numpy(img_array)[None,]

                if aspect_ratio_preservation != "original":
                    max_area = generation_width * generation_height
                    crop = "disabled"

                    if aspect_ratio_preservation == "keep_input":
                        aspect_ratio = H_orig / W_orig if W_orig > 0 else 1.0
                    elif aspect_ratio_preservation == "stretch_to_new" or aspect_ratio_preservation == "crop_to_new":
                        aspect_ratio = generation_height / generation_width if generation_width > 0 else 1.0
                        if aspect_ratio_preservation == "crop_to_new":
                            crop = "center"
                    
                    lat_h = round(np.sqrt(max_area * aspect_ratio) / VAE_STRIDE[1] / PATCH_SIZE[1]) * PATCH_SIZE[1]
                    lat_w = round(np.sqrt(max_area / aspect_ratio) / VAE_STRIDE[2] / PATCH_SIZE[2]) * PATCH_SIZE[2]
                    h_new = int(lat_h * VAE_STRIDE[1])
                    w_new = int(lat_w * VAE_STRIDE[2])
                    
                    processed_image = common_upscale(image_tensor.movedim(-1, 1), w_new, h_new, "lanczos", crop).movedim(1, -1)
                else:
                    w_new = W_orig
                    h_new = H_orig
                    processed_image = image_tensor
                
                if frame_load_cap > 1:
                    image_sequence = processed_image.repeat(frame_load_cap, 1, 1, 1)
                else:
                    image_sequence = processed_image

                metadata = selected_item.get('metadata', {})
                positive_prompt, negative_prompt = extract_prompts(metadata)
                
                return (image_sequence, w_new, h_new, positive_prompt, negative_prompt,)
        except Exception as e:
            print(f"LMM Selector: Error loading or processing image {selected_path}: {e}")
            return empty_return

class SelectOriginalVideoNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "paths": ("LMM_ALL_PATHS", {"forceInput": True}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "generation_width": ("INT", {"default": 1024, "min": 64, "max": 8096, "step": 8, "tooltip": "Expected video width to generate"}),
                "generation_height": ("INT", {"default": 1024, "min": 64, "max": 8096, "step": 8, "tooltip": "Expected video height"}),
                "aspect_ratio_preservation": (["original", "keep_input", "stretch_to_new", "crop_to_new"], {"tooltip": "Zoom Mode：\n- keep_input: Maintain the aspect ratio of the original video\n- stretch_to_new: Stretch to fit the new size\n- crop_to_new: Cropped to fit new sizes\n- original: No processing is performed, use the original video size"}),
                "force_rate": ("FLOAT", {"default": 0, "min": 0, "max": 240, "step": 1}),
                "frame_load_cap": ("INT", {"default": 0, "min": 0, "step": 1}),
                "skip_first_frames": ("INT", {"default": 0, "min": 0, "step": 1}),
                "select_every_nth": ("INT", {"default": 1, "min": 1, "step": 1}),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT", "INT", "FLOAT", "AUDIO", "STRING",)
    RETURN_NAMES = ("IMAGE", "frame_count", "width", "height", "fps", "audio", "video_info",)
    FUNCTION = "get_original_video"
    CATEGORY = "📜Asset Gallery/Local"

    def get_original_video(self, paths, index, generation_width, generation_height, aspect_ratio_preservation, force_rate, frame_load_cap, skip_first_frames, select_every_nth):
        selected_item = parse_selection_and_get_item(paths, index, "video")

        empty_audio = {'waveform': torch.zeros(1, 2, 1), 'sample_rate': 44100}
        empty_return = (torch.zeros(1, 1, 1, 3), 0, 0, 0, 0.0, empty_audio, "{}")

        if not selected_item or 'path' not in selected_item or not os.path.exists(selected_item['path']):
            return empty_return
        
        selected_path = selected_item['path']

        audio_fps_estimate = force_rate if force_rate > 0 else 30
        audio_data = get_audio(selected_path, start_time=skip_first_frames / audio_fps_estimate)
        try:
            frame_generator = cv_frame_generator(selected_path, force_rate, frame_load_cap, skip_first_frames, select_every_nth)
            source_info = next(frame_generator)
            
            H_orig = source_info.get("height", 0)
            W_orig = source_info.get("width", 0)
            video_fps = source_info.get("fps", 0.0)

            should_resize = True
            crop = "disabled"

            if aspect_ratio_preservation != "original":
                max_area = generation_width * generation_height
                if aspect_ratio_preservation == "keep_input":
                    aspect_ratio = H_orig / W_orig if W_orig > 0 else 1.0
                else:
                    aspect_ratio = generation_height / generation_width if generation_width > 0 else 1.0
                    if aspect_ratio_preservation == "crop_to_new":
                        crop = "center"
                
                lat_h = round(np.sqrt(max_area * aspect_ratio) / VAE_STRIDE[1] / PATCH_SIZE[1]) * PATCH_SIZE[1]
                lat_w = round(np.sqrt(max_area / aspect_ratio) / VAE_STRIDE[2] / PATCH_SIZE[2]) * PATCH_SIZE[2]
                output_h = int(lat_h * VAE_STRIDE[1])
                output_w = int(lat_w * VAE_STRIDE[2])
            else:
                output_h = H_orig
                output_w = W_orig
                should_resize = False

            output_fps = force_rate if force_rate > 0 else video_fps
            frames = list(frame_generator)
            
            if not frames: 
                return (torch.zeros(1, 1, 1, 3), 0, output_w, output_h, output_fps, audio_data, json.dumps(source_info))

            processed_frames = []
            for frame in frames:
                tensor_frame = torch.from_numpy(frame).float() / 255.0
                tensor_frame = tensor_frame.unsqueeze(0)
                
                if should_resize:
                    resized_frame = common_upscale(tensor_frame.movedim(-1, 1), output_w, output_h, "lanczos", crop).movedim(1, -1)
                else:
                    resized_frame = tensor_frame
                
                processed_frames.append(resized_frame.squeeze(0))

            final_tensor = torch.stack(processed_frames)
            return (final_tensor, final_tensor.shape[0], output_w, output_h, output_fps, audio_data, json.dumps(source_info, indent=4))
        except Exception as e:
            print(f"LMM Selector: Error loading or resizing video frames from {selected_path}: {e}")
            return empty_return
        
class SelectOriginalAudioNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "paths": ("LMM_ALL_PATHS", {"forceInput": True}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "seek_seconds": ("FLOAT", {"default": 0, "min": 0, "max": 100000, "step": 0.01}),
                "duration": ("FLOAT", {"default": 0, "min": 0, "max": 100000, "step": 0.01}),
            },
        }

    RETURN_TYPES = ("AUDIO", "FLOAT",)
    RETURN_NAMES = ("audio", "duration",)
    FUNCTION = "get_original_audio"
    CATEGORY = "📜Asset Gallery/Local"

    def get_original_audio(self, paths, index, seek_seconds, duration):
        selected_item = parse_selection_and_get_item(paths, index, "audio")

        if not selected_item or 'path' not in selected_item:
            return (None, 0.0)
            
        selected_path = selected_item['path']

        audio_data = get_audio(selected_path, start_time=seek_seconds, duration=duration)

        if audio_data and 'waveform' in audio_data and audio_data['waveform'] is not None:
            waveform = audio_data['waveform']
            sample_rate = audio_data['sample_rate']
            loaded_duration = waveform.shape[-1] / sample_rate
            return (audio_data, loaded_duration)
        else:
            return (None, 0.0)  

prompt_server = server.PromptServer.instance

@prompt_server.routes.post("/local_image_gallery/update_metadata")
async def update_metadata(request):
    try:
        data = await request.json()
        path, rating, tags = data.get("path"), data.get("rating"), data.get("tags")
        if not path or not os.path.isabs(path): return web.json_response({"status": "error", "message": "Invalid path."}, status=400)
        
        metadata = load_metadata()

        if path not in metadata: 
            metadata[path] = {}

        if rating is not None: 
            metadata[path]['rating'] = int(rating)
        if tags is not None: 
            metadata[path]['tags'] = [str(tag).strip() for tag in tags if str(tag).strip()]

        entry = metadata.get(path, {})
        rating_is_zero_or_missing = entry.get('rating', 0) == 0
        tags_are_empty_or_missing = not entry.get('tags')

        if rating_is_zero_or_missing and tags_are_empty_or_missing:
            del metadata[path]

        save_metadata(metadata)
        return web.json_response({"status": "ok", "message": "Metadata updated"})
    except Exception as e: 
        return web.json_response({"status": "error", "message": str(e)}, status=500)

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

def get_cached_directory_data(directory, force_refresh=False):
    now = time.time()
    cache_key = directory
    
    if not force_refresh and cache_key in DIRECTORY_CACHE:
        cached_data, timestamp = DIRECTORY_CACHE[cache_key]
        if now - timestamp < CACHE_LIFETIME:
            return cached_data

    if not directory or not os.path.isdir(directory):
        return None

    def video_has_workflow(filepath):
        try:
            with open(filepath, 'rb') as f:
                chunk = f.read(4 * 1024 * 1024) 
                return b'"workflow":' in chunk or b'"prompt":' in chunk
        except Exception:
            return False

    all_items = []
    metadata = load_metadata()

    for item in os.listdir(directory):
        full_path = os.path.join(directory, item)
        try:
            stats = os.stat(full_path)
            item_meta = metadata.get(full_path, {})
            item_data = {
                'path': full_path, 
                'name': item, 
                'mtime': stats.st_mtime, 
                'rating': item_meta.get('rating', 0), 
                'tags': item_meta.get('tags', [])
            }
            if os.path.isdir(full_path):
                all_items.append({**item_data, 'type': 'dir'})
            else:
                ext = os.path.splitext(item)[1].lower()
                if ext in SUPPORTED_IMAGE_EXTENSIONS:
                    has_workflow = False
                    try:
                        with Image.open(full_path) as img:
                            if img.info and ('workflow' in img.info or 'prompt' in img.info):
                                has_workflow = True
                    except:
                        pass
                    all_items.append({**item_data, 'type': 'image', 'has_workflow': has_workflow})
                elif ext in SUPPORTED_VIDEO_EXTENSIONS:
                    has_workflow = video_has_workflow(full_path)
                    all_items.append({**item_data, 'type': 'video', 'has_workflow': has_workflow})
                elif ext in SUPPORTED_AUDIO_EXTENSIONS:
                    all_items.append({**item_data, 'type': 'audio'})
        except (PermissionError, FileNotFoundError):
            continue

    DIRECTORY_CACHE[cache_key] = (all_items, now)
    return all_items

@prompt_server.routes.get("/local_image_gallery/images")
async def get_local_images(request):
    directory = request.query.get('directory', '')
    search_mode = request.query.get('search_mode', 'local')
    selected_paths = request.query.getall('selected_paths', [])
    force_refresh = request.query.get('force_refresh', 'false').lower() == 'true'

    if search_mode == 'local' and not directory:
        return web.json_response({"error": "Directory not found."}, status=404)

    show_images = request.query.get('show_images', 'true').lower() == 'true'
    show_videos = request.query.get('show_videos', 'false').lower() == 'true'
    show_audio = request.query.get('show_audio', 'false').lower() == 'true'

    filter_tags_str = request.query.get('filter_tag', '').strip().lower()
    filter_tags = [tag.strip() for tag in filter_tags_str.split(',') if tag.strip()]
    filter_mode = request.query.get('filter_mode', 'OR').upper()

    page = int(request.query.get('page', 1))
    per_page = int(request.query.get('per_page', 50))
    sort_by = request.query.get('sort_by', 'name')
    sort_order = request.query.get('sort_order', 'asc')

    all_items_with_meta = []

    try:
        def check_tags(item_tags):
            lower_item_tags = [t.lower() for t in item_tags]
            if not filter_tags:
                return True
            if filter_mode == 'AND':
                return all(ft in lower_item_tags for ft in filter_tags)
            else:
                return any(ft in lower_item_tags for ft in filter_tags)
        
        if search_mode == 'global' and filter_tags:
            metadata = load_metadata()
            for path, meta in metadata.items():
                if os.path.exists(path):
                    if check_tags(meta.get('tags', [])):
                        ext = os.path.splitext(path)[1].lower()
                        item_type = ''
                        if show_images and ext in SUPPORTED_IMAGE_EXTENSIONS: item_type = 'image'
                        elif show_videos and ext in SUPPORTED_VIDEO_EXTENSIONS: item_type = 'video'
                        elif show_audio and ext in SUPPORTED_AUDIO_EXTENSIONS: item_type = 'audio'
                        if item_type:
                            try:
                                stats = os.stat(path)
                                item_info = {
                                    'path': path, 'name': os.path.basename(path), 'type': item_type,
                                    'mtime': stats.st_mtime, 'rating': meta.get('rating', 0), 'tags': meta.get('tags', [])
                                }
                                if item_type == 'image':
                                    has_workflow = False
                                    try:
                                        with Image.open(path) as img:
                                            if img.info and ('workflow' in img.info or 'prompt' in img.info):
                                                has_workflow = True
                                    except:
                                        pass
                                    item_info['has_workflow'] = has_workflow
                                all_items_with_meta.append(item_info)
                            except: continue

        elif search_mode == 'local':
            directory_items = get_cached_directory_data(directory, force_refresh)
            if directory_items is None:
                return web.json_response({"error": "Directory not found or is invalid."}, status=404)

            for item in directory_items:
                if not check_tags(item.get('tags', [])):
                    continue
                
                item_type = item['type']
                if (item_type == 'dir' or 
                    (show_images and item_type == 'image') or
                    (show_videos and item_type == 'video') or
                    (show_audio and item_type == 'audio')):
                    all_items_with_meta.append(item)

        if selected_paths:
            pinned_items_dict = {path: None for path in selected_paths}
            remaining_items = []
            for item in all_items_with_meta:
                path = item.get('path')
                if path in pinned_items_dict:
                    pinned_items_dict[path] = item
                else:
                    remaining_items.append(item)
            
            pinned_items = []
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

        if selected_paths and pinned_items:
            all_items_with_meta = pinned_items + all_items_with_meta

        parent_directory = os.path.dirname(directory) if search_mode != 'global' else None
        if parent_directory == directory: parent_directory = None

        start = (page - 1) * per_page
        end = start + per_page
        paginated_items = all_items_with_meta[start:end]
        
        return web.json_response({
            "items": paginated_items, "total_pages": (len(all_items_with_meta) + per_page - 1) // per_page,
            "current_page": page, "current_directory": directory, "parent_directory": parent_directory,
            "is_global_search": search_mode == 'global' and filter_tags
        })
    except Exception as e: 
        print(f"LMM Error: {e}")
        return web.json_response({"error": str(e)}, status=500)

@prompt_server.routes.post("/local_image_gallery/set_ui_state")
async def set_ui_state(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id"))
        gallery_id = str(data.get("gallery_id"))
        state = data.get("state", {})
        if not node_id or not gallery_id:
            return web.json_response({"status": "error", "message": "node_id or gallery_id is required"}, status=400)

        node_key = f"{gallery_id}_{node_id}"
        ui_states = load_ui_state()
        if node_key not in ui_states:
            ui_states[node_key] = {}
        ui_states[node_key].update(state)
        save_ui_state(ui_states)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.post("/local_image_gallery/get_selected_items")
async def get_selected_items(request):
    try:
        data = await request.json()
        selection = data.get("selection", [])

        metadata = load_metadata()
        all_items_with_meta = []

        for item_data in selection:
            path = item_data.get("path")
            if path and os.path.exists(path):
                try:
                    stats = os.stat(path)
                    item_meta = metadata.get(path, {})

                    item_info = {
                        'path': path, 
                        'name': os.path.basename(path), 
                        'type': item_data.get("type"),
                        'mtime': stats.st_mtime, 
                        'rating': item_meta.get('rating', 0), 
                        'tags': item_meta.get('tags', [])
                    }
                    if item_data.get("type") == 'image':
                        has_workflow = False
                        try:
                            with Image.open(path) as img:
                                if img.info and ('workflow' in img.info or 'prompt' in img.info):
                                    has_workflow = True
                        except:
                            pass
                        item_info['has_workflow'] = has_workflow
                    all_items_with_meta.append(item_info)
                except (PermissionError, FileNotFoundError):
                    continue

        return web.json_response({
            "items": all_items_with_meta,
            "total_pages": 1,
            "current_page": 1,
            "current_directory": "Selected Items",
            "parent_directory": None,
            "is_global_search": False 
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@prompt_server.routes.get("/local_image_gallery/get_ui_state")
async def get_ui_state(request):
    try:
        node_id = request.query.get('node_id')
        gallery_id = request.query.get('gallery_id')
        if not node_id or not gallery_id:
            return web.json_response({"error": "node_id or gallery_id is required"}, status=400)

        node_key = f"{gallery_id}_{node_id}"
        ui_states = load_ui_state()

        default_state = {
            "last_path": "",
            "selection": [],
            "sort_by": "name",
            "sort_order": "asc",
            "show_images": True,
            "show_videos": False,
            "show_audio": False,
            "filter_tag": "",
            "global_search": False
        }

        node_saved_state = ui_states.get(node_key, {})

        final_state = {**default_state, **node_saved_state}

        return web.json_response(final_state)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

def get_thumbnail_cache_path(filepath, is_video=False):
    filename = hashlib.md5(filepath.encode('utf-8')).hexdigest()
    return os.path.join(THUMBNAIL_CACHE_DIR, filename + ".webp")

@prompt_server.routes.get("/local_image_gallery/thumbnail")
async def get_thumbnail(request):
    filepath = request.query.get('filepath')
    if not filepath or ".." in filepath: return web.Response(status=400)

    filepath = urllib.parse.unquote(filepath)
    if not os.path.exists(filepath): return web.Response(status=404)
    
    ext = os.path.splitext(filepath)[1].lower()
    is_video = ext in SUPPORTED_VIDEO_EXTENSIONS
    
    cache_path = get_thumbnail_cache_path(filepath, is_video)

    if os.path.exists(cache_path) and os.path.getmtime(cache_path) > os.path.getmtime(filepath):
        return web.FileResponse(cache_path)

    try:
        if is_video:
            if VideoFileClip is None:
                return web.Response(status=501)
            with VideoFileClip(filepath) as clip:
                frame = clip.get_frame(0)
                img = Image.fromarray(frame)
                img.thumbnail([320, 320], Image.LANCZOS)
                img.save(cache_path, "WEBP", quality=80)
        else:
            img = Image.open(filepath)
            img.thumbnail([320, 320], Image.LANCZOS)
            img.save(cache_path, "WEBP", quality=85)

        return web.FileResponse(cache_path)
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

@prompt_server.routes.post("/local_image_gallery/delete_files")
async def delete_files(request):
    try:
        data = await request.json()
        filepaths = data.get("filepaths", [])
        if not isinstance(filepaths, list):
            return web.json_response({"status": "error", "message": "Invalid data format."}, status=400)

        metadata = load_metadata()
        metadata_changed = False
        
        DIRECTORY_CACHE.clear()

        for filepath in filepaths:
            if not filepath or not os.path.isabs(filepath) or ".." in filepath:
                continue
            if not os.path.isfile(filepath):
                continue
            try:
                ext = os.path.splitext(filepath)[1].lower()
                is_video = ext in SUPPORTED_VIDEO_EXTENSIONS
                cache_path = get_thumbnail_cache_path(filepath, is_video)
                if os.path.exists(cache_path):
                    os.remove(cache_path)
                
                send2trash(os.path.normpath(filepath))

                if filepath in metadata:
                    del metadata[filepath]
                    metadata_changed = True
            except Exception as e:
                print(f"LMM: Error sending file to trash {os.path.normpath(filepath)}: {e}")
        
        if metadata_changed:
            save_metadata(metadata)

        return web.json_response({"status": "ok", "message": "Delete operation completed."})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@prompt_server.routes.post("/local_image_gallery/move_files")
async def move_files(request):
    DIRECTORY_CACHE.clear()
    try:
        data = await request.json()
        source_paths = data.get("source_paths", [])
        destination_dir = data.get("destination_dir")

        if not isinstance(source_paths, list) or not destination_dir:
            return web.json_response({"status": "error", "message": "Invalid data format."}, status=400)

        if not os.path.isabs(destination_dir) or not os.path.isdir(destination_dir):
            return web.json_response({"status": "error", "message": "Invalid or unsafe destination directory."}, status=400)

        metadata = load_metadata()
        metadata_changed = False
        errors = []

        for source_path in source_paths:
            if not source_path or not os.path.isabs(source_path) or ".." in source_path or not os.path.isfile(source_path):
                continue

            source_dir = os.path.dirname(source_path)
            if os.path.normpath(source_dir) == os.path.normpath(destination_dir):
                continue

            filename = os.path.basename(source_path)
            destination_path = os.path.join(destination_dir, filename)

            counter = 1
            file_base, file_ext = os.path.splitext(filename)
            while os.path.exists(destination_path):
                new_filename = f"{file_base} ({counter}){file_ext}"
                destination_path = os.path.join(destination_dir, new_filename)
                counter += 1

            try:
                ext = os.path.splitext(source_path)[1].lower()
                is_video = ext in SUPPORTED_VIDEO_EXTENSIONS
                old_cache_path = get_thumbnail_cache_path(source_path, is_video)
                if os.path.exists(old_cache_path):
                    new_cache_path = get_thumbnail_cache_path(destination_path, is_video)
                    os.renames(old_cache_path, new_cache_path)

                shutil.move(source_path, destination_path) 
                if source_path in metadata:
                    metadata[destination_path] = metadata[source_path]
                    del metadata[source_path]
                    metadata_changed = True
            except Exception as e:
                error_message = f"Could not move '{filename}': {e}"
                print(f"LMM: {error_message}")
                errors.append(error_message)

        if metadata_changed:
            save_metadata(metadata)

        return web.json_response({"status": "ok", "message": "Move operation completed.", "errors": errors})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)
    
@prompt_server.routes.post("/local_image_gallery/rename_file")
async def rename_file(request):
    DIRECTORY_CACHE.clear()
    try:
        data = await request.json()
        old_path = data.get("old_path")
        new_name = data.get("new_name")

        if not old_path or not os.path.isabs(old_path) or not os.path.isfile(old_path):
            return web.json_response({"status": "error", "message": "Invalid or non-existent source file."}, status=400)

        if not new_name or "/" in new_name or "\\" in new_name:
            return web.json_response({"status": "error", "message": "Invalid new filename."}, status=400)

        directory = os.path.dirname(old_path)
        new_path = os.path.join(directory, new_name)

        if old_path == new_path:
            return web.json_response({"status": "ok", "message": "Filename is the same, no action taken."})

        if os.path.exists(new_path):
            return web.json_response({"status": "error", "message": "A file with that name already exists."}, status=409)

        ext = os.path.splitext(old_path)[1].lower()
        is_video = ext in SUPPORTED_VIDEO_EXTENSIONS
        old_cache_path = get_thumbnail_cache_path(old_path, is_video)
        if os.path.exists(old_cache_path):
            new_cache_path = get_thumbnail_cache_path(new_path, is_video)
            os.rename(old_cache_path, new_cache_path)

        os.rename(old_path, new_path)

        metadata = load_metadata()
        if old_path in metadata:
            metadata[new_path] = metadata[old_path]
            del metadata[old_path]
            save_metadata(metadata)

        return web.json_response({"status": "ok", "message": "File renamed successfully.", "new_path": new_path})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)    

NODE_CLASS_MAPPINGS = {
    "LocalImageGalleryNode": LocalImageGalleryNode,
    "SelectOriginalImageNode": SelectOriginalImageNode,
    "SelectOriginalVideoNode": SelectOriginalVideoNode,
    "SelectOriginalAudioNode": SelectOriginalAudioNode,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalImageGalleryNode": "Local Media Manager",
    "SelectOriginalImageNode": "Select Original Image",
    "SelectOriginalVideoNode": "Select Original Video",
    "SelectOriginalAudioNode": "Select Original Audio",
}