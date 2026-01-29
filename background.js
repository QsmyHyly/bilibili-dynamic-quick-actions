// 后台服务脚本
class BilibiliOpusHelper {
  constructor() {
    this.init();
  }

  async init() {
    await this.createContextMenu();
    this.setupMessageListener();
  }

  // 创建右键菜单
  async createContextMenu() {
    // 移除已存在的菜单
    await chrome.contextMenus.removeAll();

    // 创建主菜单项
    chrome.contextMenus.create({
      id: "bilibili-opus-actions",
      title: "哔哩哔哩动态快捷操作",
      contexts: ["page"],
      documentUrlPatterns: ["https://www.bilibili.com/opus/*"]
    });

    // 创建子菜单项
    const actions = [
      { id: "like-opus", title: "点赞动态" },
      { id: "favorite-opus", title: "收藏动态" },
      { id: "download-images", title: "下载所有图片" },
      { id: "open-images-tab", title: "新标签页打开所有图片" }
    ];

    actions.forEach(action => {
      chrome.contextMenus.create({
        id: action.id,
        parentId: "bilibili-opus-actions",
        title: action.title,
        contexts: ["page"],
        documentUrlPatterns: ["https://www.bilibili.com/opus/*"]
      });
    });
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "getSettings":
          this.getSettings().then(settings => sendResponse({ settings }));
          return true;
        case "saveSettings":
          this.saveSettings(request.settings).then(() => sendResponse({ success: true }));
          return true;
        case "handleImages":
          this.handleImages(request.imageUrls, request.imageAction);
          sendResponse({ success: true });
          return true;
        case "log":
          console.log(`[Popup] ${request.message}`);
          sendResponse({ success: true });
          return true;
      }
    });

    // 右键菜单点击事件
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (tab.url.includes("bilibili.com/opus")) {
        this.handleContextMenuClick(info.menuItemId, tab);
      }
    });
  }

  // 处理右键菜单点击
  async handleContextMenuClick(menuItemId, tab) {
    const settings = await this.getSettings();
    
    chrome.tabs.sendMessage(tab.id, {
      action: "executeAction",
      menuItemId: menuItemId,
      settings: settings
    });
  }

  // 获取设置
  async getSettings() {
    const defaultSettings = {
      likeEnabled: true,
      favoriteEnabled: true,
      imageEnabled: true,
      imageAction: "download" // download, open-tab, disabled
    };

    const result = await chrome.storage.local.get(['settings']);
    const settings = { ...defaultSettings, ...result.settings };
    
    console.log(`[Background] 从storage读取的设置:`, result.settings);
    console.log(`[Background] 合并后的设置:`, settings);
    
    return settings;
  }

  // 保存设置
  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }

  // 下载图片
  async downloadImages(imageUrls) {
    for (const url of imageUrls) {
      try {
        await chrome.downloads.download({
          url: url,
          filename: `bilibili-opus-images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
        });
        // 添加延迟以避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error("下载图片失败:", url, error);
      }
    }
  }

  // 在新标签页打开图片
  openImagesInNewTab(imageUrls) {
    imageUrls.forEach(url => {
      chrome.tabs.create({ url: url });
    });
  }

  // 处理图片操作
  async handleImages(imageUrls, action) {
    if (!imageUrls || imageUrls.length === 0) {
      console.log("没有图片需要处理");
      return;
    }

    console.log(`处理 ${imageUrls.length} 张图片，操作类型: ${action}`);

    switch (action) {
      case "download":
        await this.downloadImages(imageUrls);
        break;
      case "open-tab":
      case "open":
        this.openImagesInNewTab(imageUrls);
        break;
      default:
        console.log("图片操作已禁用");
    }
  }
}

// 初始化插件
new BilibiliOpusHelper();