// 设置页面脚本
class SettingsManager {
  constructor() {
    this.settings = {
      likeEnabled: true,
      favoriteEnabled: true,
      imageEnabled: true,
      imageAction: 'download'
    };
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.updateUI();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
          this.settings = { ...this.settings, ...result.settings };
        }
        resolve();
      });
    });
  }

  bindEvents() {
    const saveButton = document.getElementById('saveButton');
    const executeButton = document.getElementById('executeButton');
    const executeAllButton = document.getElementById('executeAllButton');
    
    saveButton.addEventListener('click', () => {
      this.saveSettings();
    });

    executeButton.addEventListener('click', () => {
      this.executeQuickActions();
    });

    executeAllButton.addEventListener('click', () => {
      this.executeOnAllTabs();
    });

    // 监听设置变化
    document.getElementById('likeEnabled').addEventListener('change', (e) => {
      this.settings.likeEnabled = e.target.checked;
    });

    document.getElementById('favoriteEnabled').addEventListener('change', (e) => {
      this.settings.favoriteEnabled = e.target.checked;
    });

    document.getElementById('imageEnabled').addEventListener('change', (e) => {
      this.settings.imageEnabled = e.target.checked;
    });

    document.querySelectorAll('input[name="imageAction"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.settings.imageAction = e.target.value;
        }
      });
    });
  }

  updateUI() {
    document.getElementById('likeEnabled').checked = this.settings.likeEnabled;
    document.getElementById('favoriteEnabled').checked = this.settings.favoriteEnabled;
    document.getElementById('imageEnabled').checked = this.settings.imageEnabled;
    
    const imageActionRadio = document.querySelector(`input[name="imageAction"][value="${this.settings.imageAction}"]`);
    if (imageActionRadio) {
      imageActionRadio.checked = true;
    }
  }

  async saveSettings() {
    const saveButton = document.getElementById('saveButton');
    
    saveButton.disabled = true;
    saveButton.textContent = '保存中...';
    
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ settings: this.settings }, () => {
          resolve();
        });
      });
      
      this.showStatus('设置已保存', 'success');
      
    } catch (error) {
      this.showStatus('保存失败，请重试', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '保存设置';
    }
  }

  async executeQuickActions() {
    const executeButton = document.getElementById('executeButton');
    
    executeButton.disabled = true;
    executeButton.textContent = '执行中...';
    
    try {
      // 获取当前活跃的标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('未找到活跃标签页');
      }

      // 检查是否是B站动态页面
      if (!tab.url.includes('bilibili.com/opus')) {
        throw new Error('请在哔哩哔哩动态页面使用此功能');
      }

      // 准备执行设置
      const executeSettings = {
        likeEnabled: this.settings.likeEnabled,
        favoriteEnabled: this.settings.favoriteEnabled,
        imageAction: this.settings.imageEnabled ? this.settings.imageAction : 'none'
      };
      
      // 统一图片操作类型
      if (executeSettings.imageAction === 'open-tab') {
        executeSettings.imageAction = 'open';
      }

      // 使用 scripting.executeScript 动态执行操作
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (settings) => {
          // 点赞操作
          const likeOpus = () => {
            const likeButton = document.querySelector('.side-toolbar__action.like');
            if (likeButton && !likeButton.classList.contains('is-active')) {
              likeButton.click();
              return { success: true, action: 'like' };
            }
            return { success: false, action: 'like', reason: '已点赞或未找到按钮' };
          };

          // 收藏操作
          const favoriteOpus = () => {
            const favoriteButton = document.querySelector('.side-toolbar__action.favorite');
            if (favoriteButton && !favoriteButton.classList.contains('is-active')) {
              favoriteButton.click();
              return { success: true, action: 'favorite' };
            }
            return { success: false, action: 'favorite', reason: '已收藏或未找到按钮' };
          };

          // 提取图片URL
          const extractImageUrls = () => {
            const imageUrls = new Set();
            const allImages = document.querySelectorAll('img');
            
            allImages.forEach(img => {
              const src = img.src || img.getAttribute('data-src');
              if (src && (src.includes('.jpg') || src.includes('.jpeg') || 
                          src.includes('.png') || src.includes('.webp') || 
                          src.includes('.gif')) && src.includes('new_dyn')) {
                
                let cleanedUrl = src;
                if (cleanedUrl.startsWith('//')) {
                  cleanedUrl = 'https:' + cleanedUrl;
                }
                cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');
                cleanedUrl = cleanedUrl.replace(/@[^\s]*/, '').replace(/\?.*$/, '');
                
                imageUrls.add(cleanedUrl);
              }
            });
            
            return Array.from(imageUrls).filter(url => url.includes('/bfs/new_dyn/') || url.includes('new_dyn'));
          };

          // 执行操作
          const results = {
            like: settings.likeEnabled ? likeOpus() : { skipped: true, action: 'like' },
            favorite: settings.favoriteEnabled ? favoriteOpus() : { skipped: true, action: 'favorite' },
            imageUrls: settings.imageAction !== 'none' ? extractImageUrls() : []
          };

          return results;
        },
        args: [executeSettings]
      });

      const actionResults = results[0]?.result;
      
      // 处理图片操作（如果需要）
      if (executeSettings.imageAction !== 'none' && actionResults?.imageUrls?.length > 0) {
        chrome.runtime.sendMessage({
          action: 'handleImages',
          imageUrls: actionResults.imageUrls,
          imageAction: executeSettings.imageAction
        });
      }

      // 统计成功操作
      const successActions = [];
      if (actionResults?.like?.success) successActions.push('点赞');
      if (actionResults?.favorite?.success) successActions.push('收藏');
      if (actionResults?.imageUrls?.length > 0) successActions.push('图片处理');

      if (successActions.length > 0) {
        this.showStatus(`快捷操作执行成功：${successActions.join('、')}`, 'success');
      } else {
        this.showStatus('未执行任何操作或操作失败', 'warning');
      }
      
    } catch (error) {
      console.error('执行快捷操作时出错:', error);
      this.showStatus(error.message || '执行失败，请重试', 'error');
    } finally {
      executeButton.disabled = false;
      executeButton.textContent = '执行快捷操作';
    }
  }

  async executeOnAllTabs() {
    const executeButton = document.getElementById('executeButton');
    
    executeButton.disabled = true;
    executeButton.textContent = '执行中...';
    
    try {
      chrome.runtime.sendMessage({ action: 'log', message: '开始执行所有页面的快捷操作' });
      
      // 获取所有打开的标签页
      let tabs = await chrome.tabs.query({});
      chrome.runtime.sendMessage({ action: 'log', message: `获取到 ${tabs.length} 个标签页` });
      
      // 检查每个标签页的URL
      for (const tab of tabs) {
        chrome.runtime.sendMessage({ action: 'log', message: `检查标签页 ${tab.id}: ${tab.url ? `\`${tab.url}\`` : 'undefined'}` });
      }
      
      // 检查是否有动态页面
      let opusTabs = tabs.filter(tab => tab.url && tab.url.includes('bilibili.com/opus'));
      
      if (opusTabs.length === 0) {
        chrome.runtime.sendMessage({ action: 'log', message: '未检测到任何动态页面' });
        this.showStatus('未检测到动态页面', 'error');
        return;
      }
      
      chrome.runtime.sendMessage({ action: 'log', message: `检测到 ${opusTabs.length} 个动态页面` });
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const tab of opusTabs) {
        chrome.runtime.sendMessage({ action: 'log', message: `发现动态页面: ${tab.url}` });
        
        try {
          // 准备执行设置
          const executeSettings = {
            likeEnabled: this.settings.likeEnabled,
            favoriteEnabled: this.settings.favoriteEnabled,
            imageAction: this.settings.imageEnabled ? this.settings.imageAction : 'none'
          };
          
          // 统一图片操作类型
          if (executeSettings.imageAction === 'open-tab') {
            executeSettings.imageAction = 'open';
          }

          // 使用 scripting.executeScript 动态执行操作
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (settings) => {
              // 点赞操作
              const likeOpus = () => {
                const likeButton = document.querySelector('.side-toolbar__action.like');
                if (likeButton && !likeButton.classList.contains('is-active')) {
                  likeButton.click();
                  return { success: true, action: 'like' };
                }
                return { success: false, action: 'like', reason: '已点赞或未找到按钮' };
              };

              // 收藏操作
              const favoriteOpus = () => {
                const favoriteButton = document.querySelector('.side-toolbar__action.favorite');
                if (favoriteButton && !favoriteButton.classList.contains('is-active')) {
                  favoriteButton.click();
                  return { success: true, action: 'favorite' };
                }
                return { success: false, action: 'favorite', reason: '已收藏或未找到按钮' };
              };

              // 提取图片URL
              const extractImageUrls = () => {
                const imageUrls = new Set();
                const allImages = document.querySelectorAll('img');
                
                allImages.forEach(img => {
                  const src = img.src || img.getAttribute('data-src');
                  if (src && (src.includes('.jpg') || src.includes('.jpeg') || 
                              src.includes('.png') || src.includes('.webp') || 
                              src.includes('.gif')) && src.includes('new_dyn')) {
                    
                    let cleanedUrl = src;
                    if (cleanedUrl.startsWith('//')) {
                      cleanedUrl = 'https:' + cleanedUrl;
                    }
                    cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');
                    cleanedUrl = cleanedUrl.replace(/@[^\s]*/, '').replace(/\?.*$/, '');
                    
                    imageUrls.add(cleanedUrl);
                  }
                });
                
                return Array.from(imageUrls).filter(url => url.includes('/bfs/new_dyn/') || url.includes('new_dyn'));
              };

              // 执行操作
              const results = {
                like: settings.likeEnabled ? likeOpus() : { skipped: true, action: 'like' },
                favorite: settings.favoriteEnabled ? favoriteOpus() : { skipped: true, action: 'favorite' },
                imageUrls: settings.imageAction !== 'none' ? extractImageUrls() : []
              };

              return results;
            },
            args: [executeSettings]
          });

          const actionResults = results[0]?.result;
          
          // 处理图片操作（如果需要）
          if (executeSettings.imageAction !== 'none' && actionResults?.imageUrls?.length > 0) {
            chrome.runtime.sendMessage({
              action: 'handleImages',
              imageUrls: actionResults.imageUrls,
              imageAction: executeSettings.imageAction
            });
          }

          // 统计成功操作
          let hasSuccess = false;
          if (actionResults?.like?.success) hasSuccess = true;
          if (actionResults?.favorite?.success) hasSuccess = true;
          if (actionResults?.imageUrls?.length > 0) hasSuccess = true;

          if (hasSuccess) {
            successCount++;
            chrome.runtime.sendMessage({ action: 'log', message: `标签页 ${tab.id} 执行成功` });
          } else {
            errorCount++;
            chrome.runtime.sendMessage({ action: 'log', message: `标签页 ${tab.id} 执行失败: 无成功操作` });
          }
        } catch (error) {
          errorCount++;
          chrome.runtime.sendMessage({ action: 'log', message: `标签页 ${tab.id} 执行失败: ${error.message}` });
        }
      }
      
      chrome.runtime.sendMessage({ action: 'log', message: `执行完成: 共 ${opusTabs.length} 个动态页面, 成功 ${successCount} 个, 失败 ${errorCount} 个` });
      this.showStatus(`已完成所有动态页面的快捷操作：成功 ${successCount} 个，失败 ${errorCount} 个`, 'success');
      
    } catch (error) {
      chrome.runtime.sendMessage({ action: 'log', message: `执行出错: ${error.message}` });
      console.error('执行快捷操作时出错:', error);
      this.showStatus(error.message || '执行失败，请重试', 'error');
    } finally {
      executeButton.disabled = false;
      executeButton.textContent = '执行快捷操作';
    }
  }

  showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}

// 初始化设置管理器
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
});