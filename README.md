<div align="center">

# ComfyUI Local Media Manager
### The Ultimate Local File Manager for Images, Videos, and Audio in ComfyUI
### 一个为 ComfyUI 打造的终极本地图片、视频、音频媒体管理器

</div>

![QQ截图20250821133258 (1)](https://github.com/user-attachments/assets/efbbd721-6b75-4bdc-be9f-5988474fbc0f)

---

## 🇬🇧 English

### Changelog (2025-09-07)
* **Critical Bug Fix**: Fixed a core issue where selecting a new media file while the prompt queue was running could cause the workflow to process the wrong item. The selection is now correctly "locked in" for a task when you queue the prompt, ensuring accurate and predictable results.

### Changelog (2025-09-02)
* **Optimized Unique ID**: Each gallery node now automatically generates and stores its own unique ID, which is synchronized with the workflow. This completely avoids conflicts between different workflows or nodes.

### Update Log (2025-08-31)
* **New Node: Select Original Image**: In multi-image selection mode, this node can be connected to the gallery's “image_path” output interface to retrieve the original image by index. Multiple “Select Original Image” nodes can be used simultaneously.
* **Compact Gallery UI**: A small CSS tweak was made to make the “Local Media Manager” node UI more compact.

### Update Log (2025-08-30)
* **Multi-Select Dropdown**: The previous tag filter has been upgraded to a full-featured multi-select dropdown menu, allowing you to combine multiple tags by checking them.
* **AND/OR Logic Toggle**: A new AND/OR button lets you precisely control the filtering logic for multiple tags (matching all tags vs. matching any tag).

### Update Log (2025-08-27)
* **Major Upgrade**: Implemented a comprehensive **Workflow Memory** system. The node now remembers all UI settings (path, selections, sorting, filters) and restores them on reload.
* **Advanced Features**: Added **Multi-Select** with sequence numbers (`Ctrl+Click`), batch **Tag Editing**, and intelligent **Batch Processing** for images of different sizes.

---

### Overview

**ComfyUI Local Media Manager** has evolved into a powerful, feature-rich custom node that integrates a seamless local file management system directly into your ComfyUI workflow. This single, unified node allows you to browse, manage, and select local images, videos, and audio files, and instantly import them or their metadata into your projects. It eliminates the need to constantly switch to your OS file explorer, dramatically speeding up your creative and organizational process.

The gallery features a fluid waterfall (masonry) layout, smooth transitions, and an advanced lightbox viewer, ensuring a beautiful and efficient browsing and management experience.

### Features

-   **All-in-One Media Hub**: Browse images, videos, and audio files within a single, powerful node.
-   **Full Metadata Management**:
    -   **Star Rating**: Assign a rating from 1 to 5 stars to any media file. Click a star to rate, click it again to unrate.
    -   **Tagging System**: Add or remove custom tags for any media file. Selections are saved instantly.
-   **Advanced Navigation & Search**:
    -   Full folder/directory navigation, including an "Up" button.
    -   **Global Tag Search**: Search for files with a specific tag across **all your drives and folders** by checking the "全局" (Global) box.
    -   Persistent Memory: The node remembers the last directory you visited.
-   **Powerful Filtering & Sorting**:
    -   Toggle visibility for videos and audio files with dedicated checkboxes.
    -   Sort all media by **Name**, modification **Date**, or **Rating**.
    -   Filter the current view by a specific tag. Clicking a tag on a card automatically filters by that tag in global search mode.
-   **High-Performance Gallery**:
    -   A fluid, responsive waterfall layout that intelligently adapts to the node's size.
    -   **Performance-optimized thumbnails** for images ensure smooth scrolling.
    -   Smooth fade-in/fade-out transitions when changing directories.
-   **Advanced Lightbox Viewer**:
    -   Double-click any media file to open a full-screen, centered preview.
    -   **Image Viewer**: Supports zooming (mouse wheel) and panning (drag).
    -   **Video/Audio Player**: Provides full playback controls.
    -   **Gallery Navigation**: Use on-screen arrows or keyboard arrow keys (`Left`/`Right`) to cycle through all media.
-   **Independent Multi-Node Usage**:
    -   Use multiple browser nodes in the same workflow without conflicts. Selections for images, videos, and audio are saved independently.
-   **Rich Metadata Output**:
    -   The `info` output port provides detailed metadata for **selected images**, including basic info (dimensions) and **AI generation parameters** (prompts, workflows from ComfyUI/A1111) embedded in the image.


### Installation

1.  Navigate to your ComfyUI installation directory.
2.  Go to the `ComfyUI/custom_nodes/` folder.
3.  Clone or download this repository into the `custom_nodes` folder. The final folder structure should be `ComfyUI/custom_nodes/ComfyUI_Local_Image_Gallery/`.
4.  Restart ComfyUI. No additional dependencies are required.

### How to Use

1.  **Add the Node**: Double-click on the canvas, search for `Local Media Manager`, and add the node.
2.  **Browse**: Enter a full, absolute path to a folder in the "Path" input box and click "Refresh" or press `Enter`.
3.  **Rate & Tag**:
    -   Click the stars on any media card to assign a rating.
    -   Single-click a card to select it. The "Edit Tags" panel will appear at the top. Type a tag and press `Enter` to add it. Click the `ⓧ` on a tag to remove it. Changes are saved and reflected instantly.
4.  **Filter & Search**:
    -   Enter a tag in the "Filter by Tag" input and press `Enter` or "Refresh" to filter the current folder.
    -   To search for a tag everywhere, check the "全局" (Global) box before refreshing.
    -   **Pro-Tip**: Clicking a tag on a card is a shortcut to performing a global search for that tag.
5.  **Connect Outputs**:
    -   `image`: Connect to an image input.
    -   `video_path` / `audio_path`: Connect to nodes that accept a file path.
    -   `info`: Connect to a `Show Text` node to view image metadata.
6.  **Queue Prompt**: Run your workflow to use the selected media.

---

## 🇨🇳 中文

### 更新日志 (2025-09-07)
* **重大BUG修复**：修复了一个核心问题，即在任务队列正在处理时选择新的媒体文件，会导致工作流处理错误的选项。现在，当您点击“生成”时，所选的媒体会被正确地“锁定”到该任务中，确保了结果的准确性和可预测性。

### 更新日志 (2025-09-02)
* **优化唯一 ID**：每个图库节点现在都会自动生成并保存其专属的唯一 ID，并与工作流程同步。这完全避免了不同工作流程或节点之间的冲突。

### 更新日志 (2025-08-31)
* **新增节点：Select Original Image**: 在图像多选状态下，可以使用这个节点与图库的“image_path”输出接口相连，选择对应序号获取原始图像，可使用多个“Select Original Image”节点。
* **使图库UI更紧凑**: 修改了一小段CSS式样，使“Local Media Manager”节点UI变得紧凑起来。

### 更新日志 (2025-08-30)
* **多选下拉菜单**: 原有的标签筛选器已升级为功能完善的多选下拉菜单，允许您通过勾选来组合多个标签进行筛选。
* **AND/OR 逻辑切换**: 新增了一个 AND/OR 切换按钮，让您可以精确控制多标签的筛选逻辑（是需要满足所有标签，还是满足任意一个）。

### 更新日志 (2025-08-27)
* **重大升级**: 实现了完整的 **工作流记忆** 系统。节点现在可以记住所有UI设置（路径、选择项、排序、筛选）并在重载后恢复。
* **高级功能**: 新增了带序号的 **多选功能** (`Ctrl+单击`)、批量 **标签编辑**，以及对不同尺寸图片的智能 **批处理**。

---

### 概述

**ComfyUI 本地媒体管理器** 已经进化为一个功能强大、特性丰富的自定义节点，它将一个无缝的本地文件管理系统直接集成到了您的 ComfyUI 工作流中。这一个统一的节点允许您浏览、管理和选择本地的图片、视频和音频文件，并能一键将它们本身或其元数据导入到您的项目中。它彻底消除了在操作系统文件浏览器和ComfyUI之间来回切换的烦恼，极大地加速了您的创作和整理流程。

本插件的图库拥有一个流畅的响应式瀑布流布局、平滑的过渡动画和一个高级的灯箱预览器，确保了美观且高效的浏览与管理体验。

### 功能特性

-   **一体化媒体中心**: 在一个强大的节点内即可浏览图片、视频和音频文件。
-   **完整的元数据管理**:
    -   **星级评分**: 为任何媒体文件赋予1到5星的评级。单击星星即可评分，再次单击可以取消评分。
    -   **标签系统**: 为任何媒体文件添加或删除自定义标签，修改会立即保存。
-   **高级导航与搜索**:
    -   完整的文件夹/目录导航，包含一个用于返回上一级的“Up”按钮。
    -   **全局标签搜索**: 只需勾选“全局”选框，即可根据一个标签**跨越您所有的硬盘和文件夹**进行搜索。
    -   持久化记忆：节点会记住您最后访问的文件夹路径。
-   **强大的筛选与排序**:
    -   通过专属的复选框来切换视频和音频文件的可见性。
    -   可按**名称**、修改**日期**或**评分**对所有媒体进行排序。
    -   可按特定标签对当前视图进行过滤。单击卡片上的标签会自动以全局模式搜索该标签。
-   **高性能图库**:
    -   一个流畅的、响应式的瀑布流布局，能够智能地适应节点尺寸。
    -   为图片提供了**性能优化的缩略图**，确保流畅滚动。
    -   切换目录时拥有平滑的淡入淡出过渡效果。
-   **高级灯箱预览器**:
    -   双击任意媒体文件即可打开一个全局居中的全屏预览器。
    -   **图片查看器**: 支持使用鼠标滚轮进行**缩放**，并通过拖动进行**平移**。
    -   **视频/音频播放器**: 在预览窗口内提供完整的播放控制功能。
    -   **图库导航**: 使用界面上的箭头或键盘方向键（`左`/`右`）轻松切换浏览媒体。
-   **支持多节点独立使用**:
    -   可在同一个工作流中使用多个本节点而不会产生冲突。图片、视频和音频的选择状态被独立保存。
-   **丰富的元数据输出**:
    -   `info` 输出端口为**选中的图片**提供详细的元数据，不仅包括基本信息（尺寸），最重要的是，还能提取嵌入图片文件中的**AI生成参数**（例如来自 ComfyUI/A1111 的提示词和工作流）。


### 安装说明

1.  导航至您的 ComfyUI 安装目录。
2.  进入 `ComfyUI/custom_nodes/` 文件夹。
3.  将此插件的仓库克隆或下载到 `custom_nodes` 文件夹中。最终的文件夹结构应为 `ComfyUI/custom_nodes/ComfyUI_Local_Image_Gallery/`。
4.  重启 ComfyUI。无需安装任何额外的依赖库。

### 使用方法

1.  **添加节点**: 在画布上双击，搜索 `Local Media Manager`，然后将该节点添加到您的图中。
2.  **浏览**: 在“Path”输入框中输入一个完整的、绝对路径的文件夹地址，然后点击“Refresh”或按`回车键`。
3.  **评级与标签**:
    -   点击任意媒体卡片下方的星星来进行评分。
    -   **单击**一个卡片以选中它，节点顶部的“Edit Tags”区域即会显示。输入新标签并按`回车`即可添加。点击标签旁的`ⓧ`可删除。所有更改都会被立即保存并实时显示。
4.  **筛选与搜索**:
    -   在“Filter by Tag”输入框中输入一个标签，然后按`回车`或点击“Refresh”即可筛选当前文件夹。
    -   要进行全局搜索，只需在刷新前**勾选“全局”选框**即可。
    -   **专业技巧**: 单击卡片上的任意标签，是执行该标签全局搜索的快捷方式。
5.  **连接输出端口**:
    -   `image`: 连接到任何需要图片输入的端口。
    -   `video_path` / `audio_path`: 连接到任何接受文件路径的节点。
    -   `info`: 连接到 `Show Text` (显示文本) 节点，以查看所选图片的详细元数据。
6.  **执行工作流**: 点击 "Queue Prompt"，您为每种媒体类型所做的最新选择，其数据将被分别送入已连接的节点中。
