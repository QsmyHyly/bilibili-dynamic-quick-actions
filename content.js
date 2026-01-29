class BilibiliOpusContent {
  constructor() {
    this.init();
  }

  async init() {
    // 添加快捷按钮
    this.addQuickButton();
  }



  addQuickButton() {
    let buttonAdded = false;
    const delays = [300, 600, 2000];

    const tryAddButton = (delay) => {
      if (buttonAdded) return;

      setTimeout(() => {
        if (buttonAdded) return;

        const sideToolbarBox = document.querySelector('.side-toolbar__box');
        if (sideToolbarBox) {
          // 创建快捷操作按钮
          const quickButton = document.createElement('div');
          quickButton.className = 'side-toolbar__action quick-action';
          // 使用本地SVG文件
          const svgUrl = chrome.runtime.getURL('icons/快捷操作.svg');
          quickButton.innerHTML = `
            <img src="${svgUrl}" width="24" height="24" alt="快捷操作">
            <div class="side-toolbar__action__text">快捷操作</div>
          `;
          
          quickButton.style.cursor = 'pointer';
          quickButton.style.whiteSpace = 'nowrap';
          quickButton.style.display = 'flex';
          quickButton.style.flexDirection = 'column';
          quickButton.style.alignItems = 'center';
          
          quickButton.addEventListener('click', async () => {
            // 使用动态注入执行快捷操作
            await this.executeWithDynamicInjection();
          });

          sideToolbarBox.appendChild(quickButton);
          buttonAdded = true;
        }
      }, delay);
    };

    delays.forEach(delay => tryAddButton(delay));
  }



  async executeWithDynamicInjection() {
    try {
      // 从后台获取最新设置
      const settings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({action: 'getSettings'}, (response) => {
          if (response && response.settings) {
            resolve(response.settings);
          } else {
            // 使用默认设置
            resolve({
              likeEnabled: true,
              favoriteEnabled: true,
              imageAction: 'download'
            });
          }
        });
      });

      // 记录获取到的设置
      chrome.runtime.sendMessage({
        action: 'log',
        message: `Content获取到的设置: likeEnabled=${settings.likeEnabled}, favoriteEnabled=${settings.favoriteEnabled}, imageEnabled=${settings.imageEnabled}, imageAction=${settings.imageAction}`
      });

      // 直接在当前页面执行操作（content.js已经运行在目标页面中）
      const actionResults = this.executeQuickActions(settings);
      
      // 处理图片操作（如果需要）
      if (settings.imageEnabled && settings.imageAction !== 'none' && actionResults?.imageUrls?.length > 0) {
        chrome.runtime.sendMessage({
          action: 'handleImages',
          imageUrls: actionResults.imageUrls,
          imageAction: settings.imageAction
        });
      }

      // 显示操作结果
      const successActions = [];
      if (actionResults?.like?.success) successActions.push('点赞');
      if (actionResults?.favorite?.success) successActions.push('收藏');
      if (actionResults?.imageUrls?.length > 0) successActions.push('图片处理');

      if (successActions.length > 0) {
        console.log(`快捷操作执行成功：${successActions.join('、')}`);
      } else {
        console.log('未执行任何操作或操作失败');
      }
      
    } catch (error) {
      console.error('执行快捷操作时出错:', error);
    }
  }

  // 执行快捷操作
  executeQuickActions(settings) {
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
      imageUrls: (settings.imageEnabled && settings.imageAction !== 'none') ? extractImageUrls() : []
    };

    return results;
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