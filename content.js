class BilibiliOpusContent {
  constructor() {
    this.settings = {
      likeEnabled: true,
      favoriteEnabled: true,
      imageAction: 'download'
    };
    this.init();
  }

  async init() {
    // 监听来自后台的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'executeQuickActions') {
        this.executeQuickActions(request.settings);
        sendResponse({success: true});
      }
      return true;
    });

    // 加载设置
    await this.loadSettings();
    
    // 添加快捷按钮
    this.addQuickButton();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
          this.settings = {...this.settings, ...result.settings};
        }
        resolve();
      });
    });
  }

  addQuickButton() {
    // 等待页面加载完成
    setTimeout(() => {
      const sideToolbar = document.querySelector('.side-toolbar');
      if (sideToolbar) {
        // 创建快捷操作按钮
        const quickButton = document.createElement('div');
        quickButton.className = 'side-toolbar__action quick-action';
        quickButton.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
          </svg>
          <div class="side-toolbar__action__text">快捷操作</div>
        `;
        
        quickButton.style.cursor = 'pointer';
        quickButton.style.marginTop = '10px';
        
        quickButton.addEventListener('click', () => {
          this.executeQuickActions();
        });

        sideToolbar.appendChild(quickButton);
      }
    }, 2000); // 延迟2秒确保页面完全加载
  }

  async executeQuickActions(customSettings = null) {
    const settings = customSettings || this.settings;
    
    console.log('开始执行快捷操作，设置:', settings);
    
    try {
      // 执行点赞
      if (settings.likeEnabled) {
        await this.likeOpus();
      }

      // 执行收藏
      if (settings.favoriteEnabled) {
        await this.favoriteOpus();
      }

      // 处理图片
      if (settings.imageAction && settings.imageAction !== 'none') {
        await this.handleImages(settings.imageAction);
      }

      console.log('快捷操作执行完成');
    } catch (error) {
      console.error('执行快捷操作时出错:', error);
    }
  }

  async likeOpus() {
    return new Promise((resolve) => {
      const likeButton = document.querySelector('.side-toolbar__action.like');
      if (likeButton) {
        likeButton.click();
        console.log('点赞操作执行');
        setTimeout(resolve, 500);
      } else {
        console.log('未找到点赞按钮');
        resolve();
      }
    });
  }

  async favoriteOpus() {
    return new Promise((resolve) => {
      const favoriteButton = document.querySelector('.side-toolbar__action.favorite');
      if (favoriteButton) {
        favoriteButton.click();
        console.log('收藏操作执行');
        setTimeout(resolve, 500);
      } else {
        console.log('未找到收藏按钮');
        resolve();
      }
    });
  }

  async handleImages(action) {
    const imageUrls = this.extractImageUrls();
    
    if (imageUrls.length > 0) {
      console.log(`找到 ${imageUrls.length} 张图片，执行操作: ${action}`);
      
      if (action === 'download') {
        // 下载图片
        this.downloadImages(imageUrls);
      } else if (action === 'open') {
        // 在新标签页打开图片
        this.openImagesInNewTabs(imageUrls);
      }
    } else {
      console.log('未找到图片');
    }
  }

  async downloadImages(imageUrls) {
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        // 从URL中提取原始文件名
        const fileName = this.extractFileName(url);
        
        // 使用fetch获取图片数据，然后创建Blob URL
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // 创建下载链接
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 释放Blob URL
        URL.revokeObjectURL(blobUrl);
        
        console.log(`下载图片 ${i + 1}/${imageUrls.length}: ${fileName}`);
        
        // 添加延迟避免浏览器限制
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`下载图片失败 (${i + 1}/${imageUrls.length}):`, error);
        
        // 如果fetch失败，尝试使用原始方法
        try {
          const fileName = this.extractFileName(url);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.style.display = 'none';
          link.target = '_blank'; // 添加target属性
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log(`使用备用方法下载图片 ${i + 1}/${imageUrls.length}: ${fileName}`);
        } catch (fallbackError) {
          console.error(`备用下载方法也失败:`, fallbackError);
        }
      }
    }
    console.log(`下载完成，共 ${imageUrls.length} 张图片`);
  }

  extractFileName(url) {
    // 从URL中提取文件名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop();
    return fileName || `bilibili_dynamic_${Date.now()}.jpg`;
  }

  openImagesInNewTabs(imageUrls) {
    imageUrls.forEach(url => {
      window.open(url, '_blank');
    });
    console.log(`已在新标签页打开 ${imageUrls.length} 张图片`);
  }

  extractImageUrls() {
    const imageUrls = new Set();
    
    // 方法1: 直接获取所有图片元素
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && this.isValidImageUrl(src)) {
        imageUrls.add(this.cleanImageUrl(src));
      }
    });
    
    // 方法2: 从picture元素的source提取
    const pictureElements = document.querySelectorAll('picture');
    pictureElements.forEach(picture => {
      const sources = picture.querySelectorAll('source');
      sources.forEach(source => {
        const srcset = source.srcset;
        if (srcset) {
          // 提取srcset中的所有URL
          const urls = srcset.split(',').map(item => {
            const url = item.trim().split(' ')[0];
            return url;
          }).filter(url => url && this.isValidImageUrl(url));
          
          urls.forEach(url => {
            imageUrls.add(this.cleanImageUrl(url));
          });
        }
      });
    });
    
    // 方法3: 提取背景图片
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const backgroundImage = style.backgroundImage;
      if (backgroundImage && backgroundImage !== 'none') {
        const urlMatch = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          if (this.isValidImageUrl(url)) {
            imageUrls.add(this.cleanImageUrl(url));
          }
        }
      }
    });
    
    // 过滤掉非动态内容图片
    const filteredUrls = Array.from(imageUrls).filter(url => {
      // 只保留B站动态图片
      return url.includes('/bfs/new_dyn/') || url.includes('new_dyn');
    });
    
    console.log('提取到的图片URL:', filteredUrls);
    return filteredUrls;
  }

  isValidImageUrl(url) {
    return url && 
           (url.includes('.jpg') || url.includes('.jpeg') || 
            url.includes('.png') || url.includes('.webp') || 
            url.includes('.gif')) &&
           url.includes('new_dyn');
  }

  cleanImageUrl(url) {
    // 统一协议，将HTTP转换为HTTPS
    let cleanedUrl = url.replace(/^http:/, 'https:');
    
    // 移除尺寸参数，获取原始图片
    cleanedUrl = cleanedUrl.replace(/@[^\s]*/, '').replace(/\?.*$/, '');
    
    return cleanedUrl;
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new BilibiliOpusContent();
});

// 如果页面已经加载完成，直接初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BilibiliOpusContent();
  });
} else {
  new BilibiliOpusContent();
}