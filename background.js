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
      documentUrlPatterns: ["https://www.bilibili.com/opus/*", "https://www.bilibili.com/read/*"]
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
        documentUrlPatterns: ["https://www.bilibili.com/opus/*", "https://www.bilibili.com/read/*"]
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
          const source = sender.tab ? '[Content]' : '[Popup]';
          console.log(`${source} ${request.message}`);
          sendResponse({ success: true });
          return true;
        case "loadScript":
          this.loadScriptToTab(sender.tab.id, request.scriptFile).then(() => sendResponse({ success: true }));
          return true;
        case "checkScript":
          this.checkScriptExists(sender.tab.id, request.functionName).then(exists => sendResponse({ exists }));
          return true;
        case "executeOnAllTabs":
          this.executeOnAllTabs().then(result => sendResponse(result));
          return true;
      }
    });

    // 右键菜单点击事件
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (tab.url.includes("bilibili.com/opus") || tab.url.includes("bilibili.com/read")) {
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

  // 加载脚本到标签页
  async loadScriptToTab(tabId, scriptFile) {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [scriptFile]
    });
  }

  // 检查脚本函数是否存在
  async checkScriptExists(tabId, functionName) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (funcName) => typeof window[funcName] !== 'undefined',
      args: [functionName]
    });
    return results[0]?.result || false;
  }

  // 执行所有动态页面的快捷操作
  async executeOnAllTabs() {
    try {
      console.log('[Background] 开始执行所有页面的快捷操作');
      
      // 获取所有打开的标签页
      let tabs = await chrome.tabs.query({});
      console.log(`[Background] 获取到 ${tabs.length} 个标签页`);
      
      // 检查每个标签页的URL
      for (const tab of tabs) {
        console.log(`[Background] 检查标签页 ${tab.id}: ${tab.url ? `\`${tab.url}\`` : 'undefined'}`);
      }
      
      // 检查是否有动态或文章页面
      let opusTabs = tabs.filter(tab => tab.url && (tab.url.includes('bilibili.com/opus') || tab.url.includes('bilibili.com/read')));
      
      if (opusTabs.length === 0) {
        console.log('[Background] 未检测到任何动态页面');
        return { success: false, message: '未检测到动态页面', successCount: 0, errorCount: 0 };
      }
      
      console.log(`[Background] 检测到 ${opusTabs.length} 个动态页面`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const tab of opusTabs) {
        console.log(`[Background] 发现动态页面: ${tab.url}`);
        
        try {
          // 检查标签页状态
          const tabStatus = await chrome.tabs.get(tab.id);
          if (tabStatus.status !== 'complete') {
            console.log(`[Background] 标签页 ${tab.id} 状态不是 complete，跳过执行`);
            errorCount++;
            continue;
          }
          
          // 获取设置
          const settings = await this.getSettings();
          
          // 准备执行设置
          const executeSettings = {
            likeEnabled: settings.likeEnabled,
            favoriteEnabled: settings.favoriteEnabled,
            imageEnabled: settings.imageEnabled,
            imageAction: settings.imageEnabled ? settings.imageAction : 'none'
          };
          
          // 统一图片操作类型
          if (executeSettings.imageAction === 'open-tab') {
            executeSettings.imageAction = 'open';
          }

          // 检查 executeQuickActions 函数是否已存在
          let scriptExists = false;
          try {
            const checkResults = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => typeof executeQuickActions !== 'undefined'
            });
            scriptExists = checkResults[0]?.result || false;
          } catch (error) {
            console.log(`[Background] 标签页 ${tab.id} 检查脚本失败: ${error.message}`);
          }

          // 如果函数不存在，才加载 executeQuickActions.js
          if (!scriptExists) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['executeQuickActions.js']
              });
              console.log(`[Background] 已加载executeQuickActions.js到标签页${tab.id}`);
            } catch (error) {
              console.log(`[Background] 标签页 ${tab.id} 加载脚本失败: ${error.message}`);
              errorCount++;
              continue;
            }
          } else {
            console.log(`[Background] 标签页${tab.id}检测到executeQuickActions已存在，跳过加载`);
          }

          // 使用 scripting.executeScript 调用 executeQuickActions 函数
          let actionResults = null;
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (settings) => {
                return executeQuickActions(settings);
              },
              args: [executeSettings]
            });
            actionResults = results[0]?.result;
            
            console.log(`[Background] 标签页${tab.id}执行executeQuickActions完成，结果: ${JSON.stringify(actionResults)}`);
          } catch (error) {
            console.log(`[Background] 标签页 ${tab.id} 执行脚本失败: ${error.message}`);
            errorCount++;
            continue;
          }
          
          // 处理图片操作（如果需要）
          if (executeSettings.imageAction !== 'none' && actionResults?.imageUrls?.length > 0) {
            try {
              await this.handleImages(actionResults.imageUrls, executeSettings.imageAction);
            } catch (error) {
              console.log(`[Background] 标签页 ${tab.id} 处理图片失败: ${error.message}`);
            }
          }

          // 统计成功操作
          let hasSuccess = false;
          if (actionResults?.like?.success) hasSuccess = true;
          if (actionResults?.favorite?.success) hasSuccess = true;
          if (actionResults?.imageUrls?.length > 0) hasSuccess = true;

          if (hasSuccess) {
            successCount++;
            console.log(`[Background] 标签页 ${tab.id} 执行成功`);
          } else {
            errorCount++;
            console.log(`[Background] 标签页 ${tab.id} 执行失败: 无成功操作`);
          }
        } catch (error) {
          errorCount++;
          console.log(`[Background] 标签页 ${tab.id} 执行失败: ${error.message}`);
        }
        
        // 添加延迟，避免同时执行太多脚本
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`[Background] 执行完成: 共 ${opusTabs.length} 个动态页面, 成功 ${successCount} 个, 失败 ${errorCount} 个`);
      return { success: true, message: `已完成所有动态页面的快捷操作：成功 ${successCount} 个，失败 ${errorCount} 个`, successCount, errorCount };
      
    } catch (error) {
      console.log(`[Background] 执行出错: ${error.message}`);
      return { success: false, message: error.message || '执行失败，请重试', successCount: 0, errorCount: 0 };
    }
  }
}

// 初始化插件
new BilibiliOpusHelper();